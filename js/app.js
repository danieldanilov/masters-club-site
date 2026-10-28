// The Masters Club site: hash routes, Google sign-in, directory, profile editor, admin.
(function () {
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = Core.escapeHtml;
  var COLORS = ['#3b5b8c', '#8c5a3b', '#2f7d5b', '#7a3b8c', '#8c3b4f', '#3b7a8c', '#6b6b2f', '#4f3b8c'];
  var TIER_LABEL = Core.TIER_LABEL;

  var state = {
    me: null,          // signed-in member, from signIn or me
    booted: false,
    directory: null,   // last directory response
    dir: { q: '', cohort: '', industry: '', open: [] },
    guest: null        // {email, name, request} after an unknown sign-in
  };

  /* ---------- small helpers ---------- */

  function initials(n) {
    return String(n || '?').split(/\s+/).filter(Boolean).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
  }
  function colorFor(key) {
    var s = String(key || '');
    var sum = 0;
    for (var i = 0; i < s.length; i++) sum += s.charCodeAt(i);
    return COLORS[sum % COLORS.length];
  }
  function avatar(person, cls, style) {
    var photo = person.profile && person.profile.photo;
    var extra = style ? ';' + style : '';
    if (photo) return '<img class="avatar ' + (cls || '') + '" style="' + extra.slice(1) + '" src="' + esc(photo) + '" alt="" referrerpolicy="no-referrer">';
    return '<div class="avatar ' + (cls || '') + '" style="background:' + colorFor(person.id || person.name) + extra + '" aria-hidden="true">' + esc(initials(person.name)) + '</div>';
  }
  function tierTag(t) {
    return '<span class="tag tier-' + esc(t) + '">' + esc(TIER_LABEL[t] || t) + '</span>';
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
    return '<section class="block"><div class="wrap" style="max-width:640px"><div class="note warn">' + esc(err.message || 'Something went wrong') + '</div>' +
      '<p><button class="btn light" data-retry>Try again</button></p></div></section>';
  }
  function section(inner, style) {
    return '<section class="block"' + (style ? ' style="' + style + '"' : '') + '><div class="wrap">' + inner + '</div></section>';
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Saving…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* ---------- modal ---------- */

  function openModal(html) {
    $('#modal').innerHTML = '<button class="close" data-close aria-label="Close">×</button>' + html;
    $('#scrim').classList.add('open');
    $('#modal [data-close]').addEventListener('click', closeModal);
  }
  function closeModal() { $('#scrim').classList.remove('open'); }
  $('#scrim').addEventListener('click', function (e) { if (e.target.id === 'scrim') closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

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
          '<button class="btn google" type="submit">Sign in (dev)</button></form>';
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
        google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 260 });
      });
    }).catch(function (e) {
      slots.forEach(function (slot) { slot.innerHTML = '<div class="note warn">' + esc(e.message) + '. Disable blockers for this site and reload.</div>'; });
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
    var links = [['#/', 'Home'], ['#/about', 'About'], ['#/partners', 'Partners'], ['#/join', 'Join']];
    var html = links.map(function (l) { return '<a href="' + l[0] + '" class="' + (route === l[0] ? 'active' : '') + '">' + l[1] + '</a>'; }).join('');
    if (state.me) {
      html += '<a href="#/members" class="' + (route === '#/members' ? 'active' : '') + '">Directory</a>';
      html += '<a href="#/me" class="' + (route === '#/me' ? 'active' : '') + '">My profile</a>';
      if (state.me.tier === 'leader') html += '<a href="#/admin" class="' + (route === '#/admin' ? 'active' : '') + '">Admin</a>';
      html += '<a href="#/" data-signout>Sign out</a>';
    } else {
      html += '<a href="#/members" class="btn gold small" style="margin-left:8px;color:#fff">Members sign in</a>';
    }
    $('#nav').innerHTML = html;
    var so = $('[data-signout]');
    if (so) so.addEventListener('click', function (e) { e.preventDefault(); signOut(); });
  }

  /* ---------- public pages ---------- */

  function pageHome() {
    var c = CONTENT;
    return '<section class="hero"><div class="wrap">' +
      '<div class="eyebrow">' + esc(c.established) + '</div><h1>The Masters Club</h1>' +
      '<p class="lead">' + esc(c.tagline) + '</p>' +
      '<div class="ctas"><a class="btn gold" href="#/join">Apply for the next cohort</a><a class="btn ghost" href="#/partners" style="color:#fff">Partner with us</a></div>' +
      '<div class="stats">' + c.stats.map(function (s) { return '<div><b>' + esc(s.value) + '</b><span>' + esc(s.label) + '</span></div>'; }).join('') + '</div>' +
      '</div></section>' +
      section('<div class="eyebrow">What it is</div><h2>Small rooms, real people</h2><div class="grid cols-3" style="margin-top:20px">' +
        '<div class="card"><h3>The club</h3><p class="muted">A hand-picked cohort each semester, meeting for curated sessions with founders, operators and investors.</p></div>' +
        '<div class="card"><h3>The community</h3><p class="muted">Everyone who has been through a cohort, for life. Dinners, low-key meetups and a member directory.</p></div>' +
        '<div class="card"><h3>Give first</h3><p class="muted">Membership means helping each other: intros, advice, jobs. You get what you put in.</p></div></div>') +
      section('<div class="card" style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between"><div>' +
        '<div class="eyebrow">Next meeting</div><h3 style="margin-top:6px">' + esc(c.nextMeeting.title) + '</h3>' +
        '<p class="muted" style="margin:0">' + esc(c.nextMeeting.note) + '</p></div><a class="btn light" href="#/join">How to join</a></div>', 'padding-top:0');
  }

  function pageAbout() {
    return section('<div class="eyebrow">About</div><h2>Who runs it</h2>' +
      '<p class="muted" style="max-width:640px">The club is the current cohort. The community is everyone who has been through it. Both are run by volunteers who are Reichman students.</p>' +
      '<div class="grid cols-3" style="margin-top:24px">' + CONTENT.leaders.map(function (p) {
        return '<div class="card person">' + avatar({ name: p.name }) + '<div><div class="name">' + esc(p.name) + '</div><div class="muted" style="font-size:14px">' + esc(p.role) + '</div></div></div>';
      }).join('') + '</div>');
  }

  function pagePartners() {
    var c = CONTENT;
    var cta = c.partnerEmail ? '<div style="margin-top:24px"><a class="btn gold" href="mailto:' + esc(c.partnerEmail) + '?subject=Partnering%20with%20the%20Masters%20Club">Talk to us about partnering</a></div>' : '';
    return section('<div class="eyebrow">Partners</div><h2>Work with the club</h2>' +
      '<p class="muted" style="max-width:640px">We partner slowly and choose companies whose involvement helps our members.</p>' +
      c.partners.map(function (p) {
        return '<div class="card" style="margin:20px 0;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div class="avatar" style="background:' + esc(p.color) + ';border-radius:12px">' + esc(p.initial) + '</div>' +
          '<div><div class="name">' + esc(p.name) + '</div><div class="muted" style="font-size:14px">' + esc(p.note) + '</div></div></div>';
      }).join('') +
      '<div class="grid cols-3">' + c.partnerTiers.map(function (t) {
        return '<div class="card"><div class="eyebrow">' + esc(t.name) + '</div><h3 style="margin-top:6px">' + esc(t.price) + '</h3><p class="muted">' + esc(t.detail) + '</p></div>';
      }).join('') + '</div>' + cta);
  }

  function pageJoin() {
    return section('<div class="eyebrow">Join</div><h2>Two ways in</h2><div class="grid cols-2" style="margin-top:20px">' +
      '<div class="card"><h3>Apply to a cohort</h3><p class="muted">Open to Reichman master\'s students across programmes. Up to 50 members per cohort, activity in English.</p>' +
      '<a class="btn gold" href="' + esc(CONTENT.applyUrl) + '" target="_blank" rel="noopener">Application form</a></div>' +
      '<div class="card"><h3>Already been through a cohort?</h3><p class="muted">You\'re in the community for life. Sign in with Google. If we don\'t have your email yet, you can ask a leader to add you in one step.</p>' +
      '<div class="gsi-slot"></div></div></div>');
  }

  function pageNeedLogin() {
    return '<section class="block"><div class="wrap" style="max-width:560px;text-align:center"><h2>Members only</h2>' +
      '<p class="muted">Sign in with your Google account. No new password, and you stay signed in for 30 days.</p><div class="gsi-slot"></div></div></section>';
  }

  function pageDenied(email) {
    return '<section class="block"><div class="wrap" style="max-width:640px">' +
      '<div class="note warn"><b>' + esc(email || 'This account') + '</b> is on the list but marked inactive.</div>' +
      '<h2 style="margin-top:24px">Can\'t get in?</h2><p class="muted">Ask one of the leaders on WhatsApp to reactivate you, or sign in with another Google account.</p>' +
      '<div class="gsi-slot" style="justify-content:flex-start"></div></div></section>';
  }

  /* ---------- access request (guests) ---------- */

  function pageRequest() {
    var g = state.guest;
    if (!g || !Api.guest()) return pageNeedLogin();
    if (g.request && g.request.status === 'pending') {
      return '<section class="block"><div class="wrap" style="max-width:640px"><div class="eyebrow">Access request</div><h2>You\'re on the waiting list</h2>' +
        '<p class="muted">We got your request for <b>' + esc(g.email) + '</b>. A leader will link it to your name, and then you can sign in. Nothing else to do.</p>' +
        '<p><button class="btn light" data-signout-guest>Use another Google account</button></p></div></section>';
    }
    return '<section class="block"><div class="wrap" style="max-width:640px"><div class="eyebrow">Access request</div><h2>We don\'t have this email yet</h2>' +
      '<p class="muted">You signed in as <b>' + esc(g.email) + '</b>, which isn\'t on the members list. If you\'re in a cohort, send this and a leader will link it to your name.</p>' +
      '<form class="form-grid card" id="requestForm" novalidate>' +
      '<label>Your full name<input type="text" name="name" maxlength="60" required dir="auto" value="' + esc(g.name) + '"><span class="field-error" data-err="name"></span></label>' +
      '<label>Anything that helps us find you <span class="hint">Your cohort, or the name you use on WhatsApp</span><textarea name="note" maxlength="280" rows="2" dir="auto"></textarea><span class="field-error" data-err="note"></span></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Send request</button><button class="btn light" type="button" data-signout-guest>Use another account</button></div></form></div></section>';
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
    return '<section class="block"><div class="wrap"><div class="dir-head"><div><div class="eyebrow">Members</div><h2 style="margin:4px 0 0">Directory</h2></div>' +
      '<a class="btn light small" href="#/me">Edit my profile</a></div><div id="dirBody">' + loading('Loading the directory') + '</div></div></section>';
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
    var cohorts = Array.from(new Set(d.members.map(function (m) { return m.cohort; }).filter(Boolean))).sort();
    var hidden = d.hiddenTiers.length
      ? '<div class="note info" style="margin-bottom:14px">You\'re viewing as <b>' + esc(TIER_LABEL[d.viewer.tier]) + '</b>, so ' + esc(d.hiddenTiers.map(function (t) { return TIER_LABEL[t]; }).join(', ')) + ' profiles are hidden from you.</div>'
      : '';
    var s = state.dir;
    $('#dirBody').innerHTML = hidden +
      '<label class="sr-only" for="q">Search members</label><input class="search" id="q" placeholder="Search name, company, role, or what someone can help with" value="' + esc(s.q) + '" dir="auto" autocomplete="off">' +
      '<div class="filters"><select id="fCohort" aria-label="Cohort"><option value="">All cohorts</option>' + cohorts.map(function (c) { return '<option ' + (s.cohort === c ? 'selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<select id="fIndustry" aria-label="Industry"><option value="">All industries</option>' + Core.INDUSTRIES.map(function (i) { return '<option ' + (s.industry === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join('') + '</select>' +
      Core.OPEN_TO.map(function (o) { return '<button class="chip ' + (s.open.indexOf(o) !== -1 ? 'on' : '') + '" data-open="' + esc(o) + '" aria-pressed="' + (s.open.indexOf(o) !== -1) + '">' + esc(o) + '</button>'; }).join('') +
      '</div><div class="count" id="count" aria-live="polite"></div><div class="grid cols-2" id="results" style="margin-top:12px"></div>' +
      '<div class="card" style="margin-top:28px"><div class="eyebrow">Jobs, events and chat live in WhatsApp</div><div class="wa-list" style="margin-top:8px">' +
      CONTENT.whatsappGroups.map(function (g) {
        return g.url
          ? '<a href="' + esc(g.url) + '" target="_blank" rel="noopener"><span>' + esc(g.name) + '</span><span class="pill-green">Open in WhatsApp →</span></a>'
          : '<a><span>' + esc(g.name) + '</span><span class="inline-note">Ask a leader for the link</span></a>';
      }).join('') + '</div></div>';

    function draw() {
      var list = Core.searchMembers(d.members, s.q, { cohort: s.cohort, industry: s.industry, open: s.open });
      $('#count').textContent = list.length + ' member' + (list.length === 1 ? '' : 's');
      $('#results').innerHTML = list.length ? list.map(memberCard).join('') : '<div class="card muted">Nobody matches. Try fewer filters.</div>';
      $$('#results .member-card').forEach(function (c) {
        c.addEventListener('click', function () { openProfile(c.dataset.id); });
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter') openProfile(c.dataset.id); });
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
    var line = p.role ? esc(p.role) + (p.company ? ' @ ' + esc(p.company) : '') : (p.company ? esc(p.company) : '<i>Profile not filled in yet</i>');
    return '<div class="card member-card" data-id="' + esc(m.id) + '" tabindex="0" role="button"><div class="person">' + avatar(m) + '<div style="min-width:0">' +
      '<div class="name" dir="auto">' + esc(m.name) + '</div><div class="muted" style="font-size:14px" dir="auto">' + line + '</div>' +
      '<div class="tags">' + tierTag(m.tier) + (m.cohort ? '<span class="tag">Cohort ' + esc(m.cohort) + '</span>' : '') + (p.industry ? '<span class="tag">' + esc(p.industry) + '</span>' : '') +
      (m.joined ? '' : '<span class="tag unjoined">Not signed in yet</span>') + '</div>' +
      (p.help.length ? '<div class="muted" style="font-size:13px;margin-top:8px" dir="auto">Can help with: ' + esc(p.help.join(', ')) + '</div>' : '') +
      '</div></div></div>';
  }

  function profileCard(m, preview) {
    var p = m.profile;
    var wa = p.phone ? '<a class="btn gold small" href="https://wa.me/' + esc(String(p.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener">WhatsApp</a>' : '';
    var li = p.linkedin ? '<a class="btn light small" href="' + esc(p.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>' : '';
    function tags(label, arr) {
      return arr && arr.length ? '<p style="margin:12px 0 4px;font-size:13px;font-weight:600">' + label + '</p><div class="tags" style="margin-top:0">' + arr.map(function (h) { return '<span class="tag" dir="auto">' + esc(h) + '</span>'; }).join('') + '</div>' : '';
    }
    var actions = wa || li ? '<div class="actions" style="justify-content:center">' + wa + li + '</div>' : (preview ? '' : '<p class="inline-note" style="text-align:center">No contact links yet.</p>');
    return '<div style="text-align:center">' + avatar(m, 'lg', 'margin:0 auto 12px') +
      '<h3 style="margin-bottom:2px" dir="auto">' + esc(m.name) + '</h3>' +
      '<div class="muted" dir="auto">' + (p.role ? esc(p.role) + (p.company ? ' @ ' + esc(p.company) : '') : 'No role yet') + '</div>' +
      '<div class="tags" style="justify-content:center">' + tierTag(m.tier) + (m.cohort ? '<span class="tag">Cohort ' + esc(m.cohort) + '</span>' : '') + (p.industry ? '<span class="tag">' + esc(p.industry) + '</span>' : '') + '</div></div>' +
      (p.bio ? '<p style="margin-top:16px;white-space:pre-line" dir="auto">' + esc(p.bio) + '</p>' : '') +
      tags('I can help with', p.help) + tags('I\'m looking for', p.looking) + tags('Open to', p.open_to) + actions;
  }

  function openProfile(id) {
    var m = state.directory && state.directory.members.filter(function (x) { return x.id === id; })[0];
    if (m) openModal(profileCard(m));
  }

  /* ---------- my profile ---------- */

  function pageMe() {
    var u = state.me;
    var p = u.profile;
    var first = !u.hasProfile;
    var opt = function (list, val) { return list.map(function (i) { return '<option ' + (val === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join(''); };
    return '<section class="block"><div class="wrap"><div class="eyebrow">My profile</div><h2>' + (first ? 'Welcome. Fill in your profile' : 'Edit your profile') + '</h2>' +
      (first ? '<div class="note" style="margin-bottom:20px">This is how other members find you. It takes a minute, and you can change it any time.</div>' : '') +
      '<div class="two"><form class="form-grid card" id="profileForm" novalidate>' +
      '<label>Name<input type="text" name="name" value="' + esc(u.name) + '" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Role<input type="text" name="role" value="' + esc(p.role) + '" maxlength="60" dir="auto" placeholder="Product Manager"><span class="field-error" data-err="role"></span></label>' +
      '<label>Company<input type="text" name="company" value="' + esc(p.company) + '" maxlength="60" dir="auto" placeholder="Where you work now"><span class="field-error" data-err="company"></span></label>' +
      '<label>Industry<select name="industry"><option value="">Choose one</option>' + opt(Core.INDUSTRIES, p.industry) + '</select><span class="field-error" data-err="industry"></span></label>' +
      '<label>Cohort <span class="hint">Set by leaders</span><input type="text" value="' + esc(u.cohort) + '" disabled></label>' +
      '<label>I can help with <span class="hint">Comma-separated, up to 6</span><input type="text" name="help" value="' + esc(p.help.join(', ')) + '" maxlength="250" dir="auto" placeholder="PM interviews, fundraising"><span class="field-error" data-err="help"></span></label>' +
      '<label>I\'m looking for <span class="hint">Comma-separated, up to 6</span><input type="text" name="looking" value="' + esc(p.looking.join(', ')) + '" maxlength="250" dir="auto" placeholder="Co-founder, PM roles"><span class="field-error" data-err="looking"></span></label>' +
      '<label>Open to<div class="checks">' + Core.OPEN_TO.map(function (o) { return '<label><input type="checkbox" name="open_to" value="' + esc(o) + '" ' + (p.open_to.indexOf(o) !== -1 ? 'checked' : '') + '> ' + esc(o) + '</label>'; }).join('') + '</div></label>' +
      '<label>Short bio <span class="hint">Up to 280 characters</span><textarea name="bio" maxlength="280" rows="3" dir="auto">' + esc(p.bio) + '</textarea><span class="field-error" data-err="bio"></span></label>' +
      '<label>LinkedIn URL<input type="url" name="linkedin" value="' + esc(p.linkedin) + '" placeholder="https://www.linkedin.com/in/..."><span class="field-error" data-err="linkedin"></span></label>' +
      '<label>WhatsApp number <span class="hint">Optional, with country code</span><input type="tel" name="phone" value="' + esc(p.phone) + '" placeholder="+972..."><span class="field-error" data-err="phone"></span></label>' +
      '<div class="checks"><label><input type="checkbox" name="show_phone" ' + (p.show_phone ? 'checked' : '') + '> Show a WhatsApp button on my profile</label></div>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save profile</button><span class="inline-note">Your photo comes from your Google account.</span></div>' +
      '</form><div class="sticky"><div class="eyebrow" style="margin-bottom:8px">How others see you</div><div class="card" id="preview"></div></div></div></div></section>';
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
      $('#preview').innerHTML = profileCard({ id: u.id, name: r.name || u.name, tier: u.tier, cohort: u.cohort, profile: v }, true);
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
    if (state.me.tier !== 'leader') return section('<div class="note warn">Admin is for leaders only.</div>');
    return '<section class="block"><div class="wrap"><div class="eyebrow">Admin · leaders only</div><h2>Who\'s in, and who sees what</h2><div id="adminBody">' + loading('Loading members') + '</div></div></section>';
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
    var cohorts = Array.from(new Set(data.members.map(function (m) { return m.cohort; }).filter(Boolean))).sort();

    var requestsHtml = pending.length ? pending.map(function (r) {
      var guess = bestMatch(r.name, unclaimed);
      return '<div class="request" data-request="' + esc(r.id) + '"><div><b dir="auto">' + esc(r.name) + '</b> <span class="muted">' + esc(r.email) + '</span>' +
        (r.note ? '<div class="inline-note" dir="auto">"' + esc(r.note) + '"</div>' : '') + '</div>' +
        '<div class="row-actions"><select data-link aria-label="Link to"><option value="">Add as a new member</option>' +
        unclaimed.map(function (m) { return '<option value="' + esc(m.id) + '" ' + (guess && guess.id === m.id ? 'selected' : '') + '>Link to ' + esc(m.name) + ' (' + esc(m.cohort || 'no cohort') + ')</option>'; }).join('') +
        '</select>' + tierSelect('data-new-tier aria-label="Tier for a new member"', 'community') +
        '<button class="btn gold small" data-approve>Approve</button><button class="btn light small" data-decline>Decline</button></div></div>';
    }).join('') : '<p class="muted">No requests waiting.</p>';

    $('#adminBody').innerHTML =
      '<div class="admin-section"><h3>Access requests ' + (pending.length ? '<span class="badge">' + pending.length + '</span>' : '') + '</h3><div class="card">' + requestsHtml + '</div></div>' +

      '<div class="admin-section"><h3>Rules: who can see whom in the directory</h3><div class="table-wrap"><table class="matrix">' +
      '<thead><tr><th>Viewer ↓ sees →</th>' + tiers.map(function (t) { return '<th>' + esc(TIER_LABEL[t]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tiers.map(function (v) {
        return '<tr><td><b>' + esc(TIER_LABEL[v]) + '</b></td>' + tiers.map(function (s) {
          return '<td><input type="checkbox" aria-label="' + esc(TIER_LABEL[v] + ' sees ' + TIER_LABEL[s]) + '" data-rule="' + v + ':' + s + '" ' + (data.rules[v][s] ? 'checked' : '') + ' ' + (v === 'leader' ? 'disabled' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="inline-note">Leaders always see everyone. Changes apply on each member\'s next page load.</p></div>' +

      '<div class="admin-section"><h3>Add people</h3><div class="card form-grid">' +
      '<label>One per line, as "Name, email". The email is optional: people without one can ask for access and you link them.<textarea id="bulk" rows="4" placeholder="Shir Amar, shir.amar@gmail.com&#10;Ben Tal"></textarea></label>' +
      '<div class="row-actions"><label style="display:flex;gap:8px;align-items:center">Tier ' + tierSelect('id="bulkTier"', 'club') + '</label>' +
      '<label style="display:flex;gap:8px;align-items:center">Cohort <input type="text" id="bulkCohort" list="cohortList" placeholder="2026-27" maxlength="20" style="width:110px"></label>' +
      '<datalist id="cohortList">' + cohorts.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
      '<button class="btn gold" id="bulkAdd">Add</button></div><div id="bulkResult"></div></div></div>' +

      '<div class="admin-section"><div class="dir-head"><h3 style="margin:0">Members (' + data.members.length + ')</h3><div class="row-actions">' +
      '<input type="text" id="adminFilter" placeholder="Filter by name or email" aria-label="Filter members"><button class="btn light small" id="exportCsv">Export CSV</button></div></div>' +
      '<div class="table-wrap"><table class="members-table"><thead><tr><th>Name</th><th>Google email</th><th>Tier</th><th>Cohort</th><th>Active</th><th></th></tr></thead><tbody>' +
      data.members.map(function (m) {
        var self = m.id === state.me.id;
        return '<tr data-member="' + esc(m.id) + '" data-search="' + esc((m.name + ' ' + m.email).toLowerCase()) + '">' +
          '<td><input type="text" data-f="name" value="' + esc(m.name) + '" maxlength="60" dir="auto" aria-label="Name"></td>' +
          '<td><input type="email" data-f="email" value="' + esc(m.email) + '" placeholder="Not linked yet" aria-label="Email"></td>' +
          '<td>' + tierSelect('data-f="tier" aria-label="Tier"' + (self ? ' disabled' : ''), m.tier) + '</td>' +
          '<td><input type="text" data-f="cohort" value="' + esc(m.cohort) + '" maxlength="20" style="min-width:80px;width:90px" aria-label="Cohort"></td>' +
          '<td><input type="checkbox" data-f="active" aria-label="Active" ' + (m.active ? 'checked' : '') + (self ? ' disabled' : '') + '></td>' +
          '<td><button class="btn light small" data-save>Save</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

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
          $('#bulkResult').innerHTML = '<div class="note warn" style="margin-top:8px">Skipped:<br>' + r.skipped.map(function (s) { return esc(s.line) + ': ' + esc(s.reason); }).join('<br>') + '</div>';
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
    closeModal();
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

  $('#menuBtn').addEventListener('click', function () {
    var open = $('#nav').classList.toggle('open');
    $('#menuBtn').setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', render);
  if (CONFIG.ENV !== 'production') $('#footer').textContent = 'The Masters Club · Reichman University · ' + CONFIG.ENV + ' build with test data';
  refreshMe();
})();
