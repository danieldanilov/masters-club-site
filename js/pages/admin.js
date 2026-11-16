// Admin: how the club is doing, what's waiting, who's in, who sees what, the public pages.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, loading = App.loading, errorBlock = App.errorBlock, setBusy = App.setBusy, wireRetry = App.wireRetry, clearErrors = App.clearErrors, showErrors = App.showErrors, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;


  function pageAdmin() {
    if (state.me.tier !== 'leader') return page('<div class="note warn">Admin is for leaders only.</div>');
    return page('<div class="page-head"><h1>Admin</h1></div><div id="adminBody">' + loading('Loading') + '</div>');
  }

  // What's on screen, and whether the leader has typed or ticked anything since it was drawn.
  var shown = '';
  var touched = false;
  // Where the leader is in Admin: the tab, which members show, the open row, the Add people box.
  // Kept across redraws, so a fresh copy or a save doesn't throw them back to the top.
  var TABS = ['overview', 'members', 'public', 'settings'];
  var tab = 'overview';
  var show = 'all';
  var open = '';
  var adding = false;

  // Opening Admin shows the copy fetched after sign-in at once, then asks for a fresh one (F133).
  // A fresh copy that differs is drawn, unless the leader has started typing: their words win, and
  // the next visit shows it.
  async function wireAdmin(params) {
    if (state.me.tier !== 'leader') return;
    tab = TABS.indexOf(params.get('tab')) === -1 ? 'overview' : params.get('tab');
    if (state.admin) drawAdmin(state.admin);
    var data = await fetchAdmin(false, !state.admin);
    if (!data || !$('#adminBody')) return;
    if (JSON.stringify(data) !== shown && !touched) drawAdmin(data);
  }

  // After a change: fetch what's true now and draw it, whatever was on screen.
  async function reloadAdmin() {
    var data = await fetchAdmin(true, true);
    if (data && $('#adminBody')) drawAdmin(data);
  }

  async function fetchAdmin(fresh, showError) {
    try {
      return await App.loadAdmin(fresh);
    } catch (e) {
      if (e.code === 'unauthorized' || e.code === 'forbidden') { App.refresh().then(App.render, App.render); return null; }
      if (showError && $('#adminBody')) {
        $('#adminBody').innerHTML = errorBlock(e);
        wireRetry();
      }
      return null;
    }
  }

  function drawAdmin(data) {
    shown = JSON.stringify(data);
    touched = false;
    var body = $('#adminBody');
    var mark = function () { touched = true; };
    body.oninput = mark;
    body.onchange = mark;
    var tiers = Core.TIERS;
    var tierSelect = function (attr, val) {
      return '<select ' + attr + '>' + tiers.map(function (t) { return '<option value="' + t + '" ' + (val === t ? 'selected' : '') + '>' + esc(TIER_LABEL[t]) + '</option>'; }).join('') + '</select>';
    };
    var pending = data.requests.filter(function (r) { return r.status === 'pending'; });
    var inquiries = data.inquiries.filter(function (i) { return i.status === 'new'; });
    var st = data.stats;
    var set = data.settings;
    var site = App.siteLink('members');
    var digest = Core.buildDigest({ today: state.data.today, siteUrl: site, events: state.data.events, posts: state.data.posts, joined: data.joined_this_week });
    var invite = 'The Masters Club directory is live. Find who can help with what, see what\'s coming up, and post jobs. Sign in with your email, no password: ' + site;
    var notIn = data.members.filter(function (m) { return m.active && !m.joined; });

    var requestsHtml = pending.length ? pending.map(function (r) {
      var guess = bestMatch(r.name, data.members);
      // Linking gives them that member's account, so it's always a choice, never the default.
      return '<div class="request" data-request="' + esc(r.id) + '"><div><span class="who" dir="auto">' + esc(r.name) + '</span> <span class="muted ph-sensitive">' + esc(r.email) + '</span>' +
        (r.note ? '<div class="muted small ph-sensitive" dir="auto">"' + esc(r.note) + '"</div>' : '') + '</div>' +
        '<div class="row-actions"><select data-link aria-label="Link to"><option value="">Add as a new member</option>' +
        data.members.map(function (m) { return '<option value="' + esc(m.id) + '">Link to ' + esc(m.name) + (m.cohort ? ', ' + esc(cohortLabel(m.cohort)) : '') + (guess && guess.id === m.id ? ' (name matches)' : '') + '</option>'; }).join('') +
        '</select>' + tierSelect('data-new-tier aria-label="Tier for a new member"', 'community') +
        '<button class="btn gold small" data-approve>Approve</button><button class="btn quiet small" data-decline>Decline</button></div></div>';
    }).join('') : '<p class="muted">No requests waiting.</p>';

    var inquiriesHtml = inquiries.length ? inquiries.map(function (i) {
      return '<div class="request" data-inquiry="' + esc(i.id) + '"><div><span class="who" dir="auto">' + esc(i.company) + '</span> <span class="muted ph-sensitive" dir="auto">' + esc(i.name) + ', <a class="link ph-no-capture" href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a></span>' +
        '<div class="muted small ph-sensitive" dir="auto">"' + esc(i.message) + '"</div></div><div class="row-actions"><button class="btn gold small" data-inq="done">Done</button><button class="btn quiet small" data-inq="declined">Not for us</button></div></div>';
    }).join('') : '<p class="muted">Nothing waiting. Messages from the Partners page land here.</p>';

    var waiting = pending.length + inquiries.length;
    var unlinked = data.members.filter(function (m) { return !m.email; });
    var tabs = [['overview', 'Overview', waiting], ['members', 'Members', 0], ['public', 'Public pages', 0], ['settings', 'Settings', 0]];
    var panel = function (name, inner) { return '<div class="admin-panel" role="tabpanel" data-panel="' + name + '"' + (tab === name ? '' : ' hidden') + '>' + inner + '</div>'; };
    var tile = function (big, label) { return '<div class="tile"><span class="tile-n">' + big + '</span><span class="tile-l">' + label + '</span></div>'; };

    var overviewHtml =
      '<div class="tiles">' +
      tile(st.joined + ' <span class="muted">of ' + st.members + '</span>', 'have signed in') +
      tile(st.active30, 'came by in the last 30 days') +
      tile(st.profiles, 'have a profile') +
      tile(waiting, waiting === 1 ? 'thing is waiting on you' : 'things are waiting on you') + '</div>' +
      '<div class="admin-cols"><div>' +
      '<section class="admin-section" id="s-waiting"><h2>Access requests' + (pending.length ? ' <span class="badge">' + pending.length + '</span>' : '') + '</h2>' + requestsHtml + '</section>' +
      '<section class="admin-section"><h2>Partner messages' + (inquiries.length ? ' <span class="badge">' + inquiries.length + '</span>' : '') + '</h2>' + inquiriesHtml + '</section>' +
      '</div><div>' +
      '<section class="admin-section" id="s-spread"><h2>Spread the word</h2><p class="muted measure">WhatsApp stays where people talk. These open it with the message written, ready for you to pick the group and send.</p><div class="row-actions mt-2">' +
      (digest ? '<a class="btn gold small" href="' + esc(Core.whatsappUrl(digest)) + '" target="_blank" rel="noopener" id="postDigest">Post the weekly update on WhatsApp</a><button class="btn quiet small" id="copyDigest">Copy the update</button>' : '<span class="muted">Nothing new for a weekly update right now.</span>') +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(invite)) + '" target="_blank" rel="noopener" id="postInvite">Invite people on WhatsApp</a></div>' +
      (notIn.length ? '<details class="not-in"><summary>' + notIn.length + ' haven\'t signed in yet</summary><p class="muted" dir="auto">' + esc(notIn.map(function (m) { return m.name; }).join(', ')) + '</p></details>' : '') + '</section>' +
      '<section class="admin-section" id="s-log"><h2>Recent activity</h2><div class="log ph-sensitive">' + (data.log.length ? data.log.map(function (l) {
        return '<div><span class="muted">' + esc(String(l.at).slice(0, 10)) + '</span> ' + esc(nameOf(data, l.actor)) + ': ' + esc(l.action) + (l.detail ? ' <span class="muted">' + esc(l.detail) + '</span>' : '') + '</div>';
      }).join('') : '<p class="muted">Nothing yet.</p>') + '</div></section>' +
      '</div></div>';

    var shows = [['all', 'All', data.members.length], ['never', 'Never signed in', notIn.length], ['unlinked', 'No email yet', unlinked.length]];
    var membersHtml =
      '<div class="member-tools"><input type="search" id="adminFilter" placeholder="Search by name or email" aria-label="Filter members" class="filter-input">' +
      '<div class="member-shows" role="group" aria-label="Show">' + shows.map(function (s) { return '<button class="chip' + (show === s[0] ? ' on' : '') + '" type="button" data-show="' + s[0] + '" aria-pressed="' + (show === s[0]) + '">' + s[1] + ' <span class="chip-n">' + s[2] + '</span></button>'; }).join('') + '</div>' +
      '<button class="btn gold small" type="button" id="addToggle" aria-expanded="' + adding + '" aria-controls="s-add">Add people</button></div>' +

      '<section class="admin-section add-people" id="s-add"' + (adding ? '' : ' hidden') + '><h2>Add people</h2><div class="form-grid form-narrow">' +
      '<label>One per line as "Name, email", or paste rows from a sheet, header row included <span class="hint">From a sheet we read only name, email, position, company, city, program, LinkedIn, interests, tier and cohort. Everything else in the paste is ignored, and people already here only get what\'s empty filled in.</span><textarea id="bulk" rows="5" placeholder="Shir Amar, shir.amar@gmail.com&#10;Ben Tal"></textarea></label>' +
      '<div class="add-row"><label>Tier ' + tierSelect('id="bulkTier"', 'club') + '</label>' +
      '<label>Cohort number <input type="text" id="bulkCohort" inputmode="numeric" placeholder="2" maxlength="20" class="input-short"></label>' +
      '<button class="btn gold" id="bulkAdd">Add</button></div><div id="bulkResult"></div></div></section>' +

      '<div class="table-wrap"><table class="members-table"><thead><tr><th>Name</th><th>Email</th><th>Tier</th><th>Cohort</th><th>Last seen</th></tr></thead><tbody>' +
      data.members.map(function (m) {
        var self = m.id === state.me.id;
        var isOpen = open === m.id;
        // One line to read; the fields open under it.
        return '<tr class="member-row' + (isOpen ? ' open' : '') + '" data-row="' + esc(m.id) + '">' +
          '<td><button class="member-open" type="button" aria-expanded="' + isOpen + '">' + App.avatar({ id: m.id, name: m.name }) + '<span class="member-name" dir="auto">' + esc(m.name) + '</span></button></td>' +
          '<td class="col-email ph-sensitive">' + (m.email ? esc(m.email) : '<span class="tag warn">No email yet</span>') + '</td>' +
          '<td><span class="tag ' + esc(m.tier) + '">' + esc(TIER_LABEL[m.tier] || m.tier) + '</span>' + (m.active ? '' : ' <span class="tag off">Off</span>') + '</td>' +
          '<td class="col-cohort">' + esc(m.cohort) + '</td>' +
          '<td class="muted">' + esc(m.last_seen ? Core.shortDate(m.last_seen) : 'Never') + '</td></tr>' +
          '<tr class="member-edit" data-member="' + esc(m.id) + '"' + (isOpen ? '' : ' hidden') + '><td colspan="5"><div class="member-form">' +
          '<label>Name<input type="text" data-f="name" value="' + esc(m.name) + '" maxlength="60" dir="auto"></label>' +
          '<label>Email<input type="email" data-f="email" value="' + esc(m.email) + '" placeholder="Not linked yet"></label>' +
          '<label>Second email<input type="text" data-f="alt_emails" value="' + esc(m.alt_emails) + '"></label>' +
          '<label><span>Tier</span>' + tierSelect('data-f="tier"' + (self ? ' disabled' : ''), m.tier) + '</label>' +
          '<label>Cohort<input type="text" data-f="cohort" value="' + esc(m.cohort) + '" maxlength="20"></label>' +
          '<label class="check-line"><input type="checkbox" data-f="active" ' + (m.active ? 'checked' : '') + (self ? ' disabled' : '') + '> Active</label>' +
          '<div class="row-actions"><button class="btn gold small" data-save>Save</button>' +
          (m.email && m.active ? '<button class="btn quiet small" type="button" data-send-link>Send sign-in link</button>' : '') +
          '<span class="muted small">Came to ' + m.attended + (m.attended === 1 ? ' event' : ' events') + '</span></div></div></td></tr>';
      }).join('') + '</tbody></table></div><p class="muted" id="noMembers" hidden>Nobody matches.</p>';

    var publicHtml =
      '<section class="admin-section" id="s-public"><div class="admin-pair"><form class="form-grid form-narrow" id="settingsForm" novalidate><h2>The public pages</h2>' +
      '<label class="check-line"><input type="checkbox" name="applications_open" ' + (set.applications_open === undefined || Core.toBool(set.applications_open) ? 'checked' : '') + '> Applications are open</label>' +
      '<label>Application link<input type="url" name="apply_url" value="' + esc(set.apply_url || CONTENT.applyUrl) + '"><span class="field-error" data-err="apply_url"></span></label>' +
      '<label>A line above the application button <span class="hint">Optional, like the closing date</span><input type="text" name="applications_note" value="' + esc(set.applications_note || '') + '" maxlength="200" dir="auto"><span class="field-error" data-err="applications_note"></span></label>' +
      '<label>Opening line on the Partners page <span class="hint">Optional</span><textarea name="partner_intro" rows="2" maxlength="500" dir="auto">' + esc(set.partner_intro || '') + '</textarea><span class="field-error" data-err="partner_intro"></span></label>' +
      '<label>Email leaders about new requests and partner messages at <span class="hint">Never shown publicly</span><input type="email" name="notify_email" value="' + esc(set.notify_email || '') + '"><span class="field-error" data-err="notify_email"></span></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save public pages</button></div></form>' +
      '<div class="admin-partners"><h2>Partners on the public page</h2><div id="partnerList"></div>' +
      '<form class="form-grid form-narrow" id="partnerForm" novalidate><input type="hidden" name="id"><div class="form-row"><label>Name<input type="text" name="name" maxlength="60"><span class="field-error" data-err="name"></span></label>' +
      '<label>Line about them<input type="text" name="note" maxlength="200" dir="auto"><span class="field-error" data-err="note"></span></label></div>' +
      '<div class="form-row"><label>Website<input type="url" name="url" placeholder="https://..."><span class="field-error" data-err="url"></span></label><label>Logo link<input type="url" name="logo" placeholder="https://..."><span class="field-error" data-err="logo"></span></label></div>' +
      '<div class="form-row"><label>Place on the page <span class="hint">1 shows first; empty goes after the numbered ones</span><input type="number" name="position" min="1" max="999" step="1" inputmode="numeric"><span class="field-error" data-err="position"></span></label></div>' +
      '<div class="row-actions"><button class="btn quiet" type="submit" data-partner-save>Add partner</button><button class="link" type="button" data-partner-cancel hidden>Cancel</button></div></form></div></div>' +
      '<p class="muted small measure mt-4">Next meeting on Home comes from the next event marked public. Past meetings come from public events with a recap. Tiers and leader photos live in content.js, see docs/05-operations.md.</p></section>';

    var settingsHtml =
      '<div class="admin-cols"><section class="admin-section" id="s-rules"><h2>Who sees whom in the directory</h2><div class="table-wrap matrix"><table class="matrix">' +
      '<thead><tr><th>Viewer</th>' + tiers.map(function (t) { return '<th>Sees ' + esc(TIER_LABEL[t]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tiers.map(function (v) {
        return '<tr><td>' + esc(TIER_LABEL[v]) + '</td>' + tiers.map(function (s) {
          return '<td><input type="checkbox" aria-label="' + esc(TIER_LABEL[v] + ' sees ' + TIER_LABEL[s]) + '" data-rule="' + v + ':' + s + '" ' + (data.rules[v][s] ? 'checked' : '') + ' ' + (v === 'leader' ? 'disabled' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="muted small mt-1">Leaders always see everyone. Changes apply on each member\'s next page load.</p></section>' +
      '<div><section class="admin-section" id="s-grad"><h2>When a cohort ends</h2><div class="add-row"><label>Cohort number <input type="text" id="gradCohort" inputmode="numeric" maxlength="20" class="input-short"></label><button class="btn quiet" id="gradGo">Move to community</button></div><p class="muted small mt-1">Its club members become community members. Leaders stay leaders.</p></section>' +
      '<section class="admin-section" id="s-export"><h2>Exports</h2><p class="muted measure">A spreadsheet file of everyone, or of who came to what.</p><div class="row-actions mt-2"><button class="btn quiet small" id="exportCsv">Export members</button><button class="btn quiet small" id="exportAtt">Export attendance</button></div></section></div></div>';

    body.innerHTML =
      '<div class="admin-tabs" role="tablist" aria-label="Admin sections">' + tabs.map(function (t) {
        return '<button class="admin-tab" type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (t[2] ? ' <span class="badge">' + t[2] + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
      panel('overview', overviewHtml) + panel('members', membersHtml) + panel('public', publicHtml) + panel('settings', settingsHtml);

    // The tabs. The address keeps the one that's open, so a reload or a shared link lands on it.
    $$('[data-tab]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        tab = b.dataset.tab;
        $$('[data-tab]', body).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        $$('[data-panel]', body).forEach(function (p) { p.hidden = p.dataset.panel !== tab; });
        history.replaceState(null, '', App.toPath('admin') + (tab === 'overview' ? '' : '?tab=' + tab));
      });
    });
    $$('[data-inquiry]').forEach(function (row) {
      $$('[data-inq]', row).forEach(function (b) {
        b.addEventListener('click', async function () {
          setBusy(b, true, 'Saving…');
          try {
            await Api.call('admin.handleInquiry', { id: row.dataset.inquiry, status: b.dataset.inq });
            Analytics.track('partner message handled', { status: b.dataset.inq });
            toast('Saved');
            row.remove();
          } catch (e) { setBusy(b, false); toast(e.message); }
        });
      });
    });
    var cd = $('#copyDigest');
    if (cd) cd.addEventListener('click', function () { Analytics.track('digest copied'); App.copyText(digest); });
    var pd = $('#postDigest');
    if (pd) pd.addEventListener('click', function () { Analytics.track('digest posted'); });
    $('#postInvite').addEventListener('click', function () { Analytics.track('invite shared', { not_signed_in: notIn.length }); });
    $('#gradGo').addEventListener('click', async function (e) {
      var cohort = $('#gradCohort').value.trim();
      if (!cohort || !window.confirm('Move the club members of ' + Core.cohortLabel(cohort) + ' to the community?')) return;
      setBusy(e.target, true, 'Moving…');
      try {
        var r = await Api.call('admin.graduateCohort', { cohort: cohort });
        Analytics.track('cohort ended', { cohort: cohort, moved: r.moved });
        toast(r.moved + ' moved to the community');
        await App.refresh();
        reloadAdmin();
      } catch (err) { setBusy(e.target, false); toast(err.message); }
    });
    var sf = $('#settingsForm');
    sf.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(sf);
      var btn = $('button[type=submit]', sf);
      var fd = new FormData(sf);
      setBusy(btn, true);
      try {
        await Api.call('admin.setSettings', { values: { applications_open: !!fd.get('applications_open'), apply_url: fd.get('apply_url'), applications_note: fd.get('applications_note'), partner_intro: fd.get('partner_intro'), notify_email: fd.get('notify_email') } });
        Analytics.track('public pages saved', { applications_open: !!fd.get('applications_open') });
        toast('Saved');
        App.refreshPublic();
      } catch (err) { showErrors(sf, err); }
      setBusy(btn, false);
    });
    function drawPartners(list) {
      $('#partnerList').innerHTML = list.filter(function (p) { return p.active; }).map(function (p) {
        return '<div class="request" data-partner="' + esc(p.id) + '"><div>' + (p.position ? esc(p.position) + '. ' : '') + '<span class="who" dir="auto">' + esc(p.name) + '</span> <span class="muted" dir="auto">' + esc(p.note) + '</span></div><div class="row-actions"><button class="btn quiet small" data-edit-partner>Edit</button><button class="btn quiet small" data-unlist>Take off the page</button></div></div>';
      }).join('') || '<p class="muted">None yet.</p>';
      $$('[data-partner]').forEach(function (row) {
        // Edit loads the partner into the form below, which then saves it instead of adding one.
        $('[data-edit-partner]', row).addEventListener('click', function () {
          var p = list.filter(function (x) { return x.id === row.dataset.partner; })[0];
          ['id', 'name', 'note', 'url', 'logo', 'position'].forEach(function (k) { pf.elements[k].value = p[k] || ''; });
          partnerMode(true);
          pf.elements.name.focus();
        });
        $('[data-unlist]', row).addEventListener('click', async function () {
          var p = list.filter(function (x) { return x.id === row.dataset.partner; })[0];
          try {
            var r = await Api.call('admin.savePartner', { partner: { id: p.id, name: p.name, note: p.note, url: p.url, logo: p.logo, active: false } });
            Analytics.track('partner removed');
            drawPartners(r.partners);
            toast('Saved');
            App.refreshPublic();
          } catch (e) { toast(e.message); }
        });
      });
    }
    var pf = $('#partnerForm');
    function partnerMode(editing) {
      $('[data-partner-save]', pf).textContent = editing ? 'Save partner' : 'Add partner';
      $('[data-partner-cancel]', pf).hidden = !editing;
      if (!editing) { pf.reset(); pf.elements.id.value = ''; }
    }
    $('[data-partner-cancel]', pf).addEventListener('click', function () { clearErrors(pf); partnerMode(false); });
    drawPartners(data.partners);
    pf.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearErrors(pf);
      var fd = new FormData(pf);
      var id = fd.get('id');
      try {
        var partner = { name: fd.get('name'), note: fd.get('note'), url: fd.get('url'), logo: fd.get('logo'), position: fd.get('position') };
        if (id) partner.id = id;
        var r = await Api.call('admin.savePartner', { partner: partner });
        Analytics.track(id ? 'partner edited' : 'partner added');
        drawPartners(r.partners);
        partnerMode(false);
        toast('Saved');
        App.refreshPublic();
      } catch (err) { showErrors(pf, err); }
    });

    $$('[data-rule]').forEach(function (c) {
      c.addEventListener('change', async function () {
        var parts = c.dataset.rule.split(':');
        c.disabled = true;
        try {
          await Api.call('admin.setRule', { viewer: parts[0], subject: parts[1], value: c.checked });
          Analytics.track('rule changed', { viewer: parts[0], subject: parts[1], value: c.checked });
          App.refresh().catch(function () {});
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
          Analytics.track('access request handled', { decision: decision, linked: !!$('[data-link]', row).value });
          App.refresh().catch(function () {});
          toast(decision === 'approve' ? 'Approved, and we emailed them' : 'Declined');
          reloadAdmin();
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
        Analytics.track('members imported', { added: r.added, updated: r.updated || 0, skipped: r.skipped.length, tier: $('#bulkTier').value });
        App.refresh().catch(function () {});
        toast(r.added + (r.updated ? ' added, ' + r.updated + ' updated' : ' added'));
        await reloadAdmin();
        if (r.skipped.length) {
          $('#bulkResult').innerHTML = '<div class="note warn">Skipped:<br>' + r.skipped.map(function (s) { return esc(s.line) + ': ' + esc(s.reason); }).join('<br>') + '</div>';
        }
      } catch (err) { setBusy(btn, false); toast(err.message); }
    });

    $$('[data-send-link]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        setBusy(btn, true, 'Sending…');
        try {
          await Api.call('admin.sendSignIn', { memberId: btn.closest('[data-member]').dataset.member });
          Analytics.track('sign in link sent');
          toast('Sign-in link sent');
        } catch (err) { toast(err.message); }
        setBusy(btn, false);
      });
    });

    $$('[data-member]').forEach(function (row) {
      $('[data-save]', row).addEventListener('click', async function (e) {
        var btn = e.target;
        var val = function (f) { var el = $('[data-f="' + f + '"]', row); return el.type === 'checkbox' ? el.checked : el.value; };
        setBusy(btn, true, 'Saving…');
        try {
          await Api.call('admin.saveMember', { member: { id: row.dataset.member, name: val('name'), email: val('email'), alt_emails: val('alt_emails'), tier: val('tier'), cohort: val('cohort'), active: val('active') } });
          Analytics.track('member saved', { tier: val('tier'), active: val('active') });
          App.refresh().catch(function () {});
          setBusy(btn, false);
          toast('Saved');
          // The row's own line shows the saved name, tier and email.
          reloadAdmin();
        } catch (err) { setBusy(btn, false); toast(err.message); }
      });
    });

    // The member list: search and the Show buttons narrow it, and a row opens its fields.
    var searchText = {};
    var groupOf = {};
    data.members.forEach(function (m) {
      searchText[m.id] = (m.name + ' ' + m.email).toLowerCase();
      groupOf[m.id] = { all: true, never: m.active && !m.joined, unlinked: !m.email };
    });
    function narrow() {
      var q = $('#adminFilter').value.trim().toLowerCase();
      var any = false;
      $$('.member-row', body).forEach(function (row) {
        var id = row.dataset.row;
        var on = groupOf[id][show] && (!q || searchText[id].indexOf(q) !== -1);
        row.hidden = !on;
        row.nextElementSibling.hidden = !on || open !== id;
        if (on) any = true;
      });
      $('#noMembers').hidden = any;
    }
    // Typing here is finding, not editing, so it doesn't hold back a fresh copy.
    $('#adminFilter').addEventListener('input', function (e) { e.stopPropagation(); narrow(); });
    $$('[data-show]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        show = b.dataset.show;
        $$('[data-show]', body).forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        narrow();
      });
    });
    $$('.member-row', body).forEach(function (row) {
      row.addEventListener('click', function () {
        open = open === row.dataset.row ? '' : row.dataset.row;
        $$('.member-row', body).forEach(function (r) {
          var isOpen = r.dataset.row === open;
          r.classList.toggle('open', isOpen);
          $('.member-open', r).setAttribute('aria-expanded', String(isOpen));
          r.nextElementSibling.hidden = !isOpen || r.hidden;
        });
      });
    });
    $('#addToggle').addEventListener('click', function (e) {
      adding = !adding;
      $('#s-add').hidden = !adding;
      e.currentTarget.setAttribute('aria-expanded', String(adding));
      if (adding) $('#bulk').focus();
    });
    narrow();

    [['#exportCsv', 'admin.export'], ['#exportAtt', 'admin.exportAttendance']].forEach(function (x) {
      $(x[0]).addEventListener('click', async function (e) {
        var btn = e.target;
        setBusy(btn, true, 'Exporting…');
        try {
          var r = await Api.call(x[1]);
          Analytics.track('export downloaded', { kind: x[1] === 'admin.export' ? 'members' : 'attendance' });
          App.downloadFile(r.filename, 'text/csv;charset=utf-8', '﻿' + r.csv);
        } catch (err) { toast(err.message); }
        setBusy(btn, false);
      });
    });
  }

  function nameOf(data, id) {
    var m = data.members.filter(function (x) { return x.id === id; })[0];
    return m ? m.name : id;
  }

  // Picks the member whose name shares the most words with the request.
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

  App.route('admin', { page: pageAdmin, wire: wireAdmin, member: true });
})();
