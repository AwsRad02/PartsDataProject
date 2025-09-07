document.getElementById("forgot-link").addEventListener("click", function (e) {
  e.preventDefault();

  const container = document.getElementById("forgot-alert-placeholder");

  container.innerHTML = `
    <div id="alertBox" style="background: #d1ecf1; color: #0c5460; padding: 10px; margin-top: 10px; border: 1px solid #bee5eb; border-radius: 5px; position: relative;">
      Password reset is not available online. Please contact your administrator.
      <span onclick="document.getElementById('alertBox').style.display='none'" style="position: absolute; right: 10px; top: 5px; cursor: pointer;">&times;</span>
    </div>
  `;
});
