// The Masters Club site: hash routes, Google sign-in, directory, profile editor, admin.
// Look and feel: docs/06-design.md.
(function () {
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = Core.escapeHtml;
  var TIER_LABEL = Core.TIER_LABEL;
  var cohortLabel = Core.cohortLabel;

  var state = {
    me: null,          // signed-in member, from signIn or me
    directory: null,   // last directory response
    dir: { q: '', cohort: '', industry: '', open: [] },
    guest: null        // {email, name, request} after an unknown sign-in
  };

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
  function avatar(person, cls) {
    var photo = person.profile && person.profile.photo;
    if (photo) return '<img class="avatar ' + (cls || '') + '" src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">';
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

  /* ---------- profile sheet ---------- */

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

  /* ---------- sign-in ---------- */

  var gsiReady = null;
  function loadGoogle() {
    if (gsiReady) return gsiReady;
    gsiReady = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () {
        google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: function (r) { handleCredential(r.credential); }, ux_mode: 'popup', auto_select: false });
        resolve();
      };
      s.onerror = function () { gsiReady = null; reject(new Error('Google sign-in did not load')); };
      document.head.appendChild(s);
    });
    return gsiReady;
  }

  // Fills every .gsi-slot on the page with a sign-in button.
  function mountSignIn() {
    var slots = $$('.gsi-slot');
    if (!slots.length) return;
    if (CONFIG.DEV_SIGNIN) {
      slots.forEach(function (slot) {
        slot.innerHTML = '<form class="dev-signin" data-dev-signin><input type="email" name="email" placeholder="Test email" required aria-label="Test email">' +
          '<button class="btn navy" type="submit">Sign in (dev)</button></form>';
        $('form', slot).addEventListener('submit', function (e) {
          e.preventDefault();
          handleCredential(devToken(new FormData(e.target).get('email')));
        });
      });
      return;
    }
    if (!CONFIG.GOOGLE_CLIENT_ID) {
      slots.forEach(function (slot) { slot.innerHTML = '<div class="note warn">Sign-in is not set up yet.</div>'; });
      return;
    }
    loadGoogle().then(function () {
      slots.forEach(function (slot) {
        slot.innerHTML = '';
        google.accounts.id.renderButton(slot, { theme: slot.dataset.theme || 'outline', size: 'large', shape: 'rectangular', text: 'signin_with', width: 280 });
      });
    }).catch(function (e) {
      slots.forEach(function (slot) { slot.innerHTML = '<div class="note warn">' + esc(e.message) + '. Turn off blockers for this site and reload.</div>'; });
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
      var r = await Api.call('signIn', { credential: credential }, { session: '' });
      if (r.status === 'member') {
        Api.setSession(r.session);
        Api.setGuest(null);
        state.me = r.me;
        state.directory = null;
        toast('Welcome, ' + r.me.name.split(' ')[0]);
        go(r.me.hasProfile ? '#/members' : '#/me');
      } else if (r.status === 'inactive') {
        go('#/denied?e=' + encodeURIComponent(r.email));
      } else {
        Api.setGuest(r.guest);
        state.guest = { email: r.email, name: r.name, request: r.request };
        go('#/request');
      }
    } catch (e) {
      $('#app').innerHTML = errorBlock(e);
      wireRetry();
    }
  }

  function signOut() {
    Api.setSession(null);
    Api.setGuest(null);
    state.me = null;
    state.directory = null;
    state.guest = null;
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
    toast('Signed out');
    go('#/');
  }

  Api.onSignedOut(function () {
    state.me = null;
    state.directory = null;
    toast('Your session ended. Please sign in again.');
  });

  /* ---------- nav ---------- */

  function renderNav(route) {
    var links = [['#/about', 'About'], ['#/meetings', 'Meetings'], ['#/partners', 'Partners'], ['#/join', 'Join']];
    if (state.me) {
      links.push(['#/members', 'Directory'], ['#/me', 'My profile']);
      if (state.me.tier === 'leader') links.push(['#/admin', 'Admin']);
    }
    var html = links.map(function (l) { return '<a href="' + l[0] + '" class="' + (route === l[0] ? 'active' : '') + '">' + l[1] + '</a>'; }).join('');
    html += state.me ? '<a href="#/" data-signout>Sign out</a>' : '<a href="#/members" class="btn gold small">Members sign in</a>';
    $('#nav').innerHTML = html;
    var so = $('[data-signout]');
    if (so) so.addEventListener('click', function (e) { e.preventDefault(); signOut(); });
  }

  /* ---------- public pages ---------- */

  function pageHome() {
    var c = CONTENT;
    var m = c.nextMeeting;
    return '<section class="hero"><div class="tie" aria-hidden="true"></div><div class="wrap">' +
      '<h1>The Masters Club</h1>' +
      '<p class="lead">' + esc(c.tagline) + '</p>' +
      '<div class="actions on-navy"><a class="btn gold" href="#/join">Apply for the next cohort</a><a class="link" href="#/partners">Partner with us</a></div>' +
      '</div></section>' +
      '<div class="wrap">' +
      '<section class="split"><h2>A club and a community</h2><dl>' +
      '<div><dt>The club</dt><dd>' + esc(c.club) + '</dd></div>' +
      '<div><dt>The community</dt><dd>' + esc(c.community) + '</dd></div>' +
      '</dl></section></div>' +
      '<section class="statement"><div class="wrap"><p>' + esc(c.giveFirst) + ' <span>' + esc(c.giveFirstRest) + '</span></p></div></section>' +
      '<div class="wrap"><section class="past"><div class="past-head"><h2>Who has been in the room</h2><a class="link" href="#/meetings">All meetings</a></div>' +
      '<div class="rail">' + c.meetings.map(function (mt) {
        return '<a href="#/meetings?m=' + esc(mt.id) + '"><img src="' + esc(mt.poster) + '" alt="" loading="lazy" width="640" height="640">' +
          '<span class="who">' + esc(mt.speaker) + '</span><span class="when">' + esc(longDate(mt.date)) + '</span></a>';
      }).join('') + '</div></section>' +
      '<section class="invite">' +
      '<div class="date" aria-label="' + esc(m.day + ' ' + m.month) + '"><b>' + esc(m.day) + '</b><span>' + esc(m.month.slice(0, 3)) + '</span></div>' +
      '<div><h2>' + esc(m.title) + '</h2><p class="muted" style="margin:0">' + esc(m.note) + '</p></div>' +
      '<a class="btn quiet" href="#/join">How to join</a>' +
      '</section></div>';
  }

  function pageAbout() {
    return page('<h1>Who runs it</h1>' +
      '<p class="lead measure" style="margin-top:16px">The club is the current cohort. The community is everyone who has been through it. Both are run by volunteers who are Reichman students.</p>' +
      '<div class="people">' + CONTENT.leaders.map(function (p) {
        return '<div class="person">' + avatar({ name: p.name, profile: { photo: p.photo } }, 'lg') + '<div><div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.role) + '</div></div></div>';
      }).join('') + '</div>');
  }

  function pageMeetings() {
    var list = CONTENT.meetings;
    return page('<h1>Past meetings</h1>' +
      '<p class="lead measure" style="margin-top:16px">Cohort 1 met ' + list.length + ' times. Every meeting opens with food and structured networking, then a talk or workshop with someone worth hearing.</p>' +
      '<div class="meetings">' + list.map(function (m, i) {
        return '<article class="meeting" id="m-' + esc(m.id) + '">' +
          '<img class="poster" src="' + esc(m.poster) + '" alt="Poster for ' + esc(m.speaker) + '" width="640" height="640"' + (i > 1 ? ' loading="lazy"' : '') + '>' +
          '<div class="body">' +
          '<p class="meta"><time datetime="' + esc(m.date) + '">' + esc(longDate(m.date)) + '</time><span>' + esc(m.kind) + '</span></p>' +
          '<h2>' + esc(m.speaker) + '</h2><p class="muted role">' + esc(m.role) + '</p>' +
          '<blockquote>' + esc(m.quote) + '</blockquote>' +
          '<p class="recap">' + esc(m.recap) + '</p>' +
          (m.photos && m.photos.length ? '<div class="photos n' + m.photos.length + '">' + m.photos.map(function (p) {
            return '<img src="' + esc(p.src) + '" alt="' + esc(p.alt) + '" loading="lazy">';
          }).join('') + '</div>' : '') +
          '</div></article>';
      }).join('') + '</div>');
  }

  function pagePartners() {
    var c = CONTENT;
    var cta = c.partnerEmail ? '<p style="margin-top:32px"><a class="btn gold" href="mailto:' + esc(c.partnerEmail) + '?subject=Partnering%20with%20the%20Masters%20Club">Talk to us about partnering</a></p>' : '';
    return page('<h1>Work with the club</h1>' +
      '<p class="lead measure" style="margin-top:16px">We partner slowly and choose companies whose involvement helps our members.</p>' +
      c.partners.map(function (p) {
        return '<div class="partner-now"><div class="avatar">' + esc(p.initial) + '</div><div><div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.note) + '</div></div></div>';
      }).join('') +
      '<div class="tiers">' + c.partnerTiers.map(function (t) {
        return '<div><h3>' + esc(t.name) + '</h3><div class="price">' + esc(t.price) + '</div><p class="muted" style="margin:0">' + esc(t.detail) + '</p></div>';
      }).join('') + '</div>' +
      (c.partnerTiersNote ? '<p class="muted small" style="margin-top:12px">' + esc(c.partnerTiersNote) + '</p>' : '') + cta);
  }

  function pageJoin() {
    return page('<h1>Two ways in</h1><div class="paths">' +
      '<div><h2>Apply to a cohort</h2><p class="muted">Open to Reichman master\'s students across programmes. Up to 50 members per cohort, activity in English.</p>' +
      '<a class="btn gold" href="' + esc(CONTENT.applyUrl) + '" target="_blank" rel="noopener">Application form</a></div>' +
      '<div><h2>Been through a cohort?</h2><p class="muted">You\'re in the community for life. Sign in with Google. If we don\'t have your email yet, you can ask a leader to add you in one step.</p>' +
      '<div class="gsi-slot"></div></div></div>');
  }

  function pageNeedLogin() {
    return page('<div class="panel"><div class="inner"><h1>Members only</h1>' +
      '<p class="muted" style="margin:0">Sign in with your Google account. No new password, and you stay signed in for 30 days.</p><div class="gsi-slot"></div></div></div>');
  }

  function pageDenied(email) {
    return page('<div class="panel"><div class="inner"><h1>Can\'t get in?</h1>' +
      '<p><b>' + esc(email || 'This account') + '</b> is on the list but marked inactive.</p>' +
      '<p class="muted" style="margin:0">Ask one of the leaders on WhatsApp to reactivate you, or sign in with another Google account.</p>' +
      '<div class="gsi-slot"></div></div></div>');
  }

  /* ---------- access request (guests) ---------- */

  function pageRequest() {
    var g = state.guest;
    if (!g || !Api.guest()) return pageNeedLogin();
    if (g.request && g.request.status === 'pending') {
      return page('<div class="panel"><div class="inner"><h1>You\'re on the waiting list</h1>' +
        '<p class="muted">We got your request for <b>' + esc(g.email) + '</b>. A leader will link it to your name, and then you can sign in. Nothing else to do.</p>' +
        '<button class="btn quiet" data-signout-guest>Use another Google account</button></div></div>');
    }
    return page('<div class="panel"><div class="inner"><h1>We don\'t have this email yet</h1>' +
      '<p class="muted">You signed in as <b>' + esc(g.email) + '</b>, which isn\'t on the members list. If you\'re in a cohort, send this and a leader will link it to your name.</p>' +
      '<form class="form-grid" id="requestForm" novalidate style="margin-top:24px">' +
      '<label>Your full name<input type="text" name="name" maxlength="60" required dir="auto" value="' + esc(g.name) + '"><span class="field-error" data-err="name"></span></label>' +
      '<label>Anything that helps us find you <span class="hint">Your cohort, or the name you use on WhatsApp</span><textarea name="note" maxlength="280" rows="2" dir="auto"></textarea><span class="field-error" data-err="note"></span></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Send request</button><button class="link" type="button" data-signout-guest>Use another account</button></div></form></div></div>');
  }

  function wireRequest() {
    $$('[data-signout-guest]').forEach(function (b) { b.addEventListener('click', function () { Api.setGuest(null); state.guest = null; go('#/members'); }); });
    var f = $('#requestForm');
    if (!f) return;
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      clearErrors(f);
      setBusy(btn, true, 'Sending…');
      try {
        var fd = new FormData(f);
        var r = await Api.call('requestAccess', { name: fd.get('name'), note: fd.get('note') }, { session: Api.guest() });
        state.guest.request = r.request;
        toast('Request sent');
        render();
      } catch (err) {
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  /* ---------- directory ---------- */

  function pageMembers() {
    return page('<div class="page-head"><h1>Directory</h1><span class="count" id="count" aria-live="polite"></span>' +
      '<span class="spacer"></span><a class="link" href="#/me">Edit my profile</a></div><div id="dirBody">' + loading('Loading the directory') + '</div>');
  }

  async function wireMembers() {
    try {
      if (!state.directory) state.directory = await Api.call('directory');
    } catch (e) {
      if (e.code === 'unauthorized') return render();
      $('#dirBody').innerHTML = errorBlock(e);
      return wireRetry();
    }
    var d = state.directory;
    var cohorts = Array.from(new Set(d.members.map(function (m) { return m.cohort; }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    var hidden = d.hiddenTiers.length
      ? '<p class="note" style="margin-bottom:16px">You\'re viewing as ' + esc(TIER_LABEL[d.viewer.tier]) + ', so ' + esc(d.hiddenTiers.map(function (t) { return TIER_LABEL[t]; }).join(' and ')) + ' profiles are hidden from you.</p>'
      : '';
    var s = state.dir;
    $('#dirBody').innerHTML = hidden +
      '<div class="search-row">' + icon('search') + '<label class="sr-only" for="q">Search members</label>' +
      '<input class="search" type="search" id="q" placeholder="Search by name, company or skill" value="' + esc(s.q) + '" dir="auto" autocomplete="off"></div>' +
      '<div class="filters"><select id="fCohort" aria-label="Cohort"><option value="">All cohorts</option>' +
      cohorts.map(function (c) { return '<option value="' + esc(c) + '" ' + (s.cohort === c ? 'selected' : '') + '>' + esc(cohortLabel(c)) + '</option>'; }).join('') + '</select>' +
      '<select id="fIndustry" aria-label="Industry"><option value="">All industries</option>' + Core.INDUSTRIES.map(function (i) { return '<option ' + (s.industry === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join('') + '</select>' +
      Core.OPEN_TO.map(function (o) { return '<button class="chip ' + (s.open.indexOf(o) !== -1 ? 'on' : '') + '" data-open="' + esc(o) + '" aria-pressed="' + (s.open.indexOf(o) !== -1) + '">' + esc(o) + '</button>'; }).join('') +
      '</div><p class="result-note" id="resultNote" hidden></p><div class="results" id="results"></div>' +
      '<section class="wa"><h2>Chat, events and jobs happen on WhatsApp</h2><p class="muted" style="margin:0">The directory is for finding people. Everything else stays in the club\'s groups.</p><ul>' +
      CONTENT.whatsappGroups.map(function (g) {
        return '<li>' + icon('chat') + '<span class="grow">' + esc(g.name) + '</span>' +
          (g.url ? '<a class="btn quiet small" href="' + esc(g.url) + '" target="_blank" rel="noopener">Open in WhatsApp</a>' : '<span class="muted small">Ask a leader for the link</span>') + '</li>';
      }).join('') + '</ul></section>';

    function draw() {
      var filters = { cohort: s.cohort, industry: s.industry, open: s.open };
      var list = Core.searchMembers(d.members, s.q, filters);
      var note = $('#resultNote');
      note.hidden = true;
      if (!list.length && s.q.trim().split(/\s+/).length > 1) {
        list = Core.searchMembers(d.members, s.q, filters, { any: true });
        if (list.length) {
          note.textContent = 'Nobody matches all of "' + s.q.trim() + '", so here is everyone who matches part of it, best matches first.';
          note.hidden = false;
        }
      }
      $('#count').textContent = list.length + ' member' + (list.length === 1 ? '' : 's');
      $('#results').innerHTML = list.length ? list.map(memberCard).join('') : '<div class="empty">Nobody matches. Try fewer words or filters.</div>';
      $$('#results .member-card').forEach(function (c) {
        c.addEventListener('click', function () { openProfile(c.dataset.id); });
      });
    }
    $('#q').addEventListener('input', function (e) { s.q = e.target.value; draw(); });
    $('#fCohort').addEventListener('change', function (e) { s.cohort = e.target.value; draw(); });
    $('#fIndustry').addEventListener('change', function (e) { s.industry = e.target.value; draw(); });
    $$('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = b.dataset.open;
        s.open = s.open.indexOf(o) !== -1 ? s.open.filter(function (x) { return x !== o; }) : s.open.concat([o]);
        b.classList.toggle('on');
        b.setAttribute('aria-pressed', String(s.open.indexOf(o) !== -1));
        draw();
      });
    });
    draw();
  }

  function memberCard(m) {
    var p = m.profile;
    var role = roleLine(p);
    return '<button class="member-card" data-id="' + esc(m.id) + '" type="button">' + avatar(m) + '<span class="body">' +
      '<span class="name" dir="auto">' + esc(m.name) + '</span>' +
      '<span class="role" dir="auto" style="display:block">' + (role || 'No profile yet') + '</span>' +
      '<span class="tags">' + tags(m) + '</span>' +
      (p.help.length ? '<span class="help" dir="auto" style="display:block">Can help with ' + esc(p.help.join(', ')) + '</span>' : '') +
      '</span></button>';
  }

  function profileSheet(m, preview) {
    var p = m.profile;
    var wa = p.phone ? '<a class="btn gold" href="https://wa.me/' + esc(String(p.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">' + icon('chat') + 'WhatsApp</a>' : '';
    var li = p.linkedin ? '<a class="btn quiet" href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">' + icon('linkedin') + 'LinkedIn</a>' : '';
    function list(label, arr) {
      return arr && arr.length ? '<h3>' + label + '</h3><div class="tags">' + arr.map(function (h) { return '<span class="tag" dir="auto">' + esc(h) + '</span>'; }).join('') + '</div>' : '';
    }
    var actions = wa || li ? '<div class="actions">' + wa + li + '</div>' : (preview ? '' : '<p class="muted small" style="margin-top:28px">No contact links yet.</p>');
    return avatar(m, 'lg') +
      '<h2 dir="auto">' + esc(m.name) + '</h2>' +
      '<div class="role" dir="auto">' + (roleLine(p) || 'No role yet') + '</div>' +
      '<div class="tags" style="margin-top:14px">' + tags(m) + '</div>' +
      (p.bio ? '<p class="bio" dir="auto">' + esc(p.bio) + '</p>' : '') +
      list('Can help with', p.help) + list('Looking for', p.looking) + list('Open to', p.open_to) + actions;
  }

  function openProfile(id) {
    var m = state.directory && state.directory.members.filter(function (x) { return x.id === id; })[0];
    if (m) openSheet(profileSheet(m));
  }

  /* ---------- my profile ---------- */

  function pageMe() {
    var u = state.me;
    var p = u.profile;
    var first = !u.hasProfile;
    var opt = function (list, val) { return list.map(function (i) { return '<option ' + (val === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join(''); };
    return page('<div class="page-head"><h1>' + (first ? 'Welcome. Fill in your profile' : 'Edit your profile') + '</h1></div>' +
      (first ? '<p class="lead measure" style="margin-top:-8px">This is how other members find you. It takes a minute, and you can change it any time.</p>' : '') +
      '<div class="two" style="margin-top:28px"><form class="form-grid" id="profileForm" novalidate>' +
      '<label>Name<input type="text" name="name" value="' + esc(u.name) + '" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Role<input type="text" name="role" value="' + esc(p.role) + '" maxlength="60" dir="auto" placeholder="Product Manager"><span class="field-error" data-err="role"></span></label>' +
      '<label>Company<input type="text" name="company" value="' + esc(p.company) + '" maxlength="60" dir="auto" placeholder="Where you work now"><span class="field-error" data-err="company"></span></label>' +
      '<label>Industry<select name="industry"><option value="">Choose one</option>' + opt(Core.INDUSTRIES, p.industry) + '</select><span class="field-error" data-err="industry"></span></label>' +
      '<label>Cohort <span class="hint">Set by leaders</span><input type="text" value="' + esc(cohortLabel(u.cohort)) + '" disabled></label>' +
      '<label>I can help with <span class="hint">Separate with commas, up to 6</span><input type="text" name="help" value="' + esc(p.help.join(', ')) + '" maxlength="250" dir="auto" placeholder="PM interviews, fundraising"><span class="field-error" data-err="help"></span></label>' +
      '<label>I\'m looking for <span class="hint">Separate with commas, up to 6</span><input type="text" name="looking" value="' + esc(p.looking.join(', ')) + '" maxlength="250" dir="auto" placeholder="Co-founder, PM roles"><span class="field-error" data-err="looking"></span></label>' +
      '<div class="field">Open to<div class="checks">' + Core.OPEN_TO.map(function (o) { return '<label><input type="checkbox" name="open_to" value="' + esc(o) + '" ' + (p.open_to.indexOf(o) !== -1 ? 'checked' : '') + '> ' + esc(o) + '</label>'; }).join('') + '</div></div>' +
      '<label>Short bio <span class="hint">Up to 280 characters</span><textarea name="bio" maxlength="280" rows="3" dir="auto">' + esc(p.bio) + '</textarea><span class="field-error" data-err="bio"></span></label>' +
      '<label>LinkedIn URL<input type="url" name="linkedin" value="' + esc(p.linkedin) + '" placeholder="https://www.linkedin.com/in/..."><span class="field-error" data-err="linkedin"></span></label>' +
      '<label>WhatsApp number <span class="hint">Optional, with the country code</span><input type="tel" name="phone" value="' + esc(p.phone) + '" placeholder="+972..."><span class="field-error" data-err="phone"></span></label>' +
      '<label class="check-line"><input type="checkbox" name="show_phone" ' + (p.show_phone ? 'checked' : '') + '> Show a WhatsApp button on my profile</label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save profile</button><span class="muted small">Your photo comes from your Google account.</span></div>' +
      '</form><div class="sticky"><div class="preview-label">How others see you</div><div class="preview"><div class="sheet" id="preview"></div></div></div></div>');
  }

  function readProfileForm(f) {
    var fd = new FormData(f);
    return {
      name: String(fd.get('name') || ''),
      profile: {
        role: fd.get('role'), company: fd.get('company'), industry: fd.get('industry'),
        help: fd.get('help'), looking: fd.get('looking'), open_to: fd.getAll('open_to'),
        bio: fd.get('bio'), linkedin: fd.get('linkedin'), phone: fd.get('phone'), show_phone: !!fd.get('show_phone')
      }
    };
  }

  function wireMe() {
    var f = $('#profileForm');
    var u = state.me;
    function preview() {
      var r = readProfileForm(f);
      var v = Core.validateProfile(r.profile).value;
      v.photo = u.profile.photo;
      if (!v.show_phone) delete v.phone;
      $('#preview').innerHTML = profileSheet({ id: u.id, name: r.name || u.name, tier: u.tier, cohort: u.cohort, joined: true, profile: v }, true);
    }
    f.addEventListener('input', preview);
    preview();
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(f);
      var r = readProfileForm(f);
      var check = Core.validateProfile(r.profile);
      var nameCheck = Core.validateName(r.name);
      var errs = check.errors;
      if (!nameCheck.ok) errs.name = nameCheck.error;
      if (Object.keys(errs).length) return showErrors(f, { message: 'Some fields need fixing', fields: errs });
      var btn = $('button[type=submit]', f);
      setBusy(btn, true);
      try {
        var res = await Api.call('saveProfile', r);
        state.me = res.me;
        state.directory = null;
        toast('Profile saved');
        go('#/members');
      } catch (err) {
        setBusy(btn, false);
        if (err.code !== 'unauthorized') showErrors(f, err);
        else render();
      }
    });
  }

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

  /* ---------- admin ---------- */

  function pageAdmin() {
    if (state.me.tier !== 'leader') return page('<div class="note warn">Admin is for leaders only.</div>');
    return page('<div class="page-head"><h1>Admin</h1><span class="count">Who\'s in, and who sees what</span></div><div id="adminBody">' + loading('Loading members') + '</div>');
  }

  async function wireAdmin() {
    if (state.me.tier !== 'leader') return;
    var data;
    try {
      data = await Api.call('admin.overview');
    } catch (e) {
      if (e.code === 'unauthorized' || e.code === 'forbidden') return refreshMe();
      $('#adminBody').innerHTML = errorBlock(e);
      return wireRetry();
    }
    var tiers = Core.TIERS;
    var tierSelect = function (attr, val) {
      return '<select ' + attr + '>' + tiers.map(function (t) { return '<option value="' + t + '" ' + (val === t ? 'selected' : '') + '>' + esc(TIER_LABEL[t]) + '</option>'; }).join('') + '</select>';
    };
    var pending = data.requests.filter(function (r) { return r.status === 'pending'; });
    var unclaimed = data.members.filter(function (m) { return !m.email; });

    var requestsHtml = pending.length ? pending.map(function (r) {
      var guess = bestMatch(r.name, unclaimed);
      return '<div class="request" data-request="' + esc(r.id) + '"><div><span class="who" dir="auto">' + esc(r.name) + '</span> <span class="muted">' + esc(r.email) + '</span>' +
        (r.note ? '<div class="muted small" dir="auto">"' + esc(r.note) + '"</div>' : '') + '</div>' +
        '<div class="row-actions"><select data-link aria-label="Link to"><option value="">Add as a new member</option>' +
        unclaimed.map(function (m) { return '<option value="' + esc(m.id) + '" ' + (guess && guess.id === m.id ? 'selected' : '') + '>Link to ' + esc(m.name) + (m.cohort ? ', ' + esc(cohortLabel(m.cohort)) : '') + '</option>'; }).join('') +
        '</select>' + tierSelect('data-new-tier aria-label="Tier for a new member"', 'community') +
        '<button class="btn gold small" data-approve>Approve</button><button class="btn quiet small" data-decline>Decline</button></div></div>';
    }).join('') : '<p class="muted">No requests waiting.</p>';

    $('#adminBody').innerHTML =
      '<section class="admin-section" style="margin-top:8px"><h2>Access requests' + (pending.length ? ' <span class="badge">' + pending.length + '</span>' : '') + '</h2>' + requestsHtml + '</section>' +

      '<section class="admin-section"><h2>Who sees whom in the directory</h2><div class="table-wrap matrix"><table class="matrix">' +
      '<thead><tr><th>Viewer</th>' + tiers.map(function (t) { return '<th>Sees ' + esc(TIER_LABEL[t]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tiers.map(function (v) {
        return '<tr><td>' + esc(TIER_LABEL[v]) + '</td>' + tiers.map(function (s) {
          return '<td><input type="checkbox" aria-label="' + esc(TIER_LABEL[v] + ' sees ' + TIER_LABEL[s]) + '" data-rule="' + v + ':' + s + '" ' + (data.rules[v][s] ? 'checked' : '') + ' ' + (v === 'leader' ? 'disabled' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="muted small" style="margin-top:10px">Leaders always see everyone. Changes apply on each member\'s next page load.</p></section>' +

      '<section class="admin-section"><h2>Add people</h2><div class="form-grid" style="max-width:720px">' +
      '<label>One per line, as "Name, email" <span class="hint">The email is optional. People without one can ask for access and you link them.</span><textarea id="bulk" rows="4" placeholder="Shir Amar, shir.amar@gmail.com&#10;Ben Tal"></textarea></label>' +
      '<div class="add-row"><label>Tier ' + tierSelect('id="bulkTier"', 'club') + '</label>' +
      '<label>Cohort number <input type="text" id="bulkCohort" inputmode="numeric" placeholder="2" maxlength="20" style="width:120px"></label>' +
      '<button class="btn gold" id="bulkAdd">Add</button></div><div id="bulkResult"></div></div></section>' +

      '<section class="admin-section"><div class="page-head" style="margin-bottom:14px"><h2 style="font-size:1.75rem">Members</h2><span class="count">' + data.members.length + '</span><span class="spacer"></span>' +
      '<input type="search" id="adminFilter" placeholder="Filter by name or email" aria-label="Filter members" style="max-width:260px"><button class="btn quiet small" id="exportCsv">Export CSV</button></div>' +
      '<div class="table-wrap"><table class="members-table"><thead><tr><th>Name</th><th>Google email</th><th>Tier</th><th>Cohort</th><th>Active</th><th></th></tr></thead><tbody>' +
      data.members.map(function (m) {
        var self = m.id === state.me.id;
        return '<tr data-member="' + esc(m.id) + '" data-search="' + esc((m.name + ' ' + m.email).toLowerCase()) + '">' +
          '<td><input type="text" data-f="name" value="' + esc(m.name) + '" maxlength="60" dir="auto" aria-label="Name"></td>' +
          '<td><input type="email" data-f="email" value="' + esc(m.email) + '" placeholder="Not linked yet" aria-label="Email"></td>' +
          '<td>' + tierSelect('data-f="tier" aria-label="Tier"' + (self ? ' disabled' : ''), m.tier) + '</td>' +
          '<td><input type="text" data-f="cohort" value="' + esc(m.cohort) + '" maxlength="20" aria-label="Cohort"></td>' +
          '<td><input type="checkbox" data-f="active" aria-label="Active" ' + (m.active ? 'checked' : '') + (self ? ' disabled' : '') + '></td>' +
          '<td><button class="btn quiet small" data-save>Save</button></td></tr>';
      }).join('') + '</tbody></table></div></section>';

    $$('[data-rule]').forEach(function (c) {
      c.addEventListener('change', async function () {
        var parts = c.dataset.rule.split(':');
        c.disabled = true;
        try {
          await Api.call('admin.setRule', { viewer: parts[0], subject: parts[1], value: c.checked });
          state.directory = null;
          toast('Rule saved');
        } catch (e) { c.checked = !c.checked; toast(e.message); }
        c.disabled = false;
      });
    });

    $$('[data-request]').forEach(function (row) {
      async function decide(decision, btn) {
        setBusy(btn, true, decision === 'approve' ? 'Approving…' : 'Declining…');
        try {
          await Api.call('admin.handleRequest', { requestId: row.dataset.request, decision: decision, memberId: $('[data-link]', row).value || undefined, tier: $('[data-new-tier]', row).value });
          state.directory = null;
          toast(decision === 'approve' ? 'Approved. They can sign in now' : 'Declined');
          wireAdmin();
        } catch (e) { setBusy(btn, false); toast(e.message); }
      }
      $('[data-approve]', row).addEventListener('click', function (e) { decide('approve', e.target); });
      $('[data-decline]', row).addEventListener('click', function (e) { decide('decline', e.target); });
      var link = $('[data-link]', row);
      var syncTier = function () { $('[data-new-tier]', row).style.display = link.value ? 'none' : ''; };
      link.addEventListener('change', syncTier);
      syncTier();
    });

    $('#bulkAdd').addEventListener('click', async function (e) {
      var btn = e.target;
      setBusy(btn, true, 'Adding…');
      try {
        var r = await Api.call('admin.addMembers', { lines: $('#bulk').value, tier: $('#bulkTier').value, cohort: $('#bulkCohort').value });
        state.directory = null;
        toast(r.added + ' added');
        await wireAdmin();
        if (r.skipped.length) {
          $('#bulkResult').innerHTML = '<div class="note warn">Skipped:<br>' + r.skipped.map(function (s) { return esc(s.line) + ': ' + esc(s.reason); }).join('<br>') + '</div>';
        }
      } catch (err) { setBusy(btn, false); toast(err.message); }
    });

    $$('[data-member]').forEach(function (row) {
      $('[data-save]', row).addEventListener('click', async function (e) {
        var btn = e.target;
        var val = function (f) { var el = $('[data-f="' + f + '"]', row); return el.type === 'checkbox' ? el.checked : el.value; };
        setBusy(btn, true, 'Saving…');
        try {
          await Api.call('admin.saveMember', { member: { id: row.dataset.member, name: val('name'), email: val('email'), tier: val('tier'), cohort: val('cohort'), active: val('active') } });
          state.directory = null;
          setBusy(btn, false);
          toast('Saved');
        } catch (err) { setBusy(btn, false); toast(err.message); }
      });
    });

    $('#adminFilter').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      $$('[data-member]').forEach(function (row) { row.style.display = !q || row.dataset.search.indexOf(q) !== -1 ? '' : 'none'; });
    });

    $('#exportCsv').addEventListener('click', async function (e) {
      var btn = e.target;
      setBusy(btn, true, 'Exporting…');
      try {
        var r = await Api.call('admin.export');
        var url = URL.createObjectURL(new Blob(['﻿' + r.csv], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      } catch (err) { toast(err.message); }
      setBusy(btn, false);
    });
  }

  // Picks the unclaimed member whose name shares the most words with the request.
  function bestMatch(name, candidates) {
    var words = String(name || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
    var best = null;
    var bestScore = 0;
    candidates.forEach(function (m) {
      var mine = m.name.toLowerCase();
      var score = words.filter(function (w) { return mine.indexOf(w) !== -1; }).length;
      if (score > bestScore) { best = m; bestScore = score; }
    });
    return best;
  }

  /* ---------- router ---------- */

  function wireRetry() {
    $$('[data-retry]').forEach(function (b) { b.addEventListener('click', render); });
  }

  async function refreshMe() {
    state.me = null;
    if (!Api.session()) return render();
    try {
      state.me = (await Api.call('me')).me;
    } catch (e) {
      if (e.code !== 'unauthorized') { $('#app').innerHTML = errorBlock(e); return wireRetry(); }
    }
    render();
  }

  var MEMBER_ROUTES = { '#/members': [pageMembers, wireMembers], '#/me': [pageMe, wireMe], '#/admin': [pageAdmin, wireAdmin] };

  function render() {
    var parts = (location.hash || '#/').split('?');
    var route = parts[0];
    var params = new URLSearchParams(parts[1] || '');
    renderNav(route);
    $('#nav').classList.remove('open');
    $('#menuBtn').setAttribute('aria-expanded', 'false');
    closeSheet();
    var app = $('#app');

    if (MEMBER_ROUTES[route]) {
      if (!state.me) {
        app.innerHTML = Api.guest() && state.guest ? pageRequest() : pageNeedLogin();
        wireRequest();
      } else {
        app.innerHTML = MEMBER_ROUTES[route][0]();
        MEMBER_ROUTES[route][1]();
      }
    } else if (route === '#/request') {
      app.innerHTML = pageRequest();
      wireRequest();
    } else if (route === '#/denied') {
      app.innerHTML = pageDenied(params.get('e'));
    } else if (route === '#/about') {
      app.innerHTML = pageAbout();
    } else if (route === '#/meetings') {
      app.innerHTML = pageMeetings();
      var target = params.get('m') && document.getElementById('m-' + params.get('m'));
      if (target) { mountSignIn(); return target.scrollIntoView(); }
    } else if (route === '#/partners') {
      app.innerHTML = pagePartners();
    } else if (route === '#/join') {
      app.innerHTML = pageJoin();
    } else {
      app.innerHTML = pageHome();
    }
    mountSignIn();
    window.scrollTo(0, 0);
  }

  $('#menuBtn').innerHTML = icon('menu');
  $('#menuBtn').addEventListener('click', function () {
    var open = $('#nav').classList.toggle('open');
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', render);
  if (CONFIG.ENV !== 'production') $('#envNote').textContent = CONFIG.ENV + ' build with test data';
  refreshMe();
})();
