// The shell of the site: shared helpers, sign-in, the saved copy of member data, the router.
// Each area of the site is its own file in js/pages/ and adds itself with App.route().
// Look and feel: docs/06-design.md.
var App = (function () {
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = Core.escapeHtml;
  var TIER_LABEL = Core.TIER_LABEL;
  var cohortLabel = Core.cohortLabel;

  var state = {
    me: null,          // signed-in member
    data: null,        // {directory, events, posts, pending, today} from boot, or the saved copy
    dir: { q: '', cohort: '', industry: '', open: [], tier: '' },
    board: { q: '', kind: '' },
    guest: null,       // {email, name, request} after an unknown sign-in
    publicInfo: null   // live data for the public pages
  };
  var routes = {};
  var drawFailed = false;

  /* ---------- icons (one stroke family, drawn here) ---------- */

  var ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chat: '<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z"/><path d="M9.5 9.5c0 2.5 2 4.5 4.5 5l1-1.2-1.6-.9-.8.8c-.9-.4-1.6-1.1-2-2l.8-.8-.9-1.6z"/>',
    linkedin: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10.5v5.5M8 7.8v.2M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  /* ---------- small helpers ---------- */

  function initials(n) {
    return String(n || '?').split(/\s+/).filter(Boolean).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
  }
  // An uploaded photo lives in the Sheet and arrives through the API; until it's here, the initials show.
  function photoSrc(person) {
    var photo = person.profile && person.profile.photo;
    if (!photo) return '';
    if (photo.indexOf('sheet:') !== 0) return photo;
    var saved = photoCache()[person.id];
    return saved && saved.v === photo ? saved.data : '';
  }
  // A member's photo is kept out of session replay (ph-no-capture). Leaders' public photos aren't members' rows.
  function avatar(person, cls) {
    var src = photoSrc(person);
    if (src) return '<img class="avatar ' + (cls || '') + (person.id ? ' ph-no-capture' : '') + '" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer">';
    return '<div class="avatar ' + (cls || '') + '" aria-hidden="true">' + esc(initials(person.name)) + '</div>';
  }
  function tags(m) {
    return '<span class="tag ' + esc(m.tier) + '">' + esc(TIER_LABEL[m.tier] || m.tier) + '</span>' +
      (m.cohort ? '<span class="tag">' + esc(cohortLabel(m.cohort)) + '</span>' : '') +
      (m.profile.industry ? '<span class="tag">' + esc(m.profile.industry) + '</span>' : '') +
      (m.joined === false ? '<span class="tag unjoined">Not signed in yet</span>' : '');
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var d = String(iso).split('-');
    return Number(d[2]) + ' ' + MONTHS[Number(d[1]) - 1] + ' ' + d[0];
  }
  function roleLine(p) {
    if (p.role && p.company) return esc(p.role) + ' at ' + esc(p.company);
    return esc(p.role || p.company || '');
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function go(hash) {
    if (location.hash === hash) render(); else location.hash = hash;
  }
  function loading(text) {
    return '<div class="loading"><div class="spinner"></div>' + esc(text || 'Loading') + '</div>';
  }
  function errorBlock(err) {
    return '<div class="wrap page"><div class="note warn">' + esc(err.message || 'Something went wrong') + '</div>' +
      '<p style="margin-top:16px"><button class="btn quiet" data-retry>Try again</button></p></div>';
  }
  function page(inner) {
    return '<div class="wrap page">' + inner + '</div>';
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Saving…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function copyText(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { toast("Couldn't copy"); });
    toast("Couldn't copy");
  }
  // The address to share for a page, the same one the WhatsApp links use.
  function siteLink(hash) {
    return location.href.split('#')[0].split('?')[0] + hash;
  }
  function downloadFile(name, type, text) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- side sheet ---------- */

  var lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    $('#modal').innerHTML = '<button class="close" data-close aria-label="Close">' + icon('close') + '</button><div class="sheet">' + html + '</div>';
    $('#scrim').classList.add('open');
    $('#modal [data-close]').addEventListener('click', closeSheet);
    $('#modal [data-close]').focus();
  }
  function closeSheet() {
    if (!$('#scrim').classList.contains('open')) return;
    $('#scrim').classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#scrim').addEventListener('click', function (e) { if (e.target.id === 'scrim') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- the saved copy ---------- */

  // Member data is kept in this browser so pages open at once, even when the API is slow. Signing
  // out or losing the session wipes it. Photos are saved separately so they're fetched only once.
  // Every key starts with the environment's prefix, so staging and the live site keep apart (F92).
  var PREFIX = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_PREFIX) || '';
  var BOOT_KEY = PREFIX + 'mc-boot-v1';
  var PHOTOS_KEY = PREFIX + 'mc-photos-v1';
  var PUBLIC_KEY = PREFIX + 'mc-public-v1';
  var INTENDED_KEY = PREFIX + 'mc-intended-v1';
  function readJson(store, key) {
    try { return JSON.parse(window[store].getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJson(store, key, value) {
    try { if (value) window[store].setItem(key, JSON.stringify(value)); else window[store].removeItem(key); } catch (e) { /* full or private mode */ }
  }
  var photos = null;
  function photoCache() {
    if (!photos) photos = readJson('localStorage', PHOTOS_KEY) || {};
    return photos;
  }
  function saveData() {
    writeJson('localStorage', BOOT_KEY, state.me && state.data ? { me: state.me, data: state.data } : null);
  }
  function clearSaved() {
    state.me = null;
    state.data = null;
    photos = null;
    writeJson('localStorage', BOOT_KEY, null);
    writeJson('localStorage', PHOTOS_KEY, null);
  }
  function loadSaved() {
    var saved = readJson('localStorage', BOOT_KEY);
    if (saved && saved.me && saved.data) { state.me = saved.me; state.data = saved.data; }
  }

  // Fetches everything fresh and tells the open page if anything changed.
  async function refresh() {
    var writesAtStart = Api.writes();
    var r = await Api.call('boot');
    // A change went out after this reply was made, so it's out of date. Ask again.
    if (Api.writes() !== writesAtStart) return refresh();
    if (r.session) Api.setSession(r.session);
    var before = JSON.stringify(state.data);
    take(r);
    var fetched = await fetchPhotos();
    renderNav(routeOf().route);
    if (drawFailed) render();
    else if (before !== JSON.stringify(state.data) || fetched) notifyPage();
  }

  // Keeps what a boot or a sign-in sent.
  function take(r) {
    state.me = r.me;
    state.data = { directory: r.directory, events: r.events, posts: r.posts, pending: r.pending || 0, today: r.today };
    saveData();
    Analytics.identify(state.me);
  }

  function notifyPage() {
    var r = routes[routeOf().route];
    if (r && r.onData && !$('#scrim.open')) r.onData(routeOf().params);
  }

  async function fetchPhotos() {
    var saved = photoCache();
    var people = state.data.directory.members.slice();
    if (!people.some(function (m) { return m.id === state.me.id; })) people.push({ id: state.me.id, profile: state.me.profile });
    var want = people.filter(function (m) {
      var p = m.profile && m.profile.photo;
      return p && p.indexOf('sheet:') === 0 && (!saved[m.id] || saved[m.id].v !== p);
    }).map(function (m) { return m.id; });
    if (!want.length) return false;
    try {
      var r = await Api.call('photos', { ids: want });
      Object.keys(r.photos).forEach(function (id) { saved[id] = r.photos[id]; });
      writeJson('localStorage', PHOTOS_KEY, saved);
      return Object.keys(r.photos).length > 0;
    } catch (e) { return false; }
  }

  // Applies a change the API just confirmed, without waiting for a full reload.
  function replaceItem(list, item) {
    var i = state.data[list].map(function (x) { return x.id; }).indexOf(item.id);
    if (i === -1) state.data[list].unshift(item); else state.data[list][i] = item;
    saveData();
  }

  // Public pages draw from content.js at once, then pick up what leaders set in Admin.
  async function refreshPublic() {
    if (!state.publicInfo) state.publicInfo = readJson('localStorage', PUBLIC_KEY);
    try {
      var r = await Api.call('publicInfo', {}, { session: '' });
      delete r.ok;
      var changed = JSON.stringify(r) !== JSON.stringify(state.publicInfo);
      state.publicInfo = r;
      writeJson('localStorage', PUBLIC_KEY, r);
      var route = routes[routeOf().route];
      if (changed && route && route.isPublic && !$('form:focus-within')) {
        var y = window.scrollY;
        render();
        window.scrollTo(0, y);
      }
    } catch (e) { /* the public pages still work from content.js */ }
  }

  /* ---------- sign-in ---------- */

  // Signing in asks only for an email: a link and a code arrive in one email, and either signs
  // you in. The dev server also offers a one-click stand-in, which the browser tests use.
  function signInBlock() {
    return '<div class="signin">' + (CONFIG.DEV_SIGNIN ? '<div class="dev-slot"></div>' : '') + '<div class="code-slot"></div></div>';
  }

  // Fills every sign-in block on the page.
  function mountSignIn() {
    $$('.code-slot').forEach(mountCode);
    $$('.dev-slot').forEach(function (slot) {
      slot.innerHTML = '<form class="dev-signin" data-dev-signin><input type="email" name="email" placeholder="Test email" required aria-label="Test email">' +
        '<button class="btn navy" type="submit">Sign in (dev)</button></form>';
      $('form', slot).addEventListener('submit', function (e) {
        e.preventDefault();
        handleCredential(devToken(new FormData(e.target).get('email')));
      });
    });
  }

  // Dev only: a fake Google token the dev server's fake Google accepts. The live API checks
  // every token with Google, which rejects these.
  function devToken(email) {
    var claims = { email: email, aud: CONFIG.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 3600), name: email.split('@')[0] };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(claims)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'fake.' + b64;
  }

  async function handleCredential(credential) {
    $('#app').innerHTML = loading('Signing you in');
    try {
      await signedIn(await Api.call('signIn', { credential: credential }, { session: '' }), 'dev');
    } catch (e) {
      $('#app').innerHTML = errorBlock(e);
      wireRetry();
    }
  }

  // Where a sign-in lands: the link they came for, a first look at their profile, or the
  // directory. Inactive and unknown people go to their own pages.
  async function signedIn(r, method) {
    setPendingCode(null);
    if (r.status === 'member') {
      clearSaved();
      Api.setSession(r.session);
      Api.setGuest(null);
      take(r);
      Analytics.track('signed in', { method: method, first_time: !!r.me.first });
      // Photos follow on their own, so the page isn't held up waiting for them.
      fetchPhotos().then(function (got) { if (got) notifyPage(); });
      toast('Welcome, ' + r.me.name.split(' ')[0]);
      var intended = readJson('sessionStorage', INTENDED_KEY);
      writeJson('sessionStorage', INTENDED_KEY, null);
      go(intended || (r.me.first ? '#/me' : '#/members'));
    } else if (r.status === 'inactive') {
      Analytics.track('sign in failed', { method: method, reason: 'inactive' });
      go('#/denied?e=' + encodeURIComponent(r.email));
    } else {
      Analytics.track('sign in failed', { method: method, reason: 'not_on_list' });
      Api.setGuest(r.guest);
      state.guest = { email: r.email, name: r.name, request: r.request };
      go('#/request');
    }
  }

  /* ---------- sign-in by email code ---------- */

  // The address a code went to, kept for the tab so the code step survives a reload.
  var CODE_KEY = PREFIX + 'mc-code-v1';
  function pendingCode() {
    try {
      var p = JSON.parse(sessionStorage.getItem(CODE_KEY) || 'null');
      return p && Date.now() - p.at < Core.CODE_LIMITS.ttlMs ? p : null;
    } catch (e) { return null; }
  }
  function setPendingCode(email) {
    try {
      if (email) sessionStorage.setItem(CODE_KEY, JSON.stringify({ email: email, at: Date.now() }));
      else sessionStorage.removeItem(CODE_KEY);
    } catch (e) { /* private mode */ }
  }

  function mountCode(slot) {
    var p = pendingCode();
    if (p) return codeStep(slot, p.email);
    slot.innerHTML = '<form class="code-form" novalidate>' +
      '<label>Your email<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"><span class="field-error" data-err="email"></span></label>' +
      '<button class="btn navy" type="submit">Email me a sign-in link</button></form>';
    var f = $('form', slot);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      var email = Core.normalizeEmail(new FormData(f).get('email'));
      clearErrors(f);
      setBusy(btn, true, 'Sending…');
      try {
        await Api.call('emailStart', { email: email }, { session: '' });
        Analytics.track('sign in code sent', { resend: false });
        setPendingCode(email);
        codeStep(slot, email);
        $('input[name=code]', slot).focus();
      } catch (err) {
        Analytics.track('sign in failed', { method: 'email', reason: err.code });
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  function codeStep(slot, email) {
    slot.innerHTML = '<form class="code-form" novalidate>' +
      '<p class="small" style="margin:0">We sent a sign-in link to <b class="ph-sensitive">' + esc(email) + '</b>. Open it on any device, or type the 6-digit code from the same email here. Both work for 10 minutes. If it isn\'t there, check spam.</p>' +
      '<label>Code from the email<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required class="code-input"><span class="field-error" data-err="code"></span></label>' +
      '<button class="btn gold" type="submit">Sign in</button>' +
      '<div class="code-links"><button class="link" type="button" data-resend>Send a new link</button><button class="link" type="button" data-change>Use another email</button></div></form>';
    var f = $('form', slot);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      clearErrors(f);
      setBusy(btn, true, 'Checking…');
      try {
        await signInWithCode(email, new FormData(f).get('code'), 'email');
      } catch (err) {
        Analytics.track('sign in failed', { method: 'email', reason: err.code });
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
    $('[data-resend]', f).addEventListener('click', async function () {
      clearErrors(f);
      try {
        await Api.call('emailStart', { email: email }, { session: '' });
        Analytics.track('sign in code sent', { resend: true });
        setPendingCode(email);
        toast('New link sent');
      } catch (err) {
        showErrors(f, err);
      }
    });
    $('[data-change]', f).addEventListener('click', function () {
      setPendingCode(null);
      mountCode(slot);
    });
  }

  // The one way a code becomes a session, typed or from the link in the email.
  async function signInWithCode(email, code, method) {
    return signedIn(await Api.call('emailVerify', { email: email, code: code }, { session: '' }), method);
  }

  function signOut() {
    // Sent while still named, then this browser goes back to anonymous for whoever's next.
    Analytics.track('signed out');
    Analytics.reset();
    Api.setSession(null);
    Api.setGuest(null);
    clearSaved();
    state.guest = null;
    setPendingCode(null);
    toast('Signed out');
    go('#/');
  }

  Api.onSignedOut(function () {
    Analytics.reset();
    clearSaved();
    toast('Your session ended. Please sign in again.');
  });

  /* ---------- nav ---------- */

  function renderNav(route) {
    var links = [['#/about', 'About'], ['#/meetings', 'Meetings'], ['#/partners', 'Partners']];
    if (state.me) {
      links = [['#/members', 'Directory'], ['#/events', 'Events'], ['#/board', 'Board'], ['#/me', 'My profile']].filter(function (l) { return routeOn(l[0]); });
      if (state.me.tier === 'leader') links.push(['#/admin', 'Admin' + (state.data && state.data.pending ? ' (' + state.data.pending + ')' : '')]);
    }
    // Signed in, the public pages step back to the footer.
    $('#footLinks').innerHTML = state.me ? [['#/about', 'About'], ['#/meetings', 'Meetings'], ['#/partners', 'Partners'], ['#/join', 'Join']].map(function (l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join('') : '';
    var html = links.map(function (l) { return '<a href="' + l[0] + '" class="' + (route === l[0] ? 'active' : '') + '">' + l[1] + '</a>'; }).join('');
    html += state.me ? '<a href="#/" data-signout>Sign out</a>' : '<a href="#/join" class="btn gold small">Sign in</a>';
    $('#nav').innerHTML = html;
    var so = $('[data-signout]');
    if (so) so.addEventListener('click', function (e) { e.preventDefault(); signOut(); });
  }

  /* ---------- forms ---------- */

  function clearErrors(f) {
    $$('[data-err]', f).forEach(function (el) { el.textContent = ''; el.parentElement.classList.remove('has-error'); });
    var n = $('.form-note', f);
    if (n) n.remove();
  }
  function showErrors(f, err) {
    var fields = err.fields || {};
    var placed = false;
    Object.keys(fields).forEach(function (k) {
      var el = $('[data-err="' + k + '"]', f);
      if (el) { el.textContent = fields[k]; el.parentElement.classList.add('has-error'); placed = true; }
    });
    if (!placed || !Object.keys(fields).length) {
      var note = document.createElement('div');
      note.className = 'note warn form-note';
      note.textContent = err.message || 'Something went wrong';
      f.prepend(note);
    }
    var first = $('.has-error input, .has-error textarea, .has-error select', f);
    if (first) first.focus();
  }

  /* ---------- router ---------- */

  function wireRetry() {
    $$('[data-retry]').forEach(function (b) { b.addEventListener('click', render); });
  }
  function routeOf() {
    var parts = (location.hash || '#/').split('?');
    return { route: parts[0], params: new URLSearchParams(parts[1] || '') };
  }

  function route(hash, def) {
    routes[hash] = def;
  }

  // A page with a flag (the Board) exists only for those its PostHog flag is on for. Until flags
  // load it's off, so it never flashes in for members; for a leader it appears once they arrive.
  function routeOn(hash) {
    var r = routes[hash];
    return !(r && r.flag) || !!Analytics.flag(r.flag);
  }
  function flagsNow() {
    return Object.keys(routes).filter(function (h) { return routes[h].flag; }).map(function (h) { return h + routeOn(h); }).join();
  }
  var flagState = '';
  // Flags arrive after the page is drawn, and again on sign-in. Redraw only when one changed, and
  // only the menu unless the open page is a flagged one, so a half-typed form is never wiped.
  function flagsChanged() {
    var now = flagsNow();
    if (now === flagState) return;
    flagState = now;
    if (!state.me) return;
    var at = routeOf();
    if (routes[at.route] && routes[at.route].flag && state.data) render(); else renderNav(at.route);
  }

  function render() {
    var at = routeOf();
    var r = routes[at.route] || routes['#/'];
    // Signed in, a flagged page that's off opens Home, like an address that doesn't exist.
    if (r.flag && state.me && !routeOn(at.route)) r = routes['#/'];
    renderNav(at.route);
    setMenu(false);
    closeSheet();
    var app = $('#app');
    if (r.member && !state.me) {
      // A link from WhatsApp opens the right page after sign-in. The plain directory is the default anyway.
      if (location.hash !== '#/members') writeJson('sessionStorage', INTENDED_KEY, location.hash);
      var asking = Api.guest() && state.guest;
      app.innerHTML = asking ? routes['#/request'].page(at.params) : routes['#/join'].page(new URLSearchParams(), { gated: true });
      var shown = routes[asking ? '#/request' : '#/join'];
      if (shown.wire) shown.wire(at.params);
    } else if (r.member && !state.data) {
      app.innerHTML = loading('Opening the club');
      refresh().then(render, function (e) {
        if (e.code === 'unauthorized') return render();
        app.innerHTML = errorBlock(e);
        wireRetry();
      });
      return;
    } else {
      // A page never stays stuck: say so, and the fresh data gets a chance to fix it. Pages that
      // load more data finish after an await, so their errors arrive later and land here too.
      var failed = function (e) {
        console.error(e);
        Analytics.error(e, { where: 'page draw', route: at.route });
        drawFailed = true;
        app.innerHTML = errorBlock({ message: "This page couldn't open. Try again in a moment." });
        wireRetry();
      };
      try {
        app.innerHTML = r.page(at.params);
        var wired = r.wire ? r.wire(at.params) : null;
        if (wired && typeof wired.then === 'function') wired.catch(failed);
        if (wired === 'keep-scroll') { mountSignIn(); return; }
      } catch (e) {
        failed(e);
        return;
      }
    }
    drawFailed = false;
    mountSignIn();
    window.scrollTo(0, 0);
  }

  function setMenu(open) {
    $('#nav').classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
    $('#menuBtn').innerHTML = icon(open ? 'close' : 'menu');
  }

  function start() {
    $('#menuBtn').addEventListener('click', function () { setMenu(!$('#nav').classList.contains('open')); });
    window.addEventListener('hashchange', render);
    if (CONFIG.ENV !== 'production') $('#envNote').textContent = CONFIG.ENV + ' build with test data';
    if (!state.publicInfo) state.publicInfo = readJson('localStorage', PUBLIC_KEY);
    refreshPublic();
    flagState = flagsNow();
    Analytics.onFlags(flagsChanged);
    if (!Api.session()) {
      clearSaved();
      return render();
    }
    loadSaved();
    Analytics.identify(state.me);
    if (state.data) {
      // The saved copy shows now; the fresh one replaces it when it arrives.
      render();
      refresh().catch(function (e) { if (e.code === 'unauthorized') render(); });
    } else {
      $('#app').innerHTML = loading('Opening the club');
      refresh().then(render, function (e) {
        if (e.code === 'unauthorized') return render();
        $('#app').innerHTML = errorBlock(e);
        wireRetry();
      });
    }
  }

  return {
    $: $, $$: $$, esc: esc, state: state, icon: icon, page: page, avatar: avatar, tags: tags, roleLine: roleLine, toast: toast, go: go, loading: loading,
    errorBlock: errorBlock, setBusy: setBusy, wireRetry: wireRetry, clearErrors: clearErrors, showErrors: showErrors, longDate: longDate, signInBlock: signInBlock, signInWithCode: signInWithCode, forgetCode: function () { setPendingCode(null); },
    openSheet: openSheet, closeSheet: closeSheet, route: route, render: render, refresh: refresh, refreshPublic: refreshPublic, replaceItem: replaceItem, saveData: saveData,
    siteLink: siteLink, copyText: copyText, downloadFile: downloadFile, photoCache: photoCache, writeJson: writeJson, PHOTOS_KEY: PHOTOS_KEY, fetchPhotos: fetchPhotos, start: start
  };
})();
