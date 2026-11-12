// Runs before the app (plain script, not a module) so it still works when the app itself fails to load.
// If the vault can't open, it swaps the endless "Opening the vault…" for a clear message and a Reload button.
(function () {
  var TIMEOUT_MS = 25000;
  var ready = false;
  var timer = 0;

  function byId(id) { return document.getElementById(id); }

  function showFailure(detail) {
    var panel = byId('bootFail');
    if (!panel) return;
    var line = byId('bootFailDetail');
    if (line && detail && !line.textContent) line.textContent = String(detail).slice(0, 300);
    var loading = byId('loadingState');
    if (loading) loading.hidden = true;
    panel.hidden = false;
  }

  function onReady() {
    ready = true;
    clearTimeout(timer);
    var panel = byId('bootFail');
    if (panel) panel.hidden = true;
  }

  function shortFile(path) {
    return String(path || '').split('/').pop().split('?')[0];
  }

  // A script file that could not be downloaded (for example a missing file after a deploy).
  window.addEventListener('error', function (e) {
    if (ready) return;
    var target = e.target;
    if (target && target !== window) {
      if (target.tagName === 'SCRIPT') showFailure('Could not load ' + shortFile(target.getAttribute('src')) + ' or one of its files');
      return;
    }
    showFailure((e.message || 'Script error') + (e.filename ? ' (' + shortFile(e.filename) + ':' + e.lineno + ')' : ''));
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    if (ready) return;
    var reason = e.reason;
    showFailure((reason && reason.message) || String(reason || 'Unknown problem'));
  });

  timer = setTimeout(function () {
    if (!ready) showFailure('The vault took too long to answer');
  }, TIMEOUT_MS);

  var reload = byId('bootReload');
  if (reload) reload.addEventListener('click', function () { window.location.reload(); });

  // The app calls ok() once the vault is on screen, or fail(text) when it could not load the watches.
  window.braidBoot = { ok: onReady, fail: showFailure };
})();
