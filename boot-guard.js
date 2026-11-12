// Runs before the app (plain script, not a module) so it still works when the app itself fails to load.
// If the vault can't open, it swaps the endless "Opening the vault…" for a clear message and a Reload button,
// and checks the live site to name any file that is missing.
(function () {
  var TIMEOUT_MS = 25000;
  var ready = false;
  var timer = 0;
  var diagnosing = false;

  function byId(id) { return document.getElementById(id); }

  function setDetail(text, force) {
    var line = byId('bootFailDetail');
    if (line && text && (force || !line.textContent)) line.textContent = String(text).slice(0, 600);
  }

  function showFailure(detail) {
    var panel = byId('bootFail');
    if (!panel) return;
    setDetail(detail, false);
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

  // Follows every "import ... from './file.js'" starting at the entry file and lists the files the site cannot serve.
  function findMissing(entry) {
    var seen = {};
    var missing = [];
    var count = 0;

    function visit(file, from) {
      if (seen[file] || count > 80) return Promise.resolve();
      seen[file] = true;
      count += 1;
      return fetch(file, { cache: 'no-store' }).then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (!res.ok || type.indexOf('html') !== -1) {
          missing.push(file + (from ? ' (needed by ' + from + ')' : ''));
          return null;
        }
        return res.text().then(function (code) {
          var re = /(?:from|import)\s*['"]\.\/([^'"]+\.js)['"]/g;
          var next = [];
          var m;
          while ((m = re.exec(code))) next.push(m[1]);
          return Promise.all(next.map(function (f) { return visit(f, file); }));
        });
      }).catch(function () {
        missing.push(file + ' (could not be fetched)');
      });
    }

    return visit(entry, '').then(function () { return missing; });
  }

  function diagnose(entry) {
    if (diagnosing || typeof fetch !== 'function') return;
    diagnosing = true;
    setDetail('Checking which file is missing…', true);
    findMissing(entry).then(function (missing) {
      if (ready) return;
      if (missing.length) {
        setDetail('These files are missing from your website: ' + missing.join(', ') + '. Upload them, then redeploy.', true);
      } else {
        setDetail('Every file is on the site, but one of them has an error. Reload with a hard refresh (Ctrl+Shift+R). If it stays, send this note to your site builder.', true);
      }
    }).catch(function () {
      setDetail('Could not check the files. Check your internet connection and reload.', true);
    });
  }

  // A script file that could not be downloaded (for example a missing file after a deploy).
  window.addEventListener('error', function (e) {
    if (ready) return;
    var target = e.target;
    if (target && target !== window) {
      if (target.tagName === 'SCRIPT') {
        var file = shortFile(target.getAttribute('src'));
        showFailure('Could not load ' + file + ' or one of its files');
        diagnose(file);
      }
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
    if (ready) return;
    showFailure('The vault took too long to answer');
    diagnose('main.js');
  }, TIMEOUT_MS);

  var reload = byId('bootReload');
  if (reload) reload.addEventListener('click', function () { window.location.reload(); });

  // The app calls ok() once the vault is on screen, or fail(text) when it could not load the watches.
  window.braidBoot = { ok: onReady, fail: showFailure };
})();

