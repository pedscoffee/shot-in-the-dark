function initializeSettingsUI(state) {
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettings = document.getElementById("closeSettings");
  const settingsPanel = document.getElementById("settingsPanel");

  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.remove("hidden");
  });

  closeSettings.addEventListener("click", () => {
    settingsPanel.classList.add("hidden");
  });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t =>
        t.classList.remove("active")
      );

      document.querySelectorAll(".tab-content").forEach(content =>
        content.classList.remove("active")
      );

      tab.classList.add("active");
      document
        .getElementById(tab.dataset.tab)
        .classList.add("active");
    });
  });
}