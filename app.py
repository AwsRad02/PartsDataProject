from flask import Flask ,jsonify,render_template,request,redirect, session,url_for
import requests
import os 
from functools import wraps
from google.cloud import firestore
import json
from google.cloud import firestore as gfs

import tempfile

credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
if not credentials_json:
    raise ValueError("GOOGLE_CREDENTIALS_JSON environment variable is missing")

with tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".json") as temp:
    temp.write(credentials_json)
    temp.flush()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp.name

app = Flask(__name__)
app.secret_key = "key" 


FIREBASE_API_KEY = "AIzaSyBPNN0EsjDLT0onoR6zs-o0t9BKwX8Ycdc"

db = firestore.Client()
def _model_key(model: str) -> str:
    # "Camry" -> "camry", "RAV 4" -> "rav4"
    return "".join((model or "").lower().split())

def _title_words(s: str) -> str:
    return " ".join(w.capitalize() for w in (s or "").split())

def _up(s: str) -> str:
    return (s or "").strip().upper()

def norm_make_id(make: str) -> str:
    return (make or "").strip().lower()

def norm_model_key(model: str) -> str:
    # "RAV 4" -> "rav4"
    return "".join((model or "").lower().split())

def title_label(s: str) -> str:
    # "rav 4" -> "Rav 4"
    return " ".join((s or "").split()).title()
def format_model_tokens(tokens: list[str]) -> str:
    """
    Given model tokens like ["corolla","cross"], return "CorollaCross".
    Works with one token too: ["camry"] -> "Camry".
    """
    return "".join(w.capitalize() for w in tokens if w)

def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if 'user' not in session:
            # send them to login and preserve where they wanted to go
            return redirect(url_for('login', next=request.path))
        return view(*args, **kwargs)
    return wrapped

def api_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return view(*args, **kwargs)
    return wrapped


@app.route('/',methods=['GET','POST'])

def login():
    if request.method=='POST':
        email=request.form['email']
        password=request.form['password']

        payload={
            "email":email,
            "password":password,
            "returnSecureToken":True
        }

        firebaseURL= f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        res=requests.post(firebaseURL,json=payload)
        data=res.json()
        

        if 'idToken' in data:
            session.permanent = False #login again when the browser is closed 
            session['user']={
                "email":data["email"],
                "uid":data["localId"],
                "token":data["idToken"]
            }

            return redirect(url_for("home")) #homepage
        
        else:
            error_msg=data.get('error',{}).get('message',"Login faild")
            return render_template("login.html",error=error_msg)
    
    return render_template("login.html")

@app.route('/home')
def home():
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template('home.html', user=session['user'])

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))



#home page handling 

@app.route('/search',methods=['POST'])
def searchParts():
    data=request.get_json()
    vehicle=data.get('vehicle','').strip()
    print("Search request received:", data)


    try:
        parts=vehicle.split()
        
        year=int(parts[0])
        make=parts[1].lower()
        model=parts[2] #.capitalize()
      
        
        trim=" ".join(parts[3:]).upper()

        makeModelKey=f"{make}{model}"
        partsRef=db.collection("make_model_parts").document(makeModelKey).collection("parts")
        partsDocs=partsRef.stream()
        
        compatibleParts=[]
        for doc in partsDocs:
            data=doc.to_dict()
            years=data.get('compatible_years', [])
            trims=data.get('compatible_trims', [])
            if year in years and trim in  trims:
                compatibleParts.append({"id":doc.id,**data})

        if not compatibleParts:
            return jsonify([]), 200
        return jsonify(compatibleParts)

    except Exception as e:
        print("Error:",e)
        return jsonify({"error":str(e)}),500
    
@app.route('/result')
def results():
    return render_template("result.html")
                                                                                                                                                                                                                                                                                                                                          


@app.route('/laborCost')
def labor_cost():
    if 'user' not in session:
        return redirect(url_for('login'))
    return render_template("laborCost.html")

@app.get("/api/vehicle-count")
def vehicle_count():
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        total = sum(1 for _ in db.collection("added-vehicles").list_documents())
        return jsonify({"count": total}), 200
    except Exception as e:
        print("vehicle_count error:", e)
        return jsonify({"error": "Failed to count"}), 500
    
    
