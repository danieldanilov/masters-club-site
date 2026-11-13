// The public pages, and the pages for people who aren't signed in yet.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, avatar = App.avatar, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, longDate = App.longDate;

  var info = function () { return state.publicInfo || {}; };

  function pageHome() {
    var c = CONTENT;
    // The next public events from Admin, or content.js's next meeting until the API answers.
    var coming = (info().upcoming_events || []).map(function (e) {
      return { day: String(Number(e.date.slice(8))), month: longDate(e.date).split(' ')[1], title: e.title, note: Core.weekday(e.date) + ' at ' + e.time + (e.place ? ', ' + e.place : '') };
    });
    if (!coming.length && c.nextMeeting) coming = [c.nextMeeting];
    return '<section class="hero"><div class="tie" aria-hidden="true"></div><div class="wrap">' +
      '<h1>The Masters Club</h1>' +
      '<p class="lead">' + esc(c.tagline) + '</p>' +
      '<div class="actions on-navy"><a class="btn gold" href="join">Apply for the next cohort</a><a class="link" href="partners">Partner with us</a></div>' +
      '</div></section>' +
      '<div class="wrap">' +
      '<section class="split"><h2>A club and a community</h2><dl>' +
      '<div><dt>The club</dt><dd>' + esc(c.club) + '</dd></div>' +
      '<div><dt>The community</dt><dd>' + esc(c.community) + '</dd></div>' +
      '</dl></section></div>' +
      '<section class="statement"><div class="wrap"><p>' + esc(c.giveFirst) + ' <span>' + esc(c.giveFirstRest) + '</span></p></div></section>' +
      '<div class="wrap"><section class="past"><div class="past-head"><h2>In the past</h2><a class="link" href="meetings">All meetings</a></div>' +
      '<div class="rail">' + c.meetings.map(function (mt) {
        return '<a href="meetings?m=' + esc(mt.id) + '"><img src="' + esc(mt.poster) + '" alt="" loading="lazy" width="640" height="800">' +
          '<span class="who">' + esc(mt.speaker) + '</span><span class="when">' + esc(longDate(mt.date)) + '</span></a>';
      }).join('') + '</div></section>' +
      (coming.length ? '<section class="coming"><div class="past-head"><h2>In the future</h2>' +
        (state.me ? '<a class="link" href="events">All events</a>' : '<a class="link" href="join">How to join</a>') + '</div>' +
        coming.map(function (m) {
          return '<div class="event-row"><div class="date" aria-label="' + esc(m.day + ' ' + m.month) + '"><b>' + esc(m.day) + '</b><span>' + esc(m.month.slice(0, 3)) + '</span></div>' +
            '<span class="body"><h3 class="title" dir="auto">' + esc(m.title) + '</h3><span class="muted" dir="auto">' + esc(m.note) + '</span></span></div>';
        }).join('') + '</section>' : '') +
      '</div>';
  }

  // Why the club exists beside a field of the tie, then the people who run it as large square photos.
  function pageAbout() {
    return page('<section class="about-top"><div class="about-mission"><h1>Why the club exists</h1>' +
      '<p class="lead measure mission">' + esc(CONTENT.mission) + '</p></div>' +
      '<div class="tie-field" aria-hidden="true"></div></section>' +
      '<section class="about-people"><h2>Who runs it</h2>' +
      '<p class="lead measure">The club is the current cohort. The community is everyone who has been through it. Both are run by volunteers who are Reichman students.</p>' +
      '<div class="people">' + CONTENT.leaders.map(function (p) {
        return '<div class="person">' + avatar({ name: p.name, profile: { photo: p.photo } }, 'portrait') + '<div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.role) + '</div></div>';
      }).join('') + '</div></section>');
  }

  function pageMeetings() {
    var extra = (info().past_events || []).map(function (e) { return { id: e.id, date: e.date, kind: Core.EVENT_KINDS[e.kind] || '', speaker: e.title, role: e.place, quote: '', recap: e.recap, poster: e.poster, photos: [] }; });
    var list = CONTENT.meetings.concat(extra);
    return page('<h1>Past meetings</h1>' +
      '<p class="lead measure" style="margin-top:16px">Every meeting opens with food and structured networking, then a talk or workshop with someone worth hearing.</p>' +
      '<div class="meetings">' + list.map(function (m, i) {
        return '<article class="meeting" id="m-' + esc(m.id) + '">' +
          (m.poster ? '<img class="poster" src="' + esc(m.poster) + '" alt="Poster for ' + esc(m.speaker) + '" width="640" height="800"' + (i > 1 ? ' loading="lazy"' : '') + '>' : '') +
          '<div class="body">' +
          '<p class="meta"><time datetime="' + esc(m.date) + '">' + esc(longDate(m.date)) + '</time><span>' + esc(m.kind) + '</span></p>' +
          '<h2>' + esc(m.speaker) + '</h2><p class="muted role">' + esc(m.role) + '</p>' +
          (m.quote ? '<blockquote>' + esc(m.quote) + '</blockquote>' : '') +
          '<p class="recap">' + esc(m.recap) + '</p>' +
          (m.photos && m.photos.length ? '<div class="photos n' + m.photos.length + '">' + m.photos.map(function (p) {
            return '<img src="' + esc(p.src) + '" alt="' + esc(p.alt) + '" loading="lazy">';
          }).join('') + '</div>' : '') +
          '</div></article>';
      }).join('') + '</div>');
  }

  // A partner shows as a card: its logo, whole, on a light tile (or its name set large when there's
  // no logo yet), then the name, a line about what it does with the club, and its site.
  function partnerCard(p) {
    var host = '';
    try { host = p.url ? new URL(p.url).hostname.replace(/^www\./, '') : ''; } catch (e) { host = ''; }
    return '<article class="partner-card"><div class="partner-logo">' +
      (p.logo ? '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '" loading="lazy" class="ph-no-capture">' : '<span class="partner-wordmark" dir="auto">' + esc(p.name) + '</span>') +
      '</div><div class="partner-body"><h3 class="name" dir="auto">' + esc(p.name) + '</h3>' +
      (p.note ? '<p class="muted" dir="auto">' + esc(p.note) + '</p>' : '') +
      (host ? '<a class="link" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + esc(host) + '</a>' : '') + '</div></article>';
  }

  // The last card: an open invitation in the club's colours, leading to the form.
  function inviteCard() {
    var c = CONTENT.partnerInvite;
    return '<a class="partner-card partner-invite" href="partners" data-to-form><div class="partner-logo"><span class="partner-wordmark">Your company</span></div>' +
      '<div class="partner-body"><h3 class="name">' + esc(c.title) + '</h3><p class="muted">' + esc(c.note) + '</p><span class="link">Get in touch</span></div></a>';
  }

  // The pitch (who a partner reaches, how a deal works) beside the form, then the partners below
  // for social proof, in the order Admin gives them, with the invitation last.
  function pagePartners() {
    var c = CONTENT;
    var i = info();
    var partners = i.partners || c.partners;
    var pitch = (i.settings && i.settings.partner_intro) || c.partnerPitch;
    return page('<div class="partners-top"><section class="partner-pitch"><h1>Work with the club</h1>' +
      '<p class="lead">' + esc(pitch) + '</p><p>' + esc(c.partnerDeal) + '</p></section>' +
      '<section class="partner-form surface" id="talk"><h2>Talk to us</h2><form class="form-grid" id="inquiry" novalidate>' +
      '<label>Your name<input type="text" name="name" maxlength="60" required autocomplete="name"><span class="field-error" data-err="name"></span></label>' +
      '<label>Company<input type="text" name="company" maxlength="60" required autocomplete="organization"><span class="field-error" data-err="company"></span></label>' +
      '<label>Work email<input type="email" name="email" required autocomplete="email"><span class="field-error" data-err="email"></span></label>' +
      '<label>How would you like to work with the club?<textarea name="message" rows="4" maxlength="1000" required dir="auto"></textarea><span class="field-error" data-err="message"></span></label>' +
      '<label class="hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Send</button></div></form></section></div>' +
      '<section class="partners"><h2>Our partners</h2><div class="partner-grid">' + partners.map(partnerCard).join('') + inviteCard() + '</div></section>');
  }

  function wirePartners() {
    var f = $('#inquiry');
    $$('[data-to-form]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        Analytics.track('partner invite clicked');
        $('#talk').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        $('input[name=name]', f).focus({ preventScroll: true });
      });
    });
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(f);
      var btn = $('button[type=submit]', f);
      setBusy(btn, true, 'Sending…');
      var fd = new FormData(f);
      try {
        await Api.call('partnerInquiry', { name: fd.get('name'), company: fd.get('company'), email: fd.get('email'), message: fd.get('message'), website: fd.get('website') }, { session: '' });
        Analytics.track('partner inquiry sent');
        $('.partner-form').innerHTML = '<h2>Thank you</h2><p class="muted">We got your message and will write back soon.</p>';
      } catch (err) {
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  // The one way in: one card, the club on the left in navy, the form on the right. An email gets
  // a member a sign-in code and anyone else the application form, behind the same screen, so the
  // page never tells who's a member (F109, F113). Members-only pages show it too, with a line why.
  function pageJoin(params, opts) {
    var me = state.me;
    var gated = opts && opts.gated;
    var s = info().settings || {};
    return page((gated ? '<p class="note gate">Members only. Sign in to continue.</p>' : '') +
      '<section class="join"><div class="join-club"><div class="join-club-body"><h1>Join the club</h1>' +
      '<p class="join-lead">Open to Reichman master\'s students.' + (s.applications_note ? ' ' + esc(s.applications_note) : '') + '</p>' +
      (s.applications_open === false ? '<p class="join-lead">Applications are closed right now. Follow the club on LinkedIn or Instagram to hear when the next cohort opens.</p>' : '') +
      '<dl class="join-gets"><div><dt>The club</dt><dd>' + esc(CONTENT.club) + '</dd></div><div><dt>The community</dt><dd>' + esc(CONTENT.community) + '</dd></div></dl></div>' +
      '<div class="tie-field" aria-hidden="true"></div></div>' +
      '<div class="join-form">' +
      (me ? '<h2>You\'re signed in</h2><p class="muted">As ' + esc(me.name) + '.</p><a class="btn navy" href="members">Go to the directory</a>' : '<div id="joinFlow"></div>') +
      '</div></section>');
  }

  function wireJoin() {
    var flow = $('#joinFlow');
    if (!flow) return;
    if (CONFIG.DEV_SIGNIN) devStep(flow);
    var p = App.pendingCode();
    if (p) checkStep(flow, p.email); else emailStep(flow);
  }

  // The dev server's one-click sign-in for the browser tests, above whichever step is showing.
  function devStep(flow) {
    var dev = document.createElement('form');
    dev.className = 'dev-signin';
    dev.innerHTML = '<input type="email" name="email" placeholder="Test email" required aria-label="Test email"><button class="btn quiet" type="submit">Sign in (dev)</button>';
    flow.parentNode.insertBefore(dev, flow);
    dev.addEventListener('submit', async function (e) {
      e.preventDefault();
      try { await App.devSignIn(new FormData(dev).get('email')); } catch (err) { showErrors(dev, err); }
    });
  }

  function emailStep(flow) {
    flow.innerHTML = '<h2>Sign in or apply</h2>' +
      '<p class="muted">Members get a sign-in code. Everyone else gets the application form.</p>' +
      '<form class="code-form" id="emailForm" novalidate>' +
      '<label>Your email<input type="email" name="email" autocomplete="email" required placeholder="you@example.com"><span class="field-error" data-err="email"></span></label>' +
      '<button class="btn navy" type="submit">Continue</button></form>';
    var f = $('#emailForm', flow);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      var email = Core.normalizeEmail(new FormData(f).get('email'));
      clearErrors(f);
      setBusy(btn, true, 'Sending…');
      try {
        await Api.call('emailStart', { email: email }, { session: '' });
        // They're named by the email they gave; signing in as a member names them by their row.
        Analytics.identify({ id: email, email: email });
        Analytics.track('sign in code sent');
        App.setPendingCode(email);
        checkStep(flow, email);
        $('input[name=code]', flow).focus();
      } catch (err) {
        Analytics.track('sign in failed', { method: 'email', reason: err.code });
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  // The same screen for everyone who gave an email: the code for members, the application for
  // everyone else.
  function checkStep(flow, email) {
    var s = info().settings || {};
    var open = s.applications_open !== false;
    var minutes = Math.round(Core.CODE_LIMITS.ttlMs / 60000);
    flow.innerHTML = '<h2>Check your email</h2>' +
      '<p class="muted">Masters, type the code we sent to <b class="ph-sensitive">' + esc(email) + '</b>. It works for ' + minutes + ' minutes. <button class="link" type="button" data-change>Change email</button></p>' +
      '<form class="code-form" id="codeForm" novalidate>' +
      '<label>Code from the email<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required class="code-input"><span class="field-error" data-err="code"></span></label>' +
      '<button class="btn gold" type="submit">Sign in</button>' +
      '<button class="btn quiet" type="button" data-resend disabled>Send a new code</button>' +
      '<p class="field-error" data-resend-note role="status"></p></form>' +
      '<div class="join-apply">' + (open
        ? '<p>Not a member? <a class="link" href="' + esc(s.apply_url || CONTENT.applyUrl) + '" target="_blank" rel="noopener" data-apply>Start your application now</a></p><p class="muted small">You\'ll get it by email too.</p>'
        : '<p>Not a member? Applications are closed right now.</p>') + '</div>';
    var apply = $('[data-apply]', flow);
    if (apply) apply.addEventListener('click', function () { Analytics.track('apply clicked', { source: 'join' }); });
    var f = $('#codeForm', flow);
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      clearErrors(f);
      setBusy(btn, true, 'Checking…');
      try {
        await App.signInWithCode(email, new FormData(f).get('code'), 'email');
      } catch (err) {
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
    $('[data-change]', flow).addEventListener('click', function () {
      App.setPendingCode(null);
      Analytics.reset();
      emailStep(flow);
    });
    resendButton(flow, email);
  }

  // "Send a new code" opens once the wait since the last email is over: a minute, then longer
  // each time, the same as the API (F110). Pressing it sends one and counts it.
  function resendButton(flow, email) {
    var btn = $('[data-resend]', flow);
    var note = $('[data-resend-note]', flow);
    var waits = Core.CODE_LIMITS.waitsMs;
    var tick = function () {
      if (!btn.isConnected) return;
      var p = App.pendingCode() || { at: Date.now(), n: 1 };
      var left = Math.ceil((p.at + waits[Math.min(p.n, waits.length) - 1] - Date.now()) / 1000);
      btn.disabled = left > 0;
      btn.textContent = left > 0 ? 'Send a new code in ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : 'Send a new code';
      if (left > 0) setTimeout(tick, 1000);
    };
    btn.addEventListener('click', async function () {
      var p = App.pendingCode() || { n: 1 };
      note.textContent = '';
      setBusy(btn, true, 'Sending…');
      try {
        await Api.call('emailStart', { email: email }, { session: '' });
        Analytics.track('new code requested');
        App.setPendingCode(email, p.n + 1);
        toast('New code sent');
      } catch (err) {
        note.textContent = err.message;
      }
      setBusy(btn, false);
      tick();
    });
    tick();
  }

  // The link at the foot of the application email lands here: someone in a cohort who applied
  // with another email tells the leads, and a leader links this email to their name (F109).
  var tellEmail = null;
  function pageTell() {
    var got = new URLSearchParams(location.hash.slice(1));
    if (got.get('e')) {
      tellEmail = Core.normalizeEmail(got.get('e'));
      history.replaceState(null, '', App.toPath('tell'));
    }
    if (!tellEmail) { go('join'); return ''; }
    return page('<section class="signin-card surface"><h1>Tell the club leads</h1>' +
      '<p class="muted">In a cohort, but applied with another email? Send this and a leader will link <b class="ph-sensitive">' + esc(tellEmail) + '</b> to your name, so you can sign in with it.</p>' +
      '<form class="form-grid" id="tellForm" novalidate>' +
      '<label>Your full name<input type="text" name="name" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Anything that helps us find you <span class="hint">Your cohort, or the email you applied with</span><textarea name="note" maxlength="280" rows="2" dir="auto"></textarea><span class="field-error" data-err="note"></span></label>' +
      '<div class="row-actions"><button class="btn navy" type="submit">Send to the club leads</button></div></form></section>');
  }

  function wireTell() {
    var tell = $('#tellForm');
    if (!tell) return;
    Analytics.identify({ id: tellEmail, email: tellEmail });
    tell.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', tell);
      clearErrors(tell);
      setBusy(btn, true, 'Sending…');
      try {
        var fd = new FormData(tell);
        await Api.call('requestAccess', { email: tellEmail, name: fd.get('name'), note: fd.get('note') }, { session: '' });
        Analytics.track('access requested');
        tell.outerHTML = '<p class="note">Sent. A leader will link <b class="ph-sensitive">' + esc(tellEmail) + '</b> to your name, and then you can sign in with it.</p>';
      } catch (err) {
        setBusy(btn, false);
        showErrors(tell, err);
      }
    });
  }

  // The application email's button lands here: it names the person by the email after the #,
  // counts the click, and opens the form, so an application can be tied to who started it (F113).
  function pageApply() {
    return page('<section class="signin-card surface"><h1>The application form</h1><p class="muted" id="applyNote">Opening it now…</p></section>');
  }

  async function wireApply() {
    var got = new URLSearchParams(location.hash.slice(1));
    if (got.get('e')) {
      Analytics.identify({ id: Core.normalizeEmail(got.get('e')), email: Core.normalizeEmail(got.get('e')) });
      history.replaceState(null, '', App.toPath('apply'));
    }
    await App.refreshPublic();
    var s = info().settings || {};
    if (s.applications_open === false) {
      $('#applyNote').textContent = 'Applications are closed right now. Follow the club on LinkedIn or Instagram to hear when the next cohort opens.';
      return;
    }
    Analytics.track('apply clicked', { source: 'email' });
    var url = s.apply_url || CONTENT.applyUrl;
    $('#applyNote').innerHTML = 'Opening it now. If nothing happens, <a class="link" href="' + esc(url) + '">open the form</a>.';
    // A moment for the event to leave before the page does.
    setTimeout(function () { location.replace(url); }, 400);
  }

  // Where the link in the email lands: one tap to sign in. The tap matters, since some mail
  // services open every link to scan it, which would use up the code before the person does.
  // The address and code leave the address bar at once, so they stay out of history (F104).
  var linkCode = null;
  function pageSignIn(params) {
    // The link puts them after a # (signin#e=...&c=...), so they never reach a server's logs.
    var got = new URLSearchParams(location.hash.slice(1));
    if (got.get('e') && got.get('c')) {
      linkCode = { email: Core.normalizeEmail(got.get('e')), code: String(got.get('c')) };
      history.replaceState(null, '', App.toPath('signin'));
    }
    if (!linkCode) { go('join'); return ''; }
    return page('<section class="signin-card banded"><h1>Sign in to the club</h1>' +
      '<p class="muted">You\'re signing in as <b class="ph-sensitive">' + esc(linkCode.email) + '</b>.</p>' +
      '<form class="code-form" id="linkForm" novalidate><button class="btn gold" type="submit">Sign in</button>' +
      '<div class="code-links"><a class="link" href="join">Use another email</a></div></form></section>');
  }

  function wireSignIn() {
    var f = $('#linkForm');
    if (!f) return;
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      clearErrors(f);
      setBusy(btn, true, 'Signing in…');
      var mine = linkCode;
      linkCode = null;
      try {
        await App.signInWithCode(mine.email, mine.code, 'link');
      } catch (err) {
        linkCode = mine;
        setBusy(btn, false);
        showErrors(f, err);
        if (err.code === 'invalid') {
          $('.code-links', f).innerHTML = '<a class="link" href="join" data-new-link>Send a new link</a>';
          $('[data-new-link]', f).addEventListener('click', function () { App.setPendingCode(null); linkCode = null; });
        }
      }
    });
  }

  function wireMeetings(params) {
    var target = params.get('m') && document.getElementById('m-' + params.get('m'));
    if (target) { target.scrollIntoView(); return 'keep-scroll'; }
  }

  App.route('', { page: pageHome, isPublic: true });
  App.route('about', { page: pageAbout, isPublic: true });
  App.route('meetings', { page: pageMeetings, wire: wireMeetings, isPublic: true });
  App.route('partners', { page: pagePartners, wire: wirePartners, isPublic: true });
  App.route('join', { page: pageJoin, wire: wireJoin, isPublic: true });
  App.route('signin', { page: pageSignIn, wire: wireSignIn, isPublic: true });
  App.route('apply', { page: pageApply, wire: wireApply });
  App.route('tell', { page: pageTell, wire: wireTell });
})();
