/**
 * SmartChart — register-sw.js
 * Service worker registration. Kept as a separate file so no inline
 * scripts are needed, satisfying the Content-Security-Policy.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
