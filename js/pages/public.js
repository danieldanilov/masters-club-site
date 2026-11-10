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

  function pageAbout() {
    return page('<h1>Who runs it</h1>' +
      '<p class="lead measure" style="margin-top:16px">The club is the current cohort. The community is everyone who has been through it. Both are run by volunteers who are Reichman students.</p>' +
      '<div class="people">' + CONTENT.leaders.map(function (p) {
        return '<div class="person">' + avatar({ name: p.name, profile: { photo: p.photo } }, 'lg') + '<div><div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.role) + '</div></div></div>';
      }).join('') + '</div>');
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

  function pagePartners() {
    var c = CONTENT;
    var i = info();
    var partners = i.partners || c.partners;
    var size = i.member_count ? '<p class="lead measure" style="margin-top:8px">' + i.member_count + ' members across ' + i.cohort_count + ' cohort' + (i.cohort_count === 1 ? '' : 's') + ' so far, with 40 to 50 more joining every cohort.</p>' : '';
    return page('<h1>Work with the club</h1>' +
      '<p class="lead measure" style="margin-top:16px">' + esc((i.settings && i.settings.partner_intro) || 'We partner slowly and choose companies whose involvement helps our members.') + '</p>' + size +
      partners.map(function (p) {
        var inner = (p.logo ? '<img class="avatar" src="' + esc(p.logo) + '" alt="">' : '<div class="avatar">' + esc(p.initial || String(p.name).slice(0, 1)) + '</div>') +
          '<div><div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.note) + '</div></div>';
        return p.url ? '<a class="partner-now" href="' + esc(p.url) + '" target="_blank" rel="noopener">' + inner + '</a>' : '<div class="partner-now">' + inner + '</div>';
      }).join('') +
      '<div class="tiers">' + c.partnerTiers.map(function (t) {
        return '<div><h3>' + esc(t.name) + '</h3><div class="price">' + esc(t.price) + '</div><p class="muted" style="margin:0">' + esc(t.detail) + '</p></div>';
      }).join('') + '</div>' +
      (c.partnerTiersNote ? '<p class="muted small" style="margin-top:12px">' + esc(c.partnerTiersNote) + '</p>' : '') +
      '<section class="partner-form"><h2>Talk to us</h2><form class="form-grid" id="inquiry" novalidate>' +
      '<label>Your name<input type="text" name="name" maxlength="60" required autocomplete="name"><span class="field-error" data-err="name"></span></label>' +
      '<label>Company<input type="text" name="company" maxlength="60" required autocomplete="organization"><span class="field-error" data-err="company"></span></label>' +
      '<label>Work email<input type="email" name="email" required autocomplete="email"><span class="field-error" data-err="email"></span></label>' +
      '<label>How would you like to work with the club?<textarea name="message" rows="4" maxlength="1000" required dir="auto"></textarea><span class="field-error" data-err="message"></span></label>' +
      '<label class="hp" aria-hidden="true">Website<input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Send</button></div></form></section>');
  }

  function wirePartners() {
    var f = $('#inquiry');
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
  function pageJoin(params, opts) {
    var s = info().settings || {};
    var me = state.me;
    var gated = opts && opts.gated;
    return page((gated ? '<p class="note gate">Members only. Sign in to continue.</p>' : '') +
      '<h1>Two ways in</h1><div class="paths' + (params && params.has('apply') ? ' apply-first' : '') + '">' +
      '<div class="path-apply"><h2>Apply to a cohort</h2><p class="muted">Open to Reichman master\'s students across programmes. Up to 50 members per cohort, activity in English.</p>' +
      (s.applications_note ? '<p class="on-navy-note">' + esc(s.applications_note) + '</p>' : '') +
      (s.applications_open === false ? '<p class="on-navy-note">Applications are closed right now. Follow the club on LinkedIn or Instagram to hear when the next cohort opens.</p>'
        : '<a class="btn gold" href="' + esc(s.apply_url || CONTENT.applyUrl) + '" target="_blank" rel="noopener" data-apply>Application form</a>') + '</div>' +
      '<div class="path-signin"><h2>Already a member?</h2>' +
      (me ? '<p class="muted">You\'re signed in as ' + esc(me.name) + '.</p><a class="btn navy" href="#/members">Go to the directory</a>'
        : '<p class="muted">Current cohort or alumni, sign in with Google or with a code sent to your email. No password, and you stay signed in. If we don\'t have your email yet, you can ask a leader to add you in one step.</p>' + signInBlock()) +
      '</div></div>');
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
      '<p class="muted">You signed in as <b class="ph-sensitive">' + esc(g.email) + '</b>, which isn\'t on the members list. If you\'re in a cohort, send this and a leader will link it to your name.</p>' +
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
  App.route('#/denied', { page: function (params) { return pageDenied(params.get('e')); } });
})();