# ---------- Admin page ----------
@app.route("/dataForm")
def admin_page():
    # If you require login, add your session check here
    return render_template("dataForm.html")

# ---------- API: dropdown data ----------
@app.get("/api/car-models")
def api_car_models():
    make_id = norm_make_id(request.args.get("make", ""))
    if not make_id:
        return jsonify([]), 400

    models_ref = db.collection("carModels").document(make_id).collection("models")
    docs = models_ref.stream()

    out = []
    for d in docs:
        data = d.to_dict() or {}
        out.append({
            "id": d.id,                     # modelKey (e.g., "camry", "rav4")
            "name": data.get("name", d.id)  # display name (e.g., "Camry")
        })
    out.sort(key=lambda x: x["name"])
    return jsonify(out)


# Get trims for a specific make+model
@app.get("/api/car-trims")
def api_car_trims():
    make_id = norm_make_id(request.args.get("make", ""))
    model_name = (request.args.get("model") or "").strip()
    if not (make_id and model_name):
        return jsonify([]), 400

    model_key = norm_model_key(model_name)
    ref = db.collection("carModels").document(make_id).collection("models").document(model_key)
    snap = ref.get()
    if not snap.exists:
        return jsonify([])

    data = snap.to_dict() or {}
    trims = data.get("trims", [])
    return jsonify(trims)


@app.post("/api/added-vehicles")
def api_added_vehicles():
    js = request.get_json(silent=True) or {}

    year   = str(js.get("year", "")).strip()
    makeIn = (js.get("makeId") or js.get("make") or "").strip()
    model  = str(js.get("model", "")).strip()       # can be label or key
    trim   = str(js.get("trim", "")).strip()

    if not (year and makeIn and model and trim):
        return jsonify({"error": "All fields are required: year, make, model, trim"}), 400
    if not year.isdigit() or len(year) != 4:
        return jsonify({"error": "Year must be a 4-digit number"}), 400

    make_id     = norm_make_id(makeIn)
    model_key   = norm_model_key(model)             # normalize even if label passed
    model_label = title_label(model)
    trim_label  = " ".join(trim.split()).upper()

    # Resolve make display name from 'makes' if present; else title-case input
    snap = db.collection("makes").document(make_id).get()
    make_label = (snap.to_dict() or {}).get("name", title_label(makeIn))

    # 1) added-vehicles (id = "2023 Toyota Camry XLE")
    doc_id = f"{year} {make_label} {model_label} {trim_label}"
    veh_ref = db.collection("added-vehicles").document(doc_id)
    if veh_ref.get().exists:
        return jsonify({"status": "exists", "id": doc_id}), 200
    veh_ref.set({
        "id": doc_id, "year": year, "make": make_label,
        "model": model_label, "trim": trim_label
    })

    # 2) carModels/{makeId}/models/{modelKey}  (single source of truth)
    make_ref  = db.collection("carModels").document(make_id)
    model_ref = make_ref.collection("models").document(model_key)

    make_ref.set({"name": make_label}, merge=True)
    model_ref.set({
        "name": model_label,
        "trims": gfs.ArrayUnion([trim_label]),
        "updatedAt": gfs.SERVER_TIMESTAMP,
    }, merge=True)

    return jsonify({"status": "created", "id": doc_id}), 201


