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
    publicInfo: null,  // live data for the public pages
    admin: null,       // what Admin shows, for leaders: kept in memory only, never saved to the browser
    rosters: {}        // attendance lists opened this session, by event id
  };
  var routes = {};
  var drawFailed = false;

  /* ---------- icons (one stroke family, drawn here) ---------- */

  var ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="M7 10l5 5 5-5"/>',
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
    if (photo.indexOf('sheet:') !== 0) return Core.webp(photo);
    var saved = photoCache()[person.id];
    return saved && saved.v === photo ? saved.data : '';
  }
  // A member's photo is kept out of session replay (ph-no-capture). Leaders' public photos aren't members' rows.
  function avatar(person, cls) {
    var src = photoSrc(person);
    if (src) return '<img class="avatar ' + (cls || '') + (person.id ? ' ph-no-capture' : '') + '" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer">';
    return '<div class="avatar tone-' + Core.avatarTone(person.id || person.name) + ' ' + (cls || '') + '" aria-hidden="true">' + esc(initials(person.name)) + '</div>';
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
  /* ---------- addresses ---------- */

  // A page is named by its address under the site's base (from the <base> the build writes): 'meetings?m=x', and '' for home. Links are written the same way,
  // href="meetings", and resolve against the base from any page (F108).
  var BASE = new URL(document.baseURI).pathname;
  function toPath(route) {
    return BASE + route;
  }
  function routeAt(url) {
    var p = url.pathname.indexOf(BASE) === 0 ? url.pathname.slice(BASE.length) : '';
    return p.replace(/(^|\/)index\.html$/, '').replace(/\/$/, '') + url.search;
  }
  function currentRoute() {
    return routeAt(location);
  }
  // A click on a link inside the site changes the page without reloading it.
  function followLink(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute('download')) return;
    var url = new URL(a.href, document.baseURI);
    if (url.origin !== location.origin || url.pathname.indexOf(BASE) !== 0 || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    e.preventDefault();
    go(routeAt(url));
  }

  // A page that sends people elsewhere while it's being drawn gets the new page after it
  // finishes, so its own empty draw doesn't land on top.
  var drawing = false;
  function go(hash) {
    if (currentRoute() !== hash) history.pushState(null, '', toPath(hash));
    if (drawing) Promise.resolve().then(render); else render();
  }
  function loading(text) {
    return '<div class="loading"><div class="spinner"></div>' + esc(text || 'Loading') + '</div>';
  }
  function errorBlock(err) {
    return '<div class="wrap page"><div class="note warn">' + esc(err.message || 'Something went wrong') + '</div>' +
      '<p class="mt-2"><button class="btn quiet" data-retry>Try again</button></p></div>';
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
    return location.origin + toPath(hash);
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
  var BOOT_KEY = 'mc-boot-v1';
  var PHOTOS_KEY = 'mc-photos-v1';
  var PUBLIC_KEY = 'mc-public-v1';
  var INTENDED_KEY = 'mc-intended-v1';
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
    state.admin = null;
    state.rosters = {};
    adminCall = null;
    adminAsk++;
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

  // Admin's data for a leader (F133). It's asked for as soon as a leader's data arrives, so Admin
  // opens at once instead of waiting on the API. fresh=true starts a new call, for after a change;
  // otherwise a call already on its way is shared. Only the newest call's answer is kept.
  var adminCall = null;
  var adminAsk = 0;
  function loadAdmin(fresh) {
    if (adminCall && !fresh) return adminCall;
    var mine = ++adminAsk;
    var call = Api.call('admin.overview').then(function (r) {
      if (mine === adminAsk) state.admin = r;
      return r;
    });
    adminCall = call;
    var done = function () { if (adminCall === call) adminCall = null; };
    call.then(done, done);
    return call;
  }

  // Keeps what a boot or a sign-in sent.
  function take(r) {
    state.me = r.me;
    state.data = { directory: r.directory, events: r.events, posts: r.posts, pending: r.pending || 0, today: r.today };
    saveData();
    Analytics.identify(state.me);
    if (state.me.tier === 'leader') loadAdmin().catch(function () {});
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
      var at = routeOf();
      var route = routes[at.route];
      var isPublic = route && route.isPublic;
      // The page is drawn again only if the fresh data changes what it shows (F137). On a first
      // visit the data is always new, but most pages show none of it, and drawing them twice
      // fetched every image again and moved the page under the reader.
      var before = isPublic ? route.page(at.params) : '';
      state.publicInfo = r;
      writeJson('localStorage', PUBLIC_KEY, r);
      var changed = isPublic && route.page(at.params) !== before;
      if (changed && !$('form:focus-within')) {
        var y = window.scrollY;
        render();
        window.scrollTo(0, y);
      }
    } catch (e) { /* the public pages still work from content.js */ }
  }

  /* ---------- sign-in ---------- */

  // Where a sign-in lands: the link they came for, a first look at their profile, or the directory.
  async function signedIn(r, method) {
    setPendingCode(null);
    clearSaved();
    Api.setSession(r.session);
    take(r);
    Analytics.track('signed in', { method: method, first_time: !!r.me.first });
    // Photos follow on their own, so the page isn't held up waiting for them.
    fetchPhotos().then(function (got) { if (got) notifyPage(); });
    toast('Welcome, ' + r.me.name.split(' ')[0]);
    var intended = readJson('sessionStorage', INTENDED_KEY);
    writeJson('sessionStorage', INTENDED_KEY, null);
    go(intended || (r.me.first ? 'me' : 'members'));
  }

  // The dev server's one-click sign-in for the browser tests: it hands back the same answer a
  // code would. The live site has no such address.
  async function devSignIn(email) {
    var res = await fetch('/__signin', { method: 'POST', body: JSON.stringify({ email: email }) });
    var data = await res.json();
    if (!data.ok) throw new Api.ApiError(data.error.code, data.error.message);
    return signedIn(data, 'dev');
  }

  /* ---------- sign-in by email code ---------- */

  // The address a code went to, kept for the tab so the code step survives a reload.
  var CODE_KEY = 'mc-code-v1';
  function pendingCode() {
    try {
      var p = JSON.parse(sessionStorage.getItem(CODE_KEY) || 'null');
      return p && Date.now() - p.at < Core.CODE_LIMITS.ttlMs ? p : null;
    } catch (e) { return null; }
  }
  // n counts the emails sent to that address, so the page knows the next wait (F110); readyAt,
  // when the API said exactly when a new one can go, overrides it.
  function setPendingCode(email, n, readyAt) {
    try {
      if (email) sessionStorage.setItem(CODE_KEY, JSON.stringify({ email: email, at: Date.now(), n: n || 1, readyAt: readyAt || 0 }));
      else sessionStorage.removeItem(CODE_KEY);
    } catch (e) { /* private mode */ }
  }

  // The one way a code becomes a session, typed or from the link in the email.
  async function signInWithCode(email, code, method) {
    var r;
    try {
      r = await Api.call('emailVerify', { email: email, code: code }, { session: '' });
    } catch (err) {
      Analytics.track('sign in failed', { method: method, reason: err.code });
      throw err;
    }
    return signedIn(r, method);
  }

  function signOut() {
    // Sent while still named, then this browser goes back to anonymous for whoever's next.
    Analytics.track('signed out', { reason: 'user' });
    Analytics.reset();
    Api.setSession(null);
    clearSaved();
    setPendingCode(null);
    toast('Signed out');
    go('');
  }

  Api.onSignedOut(function () {
    // The API stopped accepting the session: counted like a sign-out, with why.
    if (state.me) Analytics.track('signed out', { reason: 'expired' });
    Analytics.reset();
    clearSaved();
    toast('Your session ended. Please sign in again.');
  });

  /* ---------- nav ---------- */

  // Where the club is online, from content.js: Instagram, LinkedIn, and the email once it has one.
  // The club's links, each with its icon: a line of them in the footer, and as cards (with the
  // handle under the name) for "Follow the club" on Home.
  var SOCIAL_ICONS = {
    Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.25" cy="6.75" r="0.75" fill="currentColor"/>',
    LinkedIn: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16.5M8 7.5v.01M12 16.5v-6M12 13.25c0-1.5 1-2.75 2.5-2.75s2 1 2 2.5v3.5"/>',
    'Email us': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'
  };
  function socialLinks(cards) {
    var s = CONTENT.social || {};
    return [['Instagram', s.instagram, '@' + String(s.instagram || '').replace(/\/+$/, '').split('/').pop()], ['LinkedIn', s.linkedin, 'The Masters Club'], ['Email us', s.email ? 'mailto:' + s.email : '', s.email]]
      .filter(function (l) { return l[1]; })
      .map(function (l) {
        var mail = l[1].indexOf('mailto:') === 0;
        var icon = '<svg class="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SOCIAL_ICONS[l[0]] + '</svg>';
        return '<a href="' + esc(l[1]) + '" class="' + (cards ? 'follow-card' : '') + (mail ? ' ph-no-capture' : '') + '"' + (mail ? '' : ' target="_blank" rel="noopener"') + '>' + icon +
          (cards ? '<span><b>' + l[0] + '</b><small>' + esc(l[2]) + '</small></span>' : l[0]) + '</a>';
      }).join('');
  }

  // The menu is places to go. Signing in adds the members' pages to it and keeps the club's own
  // (F143); only Partners and Join, which are for outsiders, step back to the footer. Your profile
  // and Sign out sit under your photo at the right, and in the phone menu they close the list.
  function renderNav(route) {
    var link = function (l) { return '<a href="' + l[0] + '" class="' + (route === l[0] ? 'active' : '') + '">' + l[1] + '</a>'; };
    $('#footSocial').innerHTML = socialLinks();
    $('#footLinks').innerHTML = state.me ? [['about', 'About'], ['meetings', 'Meetings'], ['partners', 'Partners'], ['join', 'Join']].map(function (l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join('') : '';
    if (!state.me) {
      $('#nav').innerHTML = [['about', 'About'], ['meetings', 'Meetings'], ['partners', 'Partners']].map(link).join('') + '<a href="join" class="btn gold small">Sign in</a>';
      return;
    }
    var links = [['members', 'Directory'], ['events', 'Events'], ['board', 'Board']].filter(function (l) { return routeOn(l[0]); });
    links.push(['about', 'About'], ['meetings', 'Past meetings']);
    if (state.me.tier === 'leader') links.push(['admin', 'Admin' + (state.data && state.data.pending ? ' (' + state.data.pending + ')' : '')]);
    $('#nav').innerHTML = links.map(link).join('') +
      '<div class="account"><button type="button" class="account-btn' + (route === 'me' ? ' active' : '') + '" aria-label="Your account" aria-expanded="false" aria-controls="accountMenu">' +
      avatar({ id: state.me.id, name: state.me.name, profile: state.me.profile }, 'xs') + icon('chevron') + '</button>' +
      '<div class="account-menu" id="accountMenu">' + link(['me', 'My profile']) + '<a href="./" data-signout>Sign out</a></div></div>';
    $('[data-signout]').addEventListener('click', function (e) { e.preventDefault(); signOut(); });
    wireAccount();
  }

  // The menu under your photo: the button opens it; Escape, a click elsewhere, tabbing out or going
  // to another page closes it. Fresh data redraws the menu, so whether it's open, and which of its
  // links had focus, carry over to the new one.
  var accountOpen = false;
  var accountFocus = '';
  function wireAccount() {
    var box = $('#nav .account');
    var btn = $('.account-btn', box);
    var setOpen = function (open) {
      accountOpen = open;
      box.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    if (accountOpen) {
      setOpen(true);
      if (accountFocus) { var again = $('.account-menu [href="' + accountFocus + '"]', box); if (again) again.focus(); }
    }
    box.addEventListener('focusin', function (e) { accountFocus = e.target.closest('.account-menu a') ? e.target.getAttribute('href') : ''; });
    btn.addEventListener('click', function () {
      var open = !box.classList.contains('open');
      setOpen(open);
      if (open) $('.account-menu a', box).focus();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) { e.stopPropagation(); setOpen(false); btn.focus(); }
    });
    // Only a move of focus to somewhere else closes it: Safari gives a clicked link no focus, so
    // a click on My profile must not count as leaving.
    box.addEventListener('focusout', function (e) { if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false); });
    document.addEventListener('click', function close(e) {
      if (!document.body.contains(box)) return document.removeEventListener('click', close);
      if (!box.contains(e.target)) setOpen(false);
    });
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
    var parts = currentRoute().split('?');
    return { route: parts[0], params: new URLSearchParams(parts[1] || '') };
  }

  function route(hash, def) {
    routes[hash] = def;
  }

  // A page with a flag (the Board) exists only for those its PostHog flag is on for. Until flags
  // load it's off, so it never flashes in for members; for a leader it appears once they arrive.
  function routeOn(hash) {
    var r = routes[hash];
    // Flags only gate members' pages, so a visitor's page never asks PostHog for one (F130).
    return !(r && r.flag) || (!!state.me && !!Analytics.flag(r.flag));
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
    var r = routes[at.route] || routes[''];
    // Signed in, a flagged page that's off opens Home, like an address that doesn't exist.
    if (r.flag && state.me && !routeOn(at.route)) r = routes[''];
    accountOpen = false;
    renderNav(at.route);
    setMenu(false);
    closeSheet();
    var app = $('#app');
    if (r.member && !state.me) {
      // A link from WhatsApp opens the right page after sign-in. The plain directory is the default anyway.
      if (currentRoute() !== 'members') writeJson('sessionStorage', INTENDED_KEY, currentRoute());
      app.innerHTML = routes['join'].page(new URLSearchParams(), { gated: true });
      routes['join'].wire(at.params);
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
        drawing = true;
        try { app.innerHTML = r.page(at.params); } finally { drawing = false; }
        var wired = r.wire ? r.wire(at.params) : null;
        if (wired && typeof wired.then === 'function') wired.catch(failed);
        if (wired === 'keep-scroll') return;
      } catch (e) {
        failed(e);
        return;
      }
    }
    drawFailed = false;
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
    document.addEventListener('click', followLink);
    window.addEventListener('popstate', render);
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
    errorBlock: errorBlock, setBusy: setBusy, wireRetry: wireRetry, clearErrors: clearErrors, showErrors: showErrors, longDate: longDate, signInWithCode: signInWithCode, pendingCode: pendingCode, setPendingCode: setPendingCode, devSignIn: devSignIn,
    openSheet: openSheet, closeSheet: closeSheet, route: route, render: render, refresh: refresh, refreshPublic: refreshPublic, loadAdmin: loadAdmin, replaceItem: replaceItem, saveData: saveData,
    siteLink: siteLink, toPath: toPath, socialLinks: socialLinks, copyText: copyText, downloadFile: downloadFile, photoCache: photoCache, writeJson: writeJson, PHOTOS_KEY: PHOTOS_KEY, fetchPhotos: fetchPhotos, start: start
  };
})();
