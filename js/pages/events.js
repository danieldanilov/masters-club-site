// Events: what's coming, signing up, and running one (who's in, attendance, payment, groups).
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;

  var dateBlock = function (e) {
    return '<div class="date" aria-hidden="true"><b>' + Number(e.date.slice(8)) + '</b><span>' + esc(App.longDate(e.date).split(' ')[1].slice(0, 3)) + '</span></div>';
  };
  var find = function (id) { return state.data.events.filter(function (e) { return e.id === id; })[0]; };
  var when = function (e) { return Core.weekday(e.date) + ', ' + App.longDate(e.date) + ' at ' + e.time; };
  var audienceLabel = function (a) {
    if (a === 'all') return 'Everyone';
    if (a === 'club') return 'Club';
    if (a === 'community') return 'Community';
    if (a === 'leaders') return 'Leaders';
    return cohortLabel(a.replace('cohort:', ''));
  };
  var statusLine = function (e) {
    if (e.status === 'cancelled') return '<span class="tag unjoined">Cancelled</span>';
    if (e.me.status === 'going') return '<span class="tag club">You\'re going</span>';
    if (e.me.status === 'waitlist') return '<span class="tag">You\'re on the waitlist</span>';
    return '';
  };

  /* ---------- the list ---------- */

  function pageEvents() {
    return page('<div class="page-head"><h1>Events</h1><span class="spacer"></span><a class="link" href="#/event-edit">Post an event</a></div><div id="eventList"></div>');
  }

  function drawList() {
    var today = state.data.today;
    var all = state.data.events;
    var next = all.filter(function (e) { return e.date >= today; });
    var past = all.filter(function (e) { return e.date < today; }).reverse();
    var row = function (e) {
      return '<a class="event-row" href="#/event?e=' + esc(e.id) + '">' + dateBlock(e) + '<span class="body"><h2 class="title" dir="auto">' + esc(e.title) + '</h2>' +
        '<span class="muted" dir="auto">' + esc(Core.weekday(e.date)) + ' at ' + esc(e.time) + (e.place ? ', ' + esc(e.place) : '') + '</span>' +
        '<span class="tags"><span class="tag">' + esc(Core.EVENT_KINDS[e.kind] || e.kind) + '</span>' + statusLine(e) + '</span></span></a>';
    };
    $('#eventList').innerHTML = (next.length ? next.map(row).join('') : '<div class="empty">Nothing on the calendar yet. Post a low-key meetup, or check back soon.</div>') +
      (past.length ? '<h2 class="past-title">Recently</h2>' + past.map(row).join('') : '');
  }

  /* ---------- one event ---------- */

  function pageEvent(params) {
    var e = find(params.get('e'));
    if (!e) return page('<div class="note warn">This event isn\'t here. It may be for another group, or it has passed.</div><p style="margin-top:16px"><a class="link" href="#/events">All events</a></p>');
    return page('<p class="back"><a class="link" href="#/events">All events</a></p><div id="eventBody">' + eventHtml(e) + '</div>');
  }

  function seatNote(e) {
    if (state.me.tier === 'community' && e.community_seats !== '') {
      return Math.max(0, e.community_left) + ' of ' + e.community_seats + ' community seats left';
    }
    if (e.seats !== '') return Math.max(0, Number(e.seats) - e.going_count) + ' of ' + e.seats + ' seats left';
    return '';
  }

  function eventHtml(e) {
    var link = App.siteLink('#/event?e=' + e.id);
    var share = e.title + '\n' + Core.shortDate(e.date) + ', ' + e.time + (e.place ? ', ' + e.place : '') + '\n' + link;
    var signup = '';
    if (e.status !== 'cancelled') {
      if (e.me.status === 'going' || e.me.status === 'waitlist') {
        signup = '<p class="you">' + (e.me.status === 'going' ? "You're going" : "You're on the waitlist. If a seat opens up, we'll email you.") + '</p>' +
          (e.signup.open || e.date >= state.data.today ? '<button class="btn quiet" data-rsvp="out">I can\'t make it</button>' : '');
      } else if (e.signup.open) {
        signup = '<button class="btn gold" data-rsvp="in">' + (e.next_seat === 'going' ? "I'm in" : 'Join the waitlist') + '</button>';
      } else {
        signup = '<p class="muted">' + esc(e.signup.reason) + '</p>';
      }
    }
    var others = e.going_count - e.attendees.length;
    return '<h1 dir="auto">' + esc(e.title) + '</h1>' +
      '<div class="tags" style="margin-top:12px"><span class="tag">' + esc(Core.EVENT_KINDS[e.kind] || e.kind) + '</span><span class="tag">' + esc(audienceLabel(e.audience)) + '</span>' + (e.status === 'cancelled' ? statusLine(e) : '') + '</div>' +
      '<p class="lead" style="margin-top:16px">' + esc(when(e)) + (e.end_time ? ' to ' + esc(e.end_time) : '') + '</p>' +
      (e.place ? '<p dir="auto">' + (e.map_url ? '<a class="link" href="' + esc(e.map_url) + '" target="_blank" rel="noopener">' + esc(e.place) + '</a>' : esc(e.place)) + '</p>' : '') +
      (e.details ? '<p class="details" dir="auto">' + esc(e.details) + '</p>' : '') +
      (e.price ? '<p>' + esc(e.price) + (e.pay_url ? ' <a class="link" href="' + esc(e.pay_url) + '" target="_blank" rel="noopener">Pay here</a>' : '') + (e.me.paid ? ' <span class="tag">Paid</span>' : '') + '</p>' : '') +
      (seatNote(e) && !e.me.status ? '<p class="muted">' + esc(seatNote(e)) + '</p>' : '') +
      (e.rsvp_closes && e.signup.open ? '<p class="muted">Sign-up closes ' + esc(Core.shortDate(e.rsvp_closes.slice(0, 10))) + ' at ' + esc(e.rsvp_closes.slice(11)) + '</p>' : '') +
      '<div class="signup">' + signup + '</div>' +
      (e.me.group ? '<p class="you">Your table: ' + esc(e.me.group) + (e.me.groupmates.length ? ', with ' + esc(e.me.groupmates.join(', ')) : '') + '</p>' : '') +
      '<div class="actions event-actions"><a class="btn quiet small" href="' + esc(Core.googleCalendarUrl(e, link)) + '" target="_blank" rel="noopener">Google Calendar</a>' +
      '<button class="btn quiet small" data-ics>Apple or Outlook</button>' +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(share)) + '" target="_blank" rel="noopener">Share on WhatsApp</a></div>' +
      '<h2 class="sub">Who\'s coming</h2>' +
      (e.going_count ? '<p>' + e.attendees.map(function (a) { return '<a class="person-link" href="#/members?m=' + esc(a.id) + '" dir="auto">' + esc(a.name) + '</a>'; }).join(', ') +
        (others > 0 ? (e.attendees.length ? ' and ' : '') + others + ' more' : '') + '</p>' : '<p class="muted">Nobody yet.</p>') +
      (e.waitlist_count ? '<p class="muted">' + e.waitlist_count + ' on the waitlist</p>' : '') +
      (e.owners.length ? '<p class="muted">Run by ' + esc(e.owners.map(function (o) { return o.name; }).join(', ')) + '</p>' : '') +
      (e.can_manage ? '<div class="row-actions" style="margin-top:28px"><a class="link" href="#/event-roster?e=' + esc(e.id) + '">Manage sign-ups</a><a class="link" href="#/event-edit?e=' + esc(e.id) + '">Edit</a>' +
        '<button class="link" data-cancel>' + (e.status === 'cancelled' ? 'Bring it back' : 'Cancel the event') + '</button></div>' : '');
  }

  function wireEvent(params) {
    var e = find(params.get('e'));
    if (!e) return;
    var box = $('#eventBody');
    var redraw = function () { box.innerHTML = eventHtml(find(e.id)); wire(); };
    function wire() {
      $$('[data-rsvp]', box).forEach(function (b) {
        b.addEventListener('click', async function () {
          setBusy(b, true, 'One moment…');
          try {
            var r = await Api.call('rsvp', { eventId: e.id, going: b.dataset.rsvp === 'in' });
            App.replaceItem('events', r.event);
            redraw();
          } catch (err) { setBusy(b, false); toast(err.message); }
        });
      });
      $('[data-ics]', box).addEventListener('click', function () {
        App.downloadFile(e.id + '.ics', 'text/calendar;charset=utf-8', Core.toIcs(find(e.id), App.siteLink('#/event?e=' + e.id)));
      });
      var c = $('[data-cancel]', box);
      if (c) c.addEventListener('click', async function () {
        var restoring = find(e.id).status === 'cancelled';
        if (!restoring && !window.confirm('Cancel this event? People who signed up will see it as cancelled.')) return;
        try {
          var r = await Api.call('eventCancel', { id: e.id, restore: restoring });
          App.replaceItem('events', r.event);
          redraw();
        } catch (err) { toast(err.message); }
      });
    }
    wire();
  }

  /* ---------- posting and editing ---------- */

  function pageEdit(params) {
    var id = params.get('e');
    var e = id ? find(id) : { kind: state.me.tier === 'leader' ? 'meeting' : 'meetup', audience: 'all', rsvp: 'open' };
    if (!e) return page('<div class="note warn">This event isn\'t here.</div>');
    var leader = state.me.tier === 'leader';
    var v = function (k) { return esc(e[k] === undefined || e[k] === null ? '' : e[k]); };
    var field = function (label, name, type, extra, hint) {
      return '<label>' + label + (hint ? ' <span class="hint">' + hint + '</span>' : '') + '<input type="' + type + '" name="' + name + '" value="' + v(name) + '" ' + (extra || '') + '><span class="field-error" data-err="' + name + '"></span></label>';
    };
    var kinds = Object.keys(Core.EVENT_KINDS).filter(function (k) { return leader || k !== 'meeting'; });
    var cohorts = Array.from(new Set(state.data.directory.members.map(function (m) { return m.cohort; }).filter(Boolean))).sort();
    var audiences = leader ? ['all', 'club', 'community'].concat(cohorts.map(function (c) { return 'cohort:' + c; })).concat(['leaders']) : ['all', state.me.tier];
    return page('<p class="back"><a class="link" href="' + (id ? '#/event?e=' + esc(id) : '#/events') + '">Back</a></p><h1>' + (id ? 'Edit the event' : 'Post an event') + '</h1>' +
      (!leader && !id ? '<p class="lead measure" style="margin-top:12px">A bar, a run, a group going to something outside. Anyone in the club can get something going.</p>' : '') +
      '<form class="form-grid event-form" id="eventForm" novalidate style="margin-top:24px">' +
      field('Title', 'title', 'text', 'maxlength="120" required dir="auto"') +
      '<div class="form-row">' + field('Date', 'date', 'date', 'required') + field('Start time', 'time', 'time', 'required') + field('End time', 'end_time', 'time', '', 'Optional') + '</div>' +
      field('Where', 'place', 'text', 'maxlength="120" dir="auto"') +
      field('Map link', 'map_url', 'url', 'placeholder="https://maps.app.goo.gl/..."', 'Optional') +
      '<label>Details<textarea name="details" rows="4" maxlength="2000" dir="auto">' + v('details') + '</textarea><span class="field-error" data-err="details"></span></label>' +
      '<div class="form-row">' +
      ((!id || leader) ? '<label>Kind<select name="kind">' + kinds.map(function (k) { return '<option value="' + k + '" ' + (e.kind === k ? 'selected' : '') + '>' + esc(Core.EVENT_KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
        '<label>Who it\'s for<select name="audience">' + audiences.map(function (a) { return '<option value="' + esc(a) + '" ' + (e.audience === a ? 'selected' : '') + '>' + esc(audienceLabel(a)) + '</option>'; }).join('') + '</select></label>' : '') +
      '</div>' +
      '<div class="form-row">' + field('Total seats', 'seats', 'text', 'inputmode="numeric"', 'Empty for no limit') + (leader ? field('Community seats', 'community_seats', 'text', 'inputmode="numeric"', 'First come, for a club meeting') : '') + field('Group size', 'group_size', 'text', 'inputmode="numeric"', 'For a dinner, like 7') + '</div>' +
      '<div class="form-row">' + field('Price', 'price', 'text', 'maxlength="40"', 'Like ₪50') + field('Payment link', 'pay_url', 'url', 'placeholder="https://..."', 'PayBox or Bit') + '</div>' +
      '<div class="form-row"><label>Sign-up<select name="rsvp"><option value="open" ' + (e.rsvp !== 'closed' ? 'selected' : '') + '>Open</option><option value="closed" ' + (e.rsvp === 'closed' ? 'selected' : '') + '>Not open yet</option></select></label>' +
      field('Sign-up closes', 'rsvp_closes', 'datetime-local', '', 'Optional') + '</div>' +
      (leader ? '<label class="check-line"><input type="checkbox" name="public" ' + (e.public ? 'checked' : '') + '> Show on the public site</label>' +
        '<label>Run by <span class="hint">These people can edit it and see sign-ups, without being leaders</span><select name="owners" multiple size="4">' + state.data.directory.members.map(function (m) {
          return '<option value="' + esc(m.id) + '" ' + ((e.owners || []).some(function (o) { return o.id === m.id; }) ? 'selected' : '') + '>' + esc(m.name) + '</option>';
        }).join('') + '</select></label>' +
        field('Poster link', 'poster', 'url', 'placeholder="https://..."', 'For the public Meetings page') +
        '<label>Recap <span class="hint">Once it has happened, this puts it on the public Meetings page</span><textarea name="recap" rows="3" maxlength="1000" dir="auto">' + v('recap') + '</textarea><span class="field-error" data-err="recap"></span></label>' : '') +
      '<div class="row-actions"><button class="btn gold" type="submit">Save event</button></div></form>');
  }

  function wireEdit(params) {
    var f = $('#eventForm');
    if (!f) return;
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      clearErrors(f);
      var fd = new FormData(f);
      var input = {};
      fd.forEach(function (val, k) { if (k !== 'owners') input[k] = val; });
      input.public = !!fd.get('public');
      if (params.get('e')) input.id = params.get('e');
      if (f.elements.owners) input.owners = fd.getAll('owners');
      var check = Core.validateEvent(input);
      if (!check.ok) return showErrors(f, { message: 'Some fields need fixing', fields: check.errors });
      var btn = $('button[type=submit]', f);
      setBusy(btn, true);
      try {
        var r = await Api.call('eventSave', { event: input });
        App.replaceItem('events', r.event);
        state.data.events.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
        App.saveData();
        toast('Saved');
        go('#/event?e=' + r.event.id);
      } catch (err) { setBusy(btn, false); showErrors(f, err); }
    });
  }

  /* ---------- running it ---------- */

  function pageRoster(params) {
    var e = find(params.get('e'));
    if (!e) return page('<div class="note warn">This event isn\'t here.</div>');
    return page('<p class="back"><a class="link" href="#/event?e=' + esc(e.id) + '">Back to the event</a></p><div class="page-head"><h1 dir="auto">' + esc(e.title) + '</h1><span class="spacer"></span>' +
      '<button class="btn quiet small" data-groups>Make groups</button><button class="btn quiet small" data-copy>Copy the names</button></div>' +
      '<p class="muted">' + esc(when(e)) + '</p><div id="roster">' + App.loading('Loading sign-ups') + '</div>' +
      (state.me.tier === 'leader' ? '<section class="roster-add"><label>Add someone who called<select id="addWho"><option value="">Choose a member</option>' + state.data.directory.members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'; }).join('') + '</select></label><button class="btn quiet small" data-add>Add</button></section>' : ''));
  }

  function drawRoster(eventId, rows) {
    var box = $('#roster');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<p class="muted" style="margin-top:20px">Nobody has signed up yet.</p>'; return; }
    box.innerHTML = '<div class="roster">' + rows.map(function (r) {
      return '<div class="roster-row" data-row="' + esc(r.member_id) + '"><div class="who"><span class="name" dir="auto">' + esc(r.name) + '</span> <span class="tag ' + esc(r.tier) + '">' + esc(TIER_LABEL[r.tier] || '') + '</span>' +
        (r.status === 'waitlist' ? ' <span class="tag">Waitlist</span>' : '') + (r.email ? '<div class="muted small">' + esc(r.email) + '</div>' : '') + (r.note ? '<div class="muted small" dir="auto">' + esc(r.note) + '</div>' : '') + '</div>' +
        '<label>Attendance<select data-f="attended">' + [['', 'Not marked'], ['yes', 'Came'], ['no', "Didn't come"], ['excused', 'Excused']].map(function (o) { return '<option value="' + o[0] + '" ' + (r.attended === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Group<input type="text" data-f="group" value="' + esc(r.group) + '" maxlength="60" dir="auto"></label>' +
        '<label class="check-line"><input type="checkbox" data-f="paid" ' + (r.paid ? 'checked' : '') + '> Paid</label></div>';
    }).join('') + '</div>';
    $$('[data-row]', box).forEach(function (row) {
      $$('[data-f]', row).forEach(function (el) {
        el.addEventListener('change', async function () {
          var patch = { eventId: eventId, memberId: row.dataset.row };
          patch[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
          try { await Api.call('rosterUpdate', patch); toast('Saved'); } catch (err) { toast(err.message); }
        });
      });
    });
  }

  async function wireRoster(params) {
    var id = params.get('e');
    if (!find(id)) return;
    var rows = [];
    var load = function (r) { rows = r.rows; drawRoster(id, rows); };
    try { load(await Api.call('eventRoster', { eventId: id })); } catch (err) { $('#roster').innerHTML = '<div class="note warn">' + esc(err.message) + '</div>'; return; }
    $('[data-groups]').addEventListener('click', async function (ev) {
      setBusy(ev.target, true, 'Making…');
      try { load(await Api.call('rosterGroups', { eventId: id })); toast('Groups made'); } catch (err) { toast(err.message); }
      setBusy(ev.target, false);
    });
    $('[data-copy]').addEventListener('click', function () {
      App.copyText(rows.filter(function (r) { return r.status === 'going'; }).map(function (r) { return r.name + (r.group ? ' (' + r.group + ')' : ''); }).join('\n'));
    });
    var add = $('[data-add]');
    if (add) add.addEventListener('click', async function () {
      var who = $('#addWho').value;
      if (!who) return;
      try { load(await Api.call('rosterAdd', { eventId: id, memberId: who })); toast('Added'); } catch (err) { toast(err.message); }
    });
  }

  App.route('#/events', { page: pageEvents, wire: drawList, member: true, onData: function () { if ($('#eventList')) drawList(); } });
  App.route('#/event', { page: pageEvent, wire: wireEvent, member: true, onData: function (params) { if ($('#eventBody') && find(params.get('e'))) { $('#eventBody').innerHTML = eventHtml(find(params.get('e'))); wireEvent(params); } } });
  App.route('#/event-edit', { page: pageEdit, wire: wireEdit, member: true });
  App.route('#/event-roster', { page: pageRoster, wire: wireRoster, member: true });
})();