@app.post("/api/added-vehicles-range")
def api_added_vehicles_range():
    js = request.get_json(silent=True) or {}

    year_from = str(js.get("yearFrom", "")).strip()
    year_to   = str(js.get("yearTo", "")).strip()
    make_in   = (js.get("make") or js.get("makeId") or "").strip()
    model_in  = title_label(str(js.get("model", "")).strip())
    trim_in   = str(js.get("trim", "")).strip()

    # ----- validation -----
    if not (year_from and year_to and make_in and model_in and trim_in):
        return jsonify({"error": "All fields are required: yearFrom, yearTo, make, model, trim"}), 400
    if not (year_from.isdigit() and year_to.isdigit() and len(year_from) == 4 and len(year_to) == 4):
        return jsonify({"error": "Year From/To must be 4-digit numbers"}), 400

    y1, y2 = int(year_from), int(year_to)
    if y1 > y2:
        return jsonify({"error": "Year From must be <= Year To"}), 400

    # ----- normalize labels -----
    # If you have a 'makes' doc, use its display name; otherwise title-case the input.
    make_doc = db.collection("makes").document(make_in.lower()).get()
    if make_doc.exists:
        make_label = (make_doc.to_dict() or {}).get("name", make_in)
        make_id = make_doc.id
    else:
        make_label = " ".join(w.capitalize() for w in make_in.split())
        make_id = make_in.lower()

    model_label = model_in
    model_key   = "".join(model_label.lower().split())  # e.g. "RAV 4" -> "rav4"
    trim_label  = " ".join(trim_in.split()).upper()

    created, existed = 0, 0

    # ----- write 1 doc per year in added-vehicles -----
    for y in range(y1, y2 + 1):
        doc_id = f"{y} {make_label} {model_label} {trim_label}"
        ref = db.collection("added-vehicles").document(doc_id)
        if ref.get().exists:
            existed += 1
        else:
            ref.set({
                "id": doc_id,
                "year": y,
                "make": make_label,
                "model": model_label,
                "trim": trim_label
            })
            created += 1

    # ----- upsert carModels/{makeId}/models/{modelKey} with trims ArrayUnion -----
    model_ref = db.collection("carModels").document(make_id).collection("models").document(model_key)
    model_ref.set({"name": model_label}, merge=True)
    model_ref.update({"trims": gfs.ArrayUnion([trim_label])})

    return jsonify({
        "status": "ok",
        "created": created,
        "skipped_existing": existed,
        "makeId": make_id,
        "modelKey": model_key,
        "trim": trim_label
    }), 200

# ---------- API: submit parts ----------
@app.post("/api/parts")
def api_parts():
    items = request.get_json() or []
    if not isinstance(items, list):
        return jsonify({"error": "Expected JSON array"}), 400

    def yr_range(a, b):
        a, b = int(a), int(b)
        return list(range(a, b + 1))

    written, updated = 0, 0
    for item in items:
        try:
            make = item["make"]                # e.g. "toyotaCorolla"
            price_from = float(item["priceFrom"])
            price_to   = float(item["priceTo"])
            part_number = item["partNumber"]   # doc id
            part_name   = item["part_name"]
            year_from   = int(item["yearFrom"])
            year_to     = int(item["yearTo"])
            compatible_trims = list(item.get("compatibleTrims", []))
            trim = item.get("trim")

            compatible_years = yr_range(year_from, year_to)

            part_ref = (
                db.collection("make_model_parts")
                  .document(make)
                  .collection("parts")
                  .document(part_number)
            )

            snap = part_ref.get()
            if snap.exists:
                ex = snap.to_dict() or {}
                merged_trims = list({*(ex.get("compatible_trims", [])), *compatible_trims})
                merged_years = list({*(ex.get("compatible_years", [])), *compatible_years})
                part_ref.update({
                    "compatible_trims": merged_trims,
                    "compatible_years": merged_years,
                    "price_from": price_from,
                    "price_to": price_to,
                })
                updated += 1
            else:
                part_ref.set({
                    "partName": part_name,
                    "oem_part_number": part_number,
                    "trim": trim,
                    "year_from": year_from,
                    "year_to": year_to,
                    "price_from": price_from,
                    "price_to": price_to,
                    "compatible_years": compatible_years,
                    "compatible_trims": compatible_trims,
                })
                written += 1
        except Exception as e:
            return jsonify({"error": f"Bad item format: {e}", "item": item}), 400

    return jsonify({"status": "ok", "written": written, "updated": updated}), 200


if __name__ == "__main__":
    app.run(debug=True)


#String Block 

'''
@app.route('/suggest', methods=['POST'])
def suggest_vehicles():
    query = request.get_json().get('query', '').strip().lower()
    suggestions = []

    if not query:
        return jsonify(suggestions)

    try:
        docs = db.collection("make_model_parts").stream()
        for doc in docs:
            key = doc.id.lower()
            if query in key:
                suggestions.append(doc.id)  # you can format prettier if you want
            if len(suggestions) >= 10:
                break
        return jsonify(suggestions)

    except Exception as e:
        print("Suggestion error:", e)
        return jsonify([])

'''