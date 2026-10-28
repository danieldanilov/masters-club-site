// Talks to the API. Sends JSON as text/plain so the browser skips the CORS preflight,
// which Apps Script can't answer.
var Api = (function () {
  var SESSION_KEY = 'mc-session-v1';
  var GUEST_KEY = 'mc-guest-v1';
  var onSignedOut = function () {};

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
    var data;
    try { data = await res.json(); } catch (e) { throw new ApiError('server', 'The server sent something unexpected. Try again in a minute.'); }
    if (!data.ok) {
      var err = new ApiError(data.error.code, data.error.message, data.error.fields);
      if (err.code === 'unauthorized' && action !== 'signIn' && action !== 'requestAccess') {
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
    guest: function () { return read('sessionStorage', GUEST_KEY); },
    setGuest: function (g) { write('sessionStorage', GUEST_KEY, g); },
    onSignedOut: function (fn) { onSignedOut = fn; }
  };
})();
