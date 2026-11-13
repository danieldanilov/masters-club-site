// Admin: how the club is doing, what's waiting, who's in, who sees what, the public pages.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, loading = App.loading, errorBlock = App.errorBlock, setBusy = App.setBusy, wireRetry = App.wireRetry, clearErrors = App.clearErrors, showErrors = App.showErrors, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;


  function pageAdmin() {
    if (state.me.tier !== 'leader') return page('<div class="note warn">Admin is for leaders only.</div>');
    return page('<div class="page-head"><h1>Admin</h1></div><div id="adminBody">' + loading('Loading') + '</div>');
  }

  async function wireAdmin() {
    if (state.me.tier !== 'leader') return;
    var data;
    try {
      data = await Api.call('admin.overview');
    } catch (e) {
      if (e.code === 'unauthorized' || e.code === 'forbidden') return App.refresh().then(App.render, App.render);
      $('#adminBody').innerHTML = errorBlock(e);
      return wireRetry();
    }
    var tiers = Core.TIERS;
    var tierSelect = function (attr, val) {
      return '<select ' + attr + '>' + tiers.map(function (t) { return '<option value="' + t + '" ' + (val === t ? 'selected' : '') + '>' + esc(TIER_LABEL[t]) + '</option>'; }).join('') + '</select>';
    };
    var pending = data.requests.filter(function (r) { return r.status === 'pending'; });
    var inquiries = data.inquiries.filter(function (i) { return i.status === 'new'; });
    var st = data.stats;
    var set = data.settings;
    var site = App.siteLink('#/members');
    var digest = Core.buildDigest({ today: state.data.today, siteUrl: site, events: state.data.events, posts: state.data.posts, joined: data.joined_this_week });
    var invite = 'The Masters Club directory is live. Find who can help with what, see what\'s coming up, and post jobs. Sign in with Google or your email, no password: ' + site;
    var notIn = data.members.filter(function (m) { return m.active && !m.joined; });

    var requestsHtml = pending.length ? pending.map(function (r) {
      var guess = bestMatch(r.name, data.members);
      // Linking gives them that member's account, so it's always a choice, never the default.
      var google = r.google_name && r.google_name !== r.name ? '<div class="muted small ph-sensitive" dir="auto">Google calls them ' + esc(r.google_name) + '</div>' : '';
      return '<div class="request" data-request="' + esc(r.id) + '"><div><span class="who" dir="auto">' + esc(r.name) + '</span> <span class="muted ph-sensitive">' + esc(r.email) + '</span>' + google +
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

    $('#adminBody').innerHTML =
      '<p class="stats">' + st.joined + ' of ' + st.members + ' have signed in, ' + st.active30 + ' came by in the last 30 days, ' + st.profiles + ' have a profile.</p>' +
      '<nav class="admin-jump" aria-label="Admin sections"><button class="chip" type="button" data-jump="s-waiting">Waiting</button><button class="chip" type="button" data-jump="s-spread">Spread the word</button><button class="chip" type="button" data-jump="s-add">Add people</button><button class="chip" type="button" data-jump="s-members">Members</button><button class="chip" type="button" data-jump="s-public">Public pages</button><button class="chip" type="button" data-jump="s-rules">Who sees whom</button><button class="chip" type="button" data-jump="s-log">Activity</button></nav>' +
      '<section class="admin-section" id="s-waiting"><h2>Access requests' + (pending.length ? ' <span class="badge">' + pending.length + '</span>' : '') + '</h2>' + requestsHtml + '</section>' +
      '<section class="admin-section"><h2>Partner messages' + (inquiries.length ? ' <span class="badge">' + inquiries.length + '</span>' : '') + '</h2>' + inquiriesHtml + '</section>' +

      '<section class="admin-section" id="s-spread"><h2>Spread the word</h2><p class="muted measure">WhatsApp stays where people talk. These open it with the message written, ready for you to pick the group and send.</p><div class="row-actions" style="margin-top:12px">' +
      (digest ? '<a class="btn gold small" href="' + esc(Core.whatsappUrl(digest)) + '" target="_blank" rel="noopener" id="postDigest">Post the weekly update on WhatsApp</a><button class="btn quiet small" id="copyDigest">Copy the update</button>' : '<span class="muted">Nothing new for a weekly update right now.</span>') +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(invite)) + '" target="_blank" rel="noopener" id="postInvite">Invite people on WhatsApp</a></div>' +
      (notIn.length ? '<details class="not-in"><summary>' + notIn.length + ' haven\'t signed in yet</summary><p class="muted" dir="auto">' + esc(notIn.map(function (m) { return m.name; }).join(', ')) + '</p></details>' : '') + '</section>' +

      '<section class="admin-section" id="s-rules"><h2>Who sees whom in the directory</h2><div class="table-wrap matrix"><table class="matrix">' +
      '<thead><tr><th>Viewer</th>' + tiers.map(function (t) { return '<th>Sees ' + esc(TIER_LABEL[t]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tiers.map(function (v) {
        return '<tr><td>' + esc(TIER_LABEL[v]) + '</td>' + tiers.map(function (s) {
          return '<td><input type="checkbox" aria-label="' + esc(TIER_LABEL[v] + ' sees ' + TIER_LABEL[s]) + '" data-rule="' + v + ':' + s + '" ' + (data.rules[v][s] ? 'checked' : '') + ' ' + (v === 'leader' ? 'disabled' : '') + '></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="muted small" style="margin-top:10px">Leaders always see everyone. Changes apply on each member\'s next page load.</p></section>' +

      '<section class="admin-section" id="s-add"><h2>Add people</h2><div class="form-grid" style="max-width:720px">' +
      '<label>One per line as "Name, email", or paste rows from a sheet, header row included <span class="hint">From a sheet we read only name, email, position, company, city, program, LinkedIn, interests, tier and cohort. Everything else in the paste is ignored, and people already here only get what\'s empty filled in.</span><textarea id="bulk" rows="5" placeholder="Shir Amar, shir.amar@gmail.com&#10;Ben Tal"></textarea></label>' +
      '<div class="add-row"><label>Tier ' + tierSelect('id="bulkTier"', 'club') + '</label>' +
      '<label>Cohort number <input type="text" id="bulkCohort" inputmode="numeric" placeholder="2" maxlength="20" style="width:120px"></label>' +
      '<button class="btn gold" id="bulkAdd">Add</button></div><div id="bulkResult"></div></div></section>' +

      '<section class="admin-section" id="s-grad"><h2>When a cohort ends</h2><div class="add-row"><label>Cohort number <input type="text" id="gradCohort" inputmode="numeric" maxlength="20" style="width:120px"></label><button class="btn quiet" id="gradGo">Move to community</button></div><p class="muted small" style="margin-top:8px">Its club members become community members. Leaders stay leaders.</p></section>' +

      '<section class="admin-section" id="s-members"><div class="page-head" style="margin-bottom:14px"><h2 style="font-size:1.75rem">Members</h2><span class="count">' + data.members.length + '</span><span class="spacer"></span>' +
      '<input type="search" id="adminFilter" placeholder="Filter by name or email" aria-label="Filter members" style="max-width:260px"><button class="btn quiet small" id="exportCsv">Export members</button><button class="btn quiet small" id="exportAtt">Export attendance</button></div>' +
      '<div class="table-wrap"><table class="members-table"><thead><tr><th>Name</th><th>Email</th><th>Second email</th><th>Tier</th><th>Cohort</th><th>Last seen</th><th>Came to</th><th>Active</th><th></th></tr></thead><tbody>' +
      data.members.map(function (m) {
        var self = m.id === state.me.id;
        return '<tr data-member="' + esc(m.id) + '">' +
          '<td><span class="cell-label" aria-hidden="true">Name</span><input type="text" data-f="name" value="' + esc(m.name) + '" maxlength="60" dir="auto" aria-label="Name"></td>' +
          '<td><span class="cell-label" aria-hidden="true">Email</span><input type="email" data-f="email" value="' + esc(m.email) + '" placeholder="Not linked yet" aria-label="Email"></td>' +
          '<td><span class="cell-label" aria-hidden="true">Second email</span><input type="text" data-f="alt_emails" value="' + esc(m.alt_emails) + '" aria-label="Second email"></td>' +
          '<td><span class="cell-label" aria-hidden="true">Tier</span>' + tierSelect('data-f="tier" aria-label="Tier"' + (self ? ' disabled' : ''), m.tier) + '</td>' +
          '<td><span class="cell-label" aria-hidden="true">Cohort</span><input type="text" data-f="cohort" value="' + esc(m.cohort) + '" maxlength="20" aria-label="Cohort"></td>' +
          '<td class="plain"><span class="cell-label" aria-hidden="true">Last seen</span>' + esc(m.last_seen ? Core.shortDate(m.last_seen) : 'Never') + '</td>' +
          '<td class="plain"><span class="cell-label" aria-hidden="true">Came to</span>' + m.attended + '</td>' +
          '<td><label class="active-cell"><input type="checkbox" data-f="active" aria-label="Active" ' + (m.active ? 'checked' : '') + (self ? ' disabled' : '') + '><span class="cell-label" aria-hidden="true">Active</span></label></td>' +
          '<td><button class="btn quiet small" data-save>Save</button></td></tr>';
      }).join('') + '</tbody></table></div></section>' +

      '<section class="admin-section" id="s-public"><h2>Public pages</h2><div class="admin-pair"><form class="form-grid" id="settingsForm" novalidate style="max-width:720px">' +
      '<label class="check-line"><input type="checkbox" name="applications_open" ' + (set.applications_open === undefined || Core.toBool(set.applications_open) ? 'checked' : '') + '> Applications are open</label>' +
      '<label>Application link<input type="url" name="apply_url" value="' + esc(set.apply_url || CONTENT.applyUrl) + '"><span class="field-error" data-err="apply_url"></span></label>' +
      '<label>A line above the application button <span class="hint">Optional, like the closing date</span><input type="text" name="applications_note" value="' + esc(set.applications_note || '') + '" maxlength="200" dir="auto"><span class="field-error" data-err="applications_note"></span></label>' +
      '<label>Opening line on the Partners page <span class="hint">Optional</span><textarea name="partner_intro" rows="2" maxlength="500" dir="auto">' + esc(set.partner_intro || '') + '</textarea><span class="field-error" data-err="partner_intro"></span></label>' +
      '<label>Email leaders about new requests and partner messages at <span class="hint">Never shown publicly</span><input type="email" name="notify_email" value="' + esc(set.notify_email || '') + '"><span class="field-error" data-err="notify_email"></span></label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save public pages</button></div></form>' +
      '<div class="admin-partners"><h3>Partners on the public page</h3><div id="partnerList"></div>' +
      '<form class="form-grid" id="partnerForm" novalidate style="max-width:720px;margin-top:16px"><input type="hidden" name="id"><div class="form-row"><label>Name<input type="text" name="name" maxlength="60"><span class="field-error" data-err="name"></span></label>' +
      '<label>Line about them<input type="text" name="note" maxlength="200" dir="auto"><span class="field-error" data-err="note"></span></label></div>' +
      '<div class="form-row"><label>Website<input type="url" name="url" placeholder="https://..."><span class="field-error" data-err="url"></span></label><label>Logo link<input type="url" name="logo" placeholder="https://..."><span class="field-error" data-err="logo"></span></label></div>' +
      '<div class="form-row"><label>Place on the page <span class="hint">1 shows first; empty goes after the numbered ones</span><input type="number" name="position" min="1" max="999" step="1" inputmode="numeric"><span class="field-error" data-err="position"></span></label></div>' +
      '<div class="row-actions"><button class="btn quiet" type="submit" data-partner-save>Add partner</button><button class="link" type="button" data-partner-cancel hidden>Cancel</button></div></form></div></div>' +
      '<p class="muted small measure" style="margin-top:16px">Next meeting on Home comes from the next event marked public. Past meetings come from public events with a recap. Tiers and leader photos live in content.js, see docs/05-operations.md.</p></section>' +

      '<section class="admin-section" id="s-log"><h2>Recent activity</h2><div class="log ph-sensitive">' + (data.log.length ? data.log.map(function (l) {
        return '<div><span class="muted">' + esc(String(l.at).slice(0, 10)) + '</span> ' + esc(nameOf(data, l.actor)) + ': ' + esc(l.action) + (l.detail ? ' <span class="muted">' + esc(l.detail) + '</span>' : '') + '</div>';
      }).join('') : '<p class="muted">Nothing yet.</p>') + '</div></section>';

    $$('[data-jump]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); var t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView(); });
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
        wireAdmin();
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
        return '<div class="request" data-partner="' + esc(p.id) + '"><div>' + (p.position ? '<span class="place">' + p.position + '.</span> ' : '') + '<span class="who" dir="auto">' + esc(p.name) + '</span> <span class="muted" dir="auto">' + esc(p.note) + '</span></div><div class="row-actions"><button class="btn quiet small" data-edit-partner>Edit</button><button class="btn quiet small" data-unlist>Take off the page</button></div></div>';
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
        Analytics.track('members imported', { added: r.added, updated: r.updated || 0, skipped: r.skipped.length, tier: $('#bulkTier').value });
        App.refresh().catch(function () {});
        toast(r.added + (r.updated ? ' added, ' + r.updated + ' updated' : ' added'));
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
          await Api.call('admin.saveMember', { member: { id: row.dataset.member, name: val('name'), email: val('email'), alt_emails: val('alt_emails'), tier: val('tier'), cohort: val('cohort'), active: val('active') } });
          Analytics.track('member saved', { tier: val('tier'), active: val('active') });
          App.refresh().catch(function () {});
          setBusy(btn, false);
          toast('Saved');
        } catch (err) { setBusy(btn, false); toast(err.message); }
      });
    });

    var searchText = {};
    data.members.forEach(function (m) { searchText[m.id] = (m.name + ' ' + m.email).toLowerCase(); });
    $('#adminFilter').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      $$('[data-member]').forEach(function (row) { row.style.display = !q || searchText[row.dataset.member].indexOf(q) !== -1 ? '' : 'none'; });
    });

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

  App.route('#/admin', { page: pageAdmin, wire: wireAdmin, member: true });
})();
