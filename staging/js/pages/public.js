// The public pages, and the pages for people who aren't signed in yet.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, avatar = App.avatar, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, longDate = App.longDate, signInBlock = App.signInBlock;

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
      '<div class="actions on-navy"><a class="btn gold" href="#/join?apply">Apply for the next cohort</a><a class="link" href="#/partners">Partner with us</a></div>' +
      '</div></section>' +
      '<div class="wrap">' +
      '<section class="split"><h2>A club and a community</h2><dl>' +
      '<div><dt>The club</dt><dd>' + esc(c.club) + '</dd></div>' +
      '<div><dt>The community</dt><dd>' + esc(c.community) + '</dd></div>' +
      '</dl></section></div>' +
      '<section class="statement"><div class="wrap"><p>' + esc(c.giveFirst) + ' <span>' + esc(c.giveFirstRest) + '</span></p></div></section>' +
      '<div class="wrap"><section class="past"><div class="past-head"><h2>In the past</h2><a class="link" href="#/meetings">All meetings</a></div>' +
      '<div class="rail">' + c.meetings.map(function (mt) {
        return '<a href="#/meetings?m=' + esc(mt.id) + '"><img src="' + esc(mt.poster) + '" alt="" loading="lazy" width="640" height="800">' +
          '<span class="who">' + esc(mt.speaker) + '</span><span class="when">' + esc(longDate(mt.date)) + '</span></a>';
      }).join('') + '</div></section>' +
      (coming.length ? '<section class="coming"><div class="past-head"><h2>In the future</h2>' +
        (state.me ? '<a class="link" href="#/events">All events</a>' : '<a class="link" href="#/join">How to join</a>') + '</div>' +
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
    return '<a class="partner-card partner-invite" href="#/partners" data-to-form><div class="partner-logo"><span class="partner-wordmark">Your company</span></div>' +
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
      '<section class="partner-form banded" id="talk"><h2>Talk to us</h2><form class="form-grid" id="inquiry" novalidate>' +
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

  // The one place to sign in or apply. Members-only pages show it too, with a line saying why.
  // Applying is a navy panel that ends in the tie; signing in is a card with one field, the width of the card.
  function pageJoin(params, opts) {
    var s = info().settings || {};
    var me = state.me;
    var gated = opts && opts.gated;
    return page((gated ? '<p class="note gate">Members only. Sign in to continue.</p>' : '') +
      '<h1>Two ways in</h1><div class="paths' + (params && params.has('apply') ? ' apply-first' : '') + '">' +
      '<section class="path-apply"><div class="path-body"><h2>Apply to a cohort</h2><p class="muted">Open to Reichman master\'s students across programmes. Up to 50 members per cohort, activity in English.</p>' +
      (s.applications_note ? '<p class="on-navy-note">' + esc(s.applications_note) + '</p>' : '') +
      (s.applications_open === false ? '<p class="on-navy-note">Applications are closed right now. Follow the club on LinkedIn or Instagram to hear when the next cohort opens.</p>'
        : '<a class="btn gold" href="' + esc(s.apply_url || CONTENT.applyUrl) + '" target="_blank" rel="noopener" data-apply>Application form</a>') +
      '<dl class="path-gets"><div><dt>The club</dt><dd>' + esc(CONTENT.club) + '</dd></div><div><dt>The community</dt><dd>' + esc(CONTENT.community) + '</dd></div></dl></div>' +
      '<div class="tie-field" aria-hidden="true"></div></section>' +
      '<section class="path-signin banded"><h2>Already a member?</h2>' +
      (me ? '<p class="muted">You\'re signed in as ' + esc(me.name) + '.</p><a class="btn navy" href="#/members">Go to the directory</a>'
        : '<p class="muted">Current cohort or alumni: enter your email and we\'ll send you a link that signs you in. No password, and you stay signed in.</p>' + signInBlock()) +
      '</section></div>');
  }

  // Where the link in the email lands: one tap to sign in. The tap matters, since some mail
  // services open every link to scan it, which would use up the code before the person does.
  // The address and code leave the address bar at once, so they stay out of history (F104).
  var linkCode = null;
  function pageSignIn(params) {
    // The link puts them after a # (signin#e=...&c=...), so they never reach a server's logs;
    // a link from before the change has them in the query.
    var got = location.hash.charAt(1) === 'e' ? new URLSearchParams(location.hash.slice(1)) : params;
    if (got.get('e') && got.get('c')) {
      linkCode = { email: Core.normalizeEmail(got.get('e')), code: String(got.get('c')) };
      history.replaceState(null, '', App.toPath('#/signin'));
    }
    if (!linkCode) { go('#/join'); return ''; }
    return page('<div class="panel"><div class="inner"><h1>Sign in to the club</h1>' +
      '<p class="muted">You\'re signing in as <b class="ph-sensitive">' + esc(linkCode.email) + '</b>.</p>' +
      '<form class="code-form" id="linkForm" novalidate><button class="btn gold" type="submit">Sign in</button>' +
      '<div class="code-links"><a class="link" href="#/join">Use another email</a></div></form></div></div>');
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
        Analytics.track('sign in failed', { method: 'link', reason: err.code });
        linkCode = mine;
        setBusy(btn, false);
        showErrors(f, err);
        if (err.code === 'invalid') {
          $('.code-links', f).innerHTML = '<a class="link" href="#/join" data-new-link>Send a new link</a>';
          $('[data-new-link]', f).addEventListener('click', function () { App.forgetCode(); linkCode = null; });
        }
      }
    });
  }

  function pageDenied(email) {
    return page('<div class="panel"><div class="inner"><h1>Can\'t get in?</h1>' +
      '<p><b class="ph-sensitive">' + esc(email || 'This account') + '</b> is on the list but marked inactive.</p>' +
      '<p class="muted" style="margin:0">Ask one of the leaders on WhatsApp to reactivate you, or sign in with another account.</p>' +
      signInBlock() + '</div></div>');
  }

  function pageRequest() {
    var g = state.guest;
    if (!g || !Api.guest()) return pageJoin(new URLSearchParams(), { gated: true });
    if (g.request && g.request.status === 'pending') {
      return page('<div class="panel"><div class="inner"><h1>You\'re on the waiting list</h1>' +
        '<p class="muted">We got your request for <b class="ph-sensitive">' + esc(g.email) + '</b>. A leader will link it to your name, and then you can sign in. Nothing else to do.</p>' +
        '<button class="btn quiet" data-signout-guest>Use another account</button></div></div>');
    }
    return page('<div class="panel"><div class="inner"><h1>We don\'t have this email yet</h1>' +
      '<p class="muted">You signed in as <b class="ph-sensitive">' + esc(g.email) + '</b>, which isn\'t on the members list. If you\'re in a cohort, send this and a leader will link it to your name. Not in one yet? <a class="link" href="#/join?apply">Apply to a cohort</a>.</p>' +
      '<form class="form-grid" id="requestForm" novalidate style="margin-top:24px">' +
      '<label>Your full name<input type="text" name="name" maxlength="60" required dir="auto" value="' + esc(g.name) + '"><span class="field-error" data-err="name"></span></label>' +
      '<label>Anything that helps us find you <span class="hint">Your cohort, or the name you use on WhatsApp</span><textarea name="note" maxlength="280" rows="2" dir="auto"></textarea><span class="field-error" data-err="note"></span></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Send request</button><button class="link" type="button" data-signout-guest>Use another account</button></div></form></div></div>');
  }

  function wireRequest() {
    if (!$('[data-signout-guest]')) return;
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
        Analytics.track('access requested');
        state.guest.request = r.request;
        toast('Request sent');
        App.render();
      } catch (err) {
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  function wireJoin() {
    var apply = $('[data-apply]');
    if (apply) apply.addEventListener('click', function () { Analytics.track('apply clicked'); });
  }

  function wireMeetings(params) {
    var target = params.get('m') && document.getElementById('m-' + params.get('m'));
    if (target) { target.scrollIntoView(); return 'keep-scroll'; }
  }

  App.route('#/', { page: pageHome, isPublic: true });
  App.route('#/about', { page: pageAbout, isPublic: true });
  App.route('#/meetings', { page: pageMeetings, wire: wireMeetings, isPublic: true });
  App.route('#/partners', { page: pagePartners, wire: wirePartners, isPublic: true });
  App.route('#/join', { page: pageJoin, wire: wireJoin, isPublic: true });
  App.route('#/request', { page: pageRequest, wire: wireRequest });
  App.route('#/signin', { page: pageSignIn, wire: wireSignIn, isPublic: true });
  App.route('#/denied', { page: function (params) { return pageDenied(params.get('e')); } });
})();
