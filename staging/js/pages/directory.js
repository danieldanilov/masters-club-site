// The directory: the people and the search, nothing else.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, icon = App.icon, page = App.page, avatar = App.avatar, tags = App.tags, roleLine = App.roleLine, toast = App.toast, openSheet = App.openSheet, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;

  function pageMembers() {
    return page('<div class="page-head"><h1>Directory</h1><span class="count" id="count" aria-live="polite"></span>' +
      '<span class="spacer"></span><a class="link" href="#/me">Edit my profile</a></div><div id="dirBody"></div>');
  }

  var page_draw = null;

  function nudge() {
    var u = state.me;
    if (!u.needs_review) return '';
    return '<p class="nudge" id="nudge">Is your profile still right? <button class="link" type="button" id="looksRight">Looks right</button><a class="link" href="#/me">Update it</a></p>';
  }

  function wireMembers(params) {
    var d = state.data.directory;
    var s = state.dir;
    var cohorts = Array.from(new Set(d.members.map(function (m) { return m.cohort; }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    var hidden = d.hiddenTiers.length
      ? '<p class="note" style="margin-bottom:16px">You\'re viewing as ' + esc(TIER_LABEL[d.viewer.tier]) + ', so ' + esc(d.hiddenTiers.map(function (t) { return TIER_LABEL[t]; }).join(' and ')) + ' profiles are hidden from you.</p>'
      : '';
    var tiers = Core.TIERS.filter(function (t) { return d.members.some(function (m) { return m.tier === t; }); });
    $('#dirBody').innerHTML = nudge() + hidden +
      '<div class="search-row">' + icon('search') + '<label class="sr-only" for="q">Search members</label>' +
      '<input class="search" type="search" id="q" placeholder="Search by name, company, skill or city" value="' + esc(s.q) + '" dir="auto" autocomplete="off"></div>' +
      (tiers.length > 1 ? '<div class="tabs" role="group" aria-label="Who to show"><button type="button" class="tab" data-tier="">Everyone</button>' + tiers.map(function (t) { return '<button type="button" class="tab" data-tier="' + esc(t) + '">' + esc(t === 'leader' ? 'Leaders' : TIER_LABEL[t]) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="filters"><select id="fCohort" aria-label="Cohort"><option value="">All cohorts</option>' +
      cohorts.map(function (c) { return '<option value="' + esc(c) + '" ' + (s.cohort === c ? 'selected' : '') + '>' + esc(cohortLabel(c)) + '</option>'; }).join('') + '</select>' +
      '<select id="fIndustry" aria-label="Industry"><option value="">All industries</option>' + Core.INDUSTRIES.map(function (i) { return '<option ' + (s.industry === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join('') + '</select>' +
      Core.OPEN_TO.map(function (o) { return '<button class="chip ' + (s.open.indexOf(o) !== -1 ? 'on' : '') + '" data-open="' + esc(o) + '" aria-pressed="' + (s.open.indexOf(o) !== -1) + '">' + esc(o) + '</button>'; }).join('') +
      '</div><p class="result-note ph-sensitive" id="resultNote" hidden></p><div class="results" id="results"></div>';

    function markTabs() {
      $$('[data-tier]').forEach(function (b) {
        var on = b.dataset.tier === s.tier;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }
    function draw() {
      var members = state.data.directory.members;
      var filters = { cohort: s.cohort, industry: s.industry, open: s.open, tier: s.tier };
      var list = Core.searchMembers(members, s.q, filters);
      var note = $('#resultNote');
      note.hidden = true;
      if (!list.length && s.q.trim().split(/\s+/).length > 1) {
        list = Core.searchMembers(members, s.q, filters, { any: true });
        if (list.length) {
          note.textContent = 'Nobody matches all of "' + s.q.trim() + '", so here is everyone who matches part of it, best matches first.';
          note.hidden = false;
        }
      }
      $('#count').textContent = list.length + ' member' + (list.length === 1 ? '' : 's');
      shown = list.length;
      $('#results').innerHTML = list.length ? list.map(memberCard).join('') : '<div class="empty">Nobody matches. Try fewer words or filters.</div>';
      $$('#results .member-card').forEach(function (c) {
        c.addEventListener('click', function () { openProfile(c.dataset.id); });
      });
    }
    // Once someone stops typing or picks a filter: how many they found and which filters were on,
    // never the words.
    var shown = 0;
    function searched() {
      clearTimeout(searched.timer);
      searched.timer = setTimeout(function () {
        var filters = ['cohort', 'industry', 'tier'].filter(function (k) { return s[k]; }).concat(s.open.length ? ['open_to'] : []);
        if (!s.q.trim() && !filters.length) return;
        Analytics.track('directory searched', { result_count: shown, has_query: !!s.q.trim(), filters: filters });
      }, 800);
    }
    $('#q').addEventListener('input', function (e) { s.q = e.target.value; draw(); searched(); });
    $('#fCohort').addEventListener('change', function (e) { s.cohort = e.target.value; draw(); searched(); });
    $('#fIndustry').addEventListener('change', function (e) { s.industry = e.target.value; draw(); searched(); });
    $$('[data-tier]').forEach(function (b) {
      b.addEventListener('click', function () { s.tier = b.dataset.tier; markTabs(); draw(); searched(); });
    });
    $$('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = b.dataset.open;
        s.open = s.open.indexOf(o) !== -1 ? s.open.filter(function (x) { return x !== o; }) : s.open.concat([o]);
        b.classList.toggle('on');
        b.setAttribute('aria-pressed', String(s.open.indexOf(o) !== -1));
        draw();
        searched();
      });
    });
    var ok = $('#looksRight');
    if (ok) ok.addEventListener('click', async function () {
      $('#nudge').remove();
      try {
        var r = await Api.call('confirmProfile');
        Analytics.track('profile confirmed');
        state.me = r.me;
        App.saveData();
      } catch (e) { toast(e.message); }
    });
    markTabs();
    draw();
    page_draw = draw;
    if (params && params.get('m')) openProfile(params.get('m'));
  }

  function memberCard(m) {
    var p = m.profile;
    var role = roleLine(p);
    return '<button class="member-card" data-id="' + esc(m.id) + '" type="button">' + avatar(m) + '<span class="body">' +
      '<span class="name" dir="auto">' + esc(m.name) + '</span>' +
      '<span class="role ph-sensitive" dir="auto" style="display:block">' + (role || 'No profile yet') + '</span>' +
      '<span class="tags ph-sensitive">' + tags(m) + '</span>' +
      (p.help.length ? '<span class="help ph-sensitive" dir="auto" style="display:block">Can help with ' + esc(p.help.join(', ')) + '</span>' : '') +
      '</span></button>';
  }

  // Contact links carry the phone and email in their address, so replay leaves them out whole
  // (ph-no-capture), and what members wrote about themselves is masked (ph-sensitive). Names show.
  function profileSheet(m, preview) {
    var p = m.profile;
    var wa = p.phone ? '<a class="btn gold" href="https://wa.me/' + esc(String(p.phone).replace(/\D/g, '')) + '" target="_blank" rel="noopener" data-channel="whatsapp">' + icon('chat') + 'WhatsApp</a>' : '';
    var li = p.linkedin ? '<a class="btn quiet" href="' + esc(p.linkedin) + '" target="_blank" rel="noopener" data-channel="linkedin">' + icon('linkedin') + 'LinkedIn</a>' : '';
    var mail = p.email ? '<a class="btn quiet" href="mailto:' + esc(p.email) + '" data-channel="email">Email</a>' : '';
    function list(label, arr) {
      return arr && arr.length ? '<h3>' + label + '</h3><div class="tags ph-sensitive">' + arr.map(function (h) { return '<span class="tag" dir="auto">' + esc(h) + '</span>'; }).join('') + '</div>' : '';
    }
    var actions = wa || li || mail ? '<div class="actions ph-no-capture">' + wa + li + mail + '</div>' : (preview ? '' : '<p class="muted small" style="margin-top:28px">No contact links yet.</p>');
    return avatar(m, 'lg') +
      '<h2 dir="auto">' + esc(m.name) + '</h2>' +
      '<div class="role ph-sensitive" dir="auto">' + (roleLine(p) || 'No role yet') + '</div>' +
      (p.city || p.program ? '<div class="muted ph-sensitive" dir="auto" style="margin-top:4px">' + esc([p.program, p.city].filter(Boolean).join(', ')) + '</div>' : '') +
      '<div class="tags ph-sensitive" style="margin-top:14px">' + tags(m) + '</div>' +
      (p.bio ? '<p class="bio ph-sensitive" dir="auto">' + esc(p.bio) + '</p>' : '') +
      list('Can help with', p.help) + list('Looking for', p.looking) + list('Open to', p.open_to) + list('Outside work', p.interests) + actions;
  }

  function openProfile(id) {
    var m = state.data.directory.members.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    openSheet(profileSheet(m));
    Analytics.track('profile viewed');
    $$('#modal [data-channel]').forEach(function (a) {
      a.addEventListener('click', function () { Analytics.track('contact clicked', { channel: a.dataset.channel }); });
    });
  }

  App.profileSheet = profileSheet;
  App.openProfile = openProfile;
  App.route('#/members', {
    page: pageMembers, wire: wireMembers, member: true,
    onData: function () { if (page_draw && $('#results')) page_draw(); }
  });
})();
