// Talks to the API. Sends JSON as text/plain so the browser skips the CORS preflight,
// which Apps Script can't answer.
var Api = (function () {
  // Staging shares themasters.club with the live site, so every key the site stores starts
  // with the environment's prefix: empty on the live site, `stg-` on staging (F92).
  var PREFIX = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_PREFIX) || '';
  var SESSION_KEY = PREFIX + 'mc-session-v1';
  var onSignedOut = function () {};
  var READS = { boot: 1, me: 1, directory: 1, photos: 1, publicInfo: 1, eventRoster: 1, 'admin.overview': 1 };
  var writes = 0;

  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, value) {
    try { if (value) window[store].setItem(key, value); else window[store].removeItem(key); } catch (e) { /* private mode */ }
  }

  function ApiError(code, message, fields) {
    this.code = code;
    this.message = message;
    this.fields = fields || {};
  }

  async function call(action, body, opts) {
    opts = opts || {};
    if (!READS[action]) writes++;
    var payload = Object.assign({ action: action, session: opts.session !== undefined ? opts.session : read('localStorage', SESSION_KEY) }, body || {});
    var res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      throw new ApiError('network', "Can't reach the server. Check your connection and try again.");
    }
    if (!READS[action]) writes++;
    var data;
    try { data = await res.json(); } catch (e) { throw new ApiError('server', 'The server sent something unexpected. Try again in a minute.'); }
    if (!data.ok) {
      var err = new ApiError(data.error.code, data.error.message, data.error.fields);
      if (err.code === 'unauthorized') {
        write('localStorage', SESSION_KEY, null);
        onSignedOut(err);
      }
      throw err;
    }
    return data;
  }

  return {
    ApiError: ApiError,
    call: call,
    session: function () { return read('localStorage', SESSION_KEY); },
    setSession: function (s) { write('localStorage', SESSION_KEY, s); },
    onSignedOut: function (fn) { onSignedOut = fn; },
    // Counts changes sent, so a refresh can tell it started before one of them.
    writes: function () { return writes; }
  };
})();
