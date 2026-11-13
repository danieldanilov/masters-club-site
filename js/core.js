/*
 * Core logic for The Masters Club, shared by the Apps Script API, the site and the tests.
 * No I/O here: anything that touches the Sheet, the network or crypto is passed in.
 * Loaded as a plain script (Apps Script, browser) or with require() (Node).
 */
var Core = (function () {
  var TIERS = ['leader', 'club', 'community'];
  var TIER_LABEL = { leader: 'Leader', club: 'Club', community: 'Community' };
  var INDUSTRIES = ['SaaS', 'Fintech', 'Cyber', 'Gaming', 'Health', 'Consulting', 'Venture capital',
    'Real estate', 'Media', 'Finance', 'Retail', 'Education', 'Government', 'Other'];
  var OPEN_TO = ['Coffee chats', 'Mentoring', 'Hiring', 'Job hunting', 'Collaborating', 'Hosting a dinner'];
  var LIMITS = { name: 60, role: 60, company: 60, city: 60, program: 100, bio: 280, tag: 40, tags: 6, note: 280, linkedin: 200, title: 120, place: 120, details: 2000, price: 40, recap: 1000, url: 500, contact: 120 };
  var DEFAULT_RULES = {
    leader: { leader: true, club: true, community: true },
    club: { leader: true, club: true, community: true },
    community: { leader: true, club: true, community: true }
  };
  // Sign-in codes sent by email. A code lasts 10 minutes and allows 5 tries. Each address gets
  // a code at most every 30 seconds and 3 in 6 hours; addresses not on the list share 20 in
  // 6 hours, and get none once the day's mail is down to the last 20 (kept for members). Access
  // requests from guests share 10 in 6 hours, and leaders' notification emails stop at that reserve.
  // Sign-in emails: a code lives 30 minutes; each new email to the same address waits longer than
  // the last (F110), and a day with none starts the count again. quotaReserve is the day's mail
  // kept for sign-in emails; requests and partner messages share a cap per window.
  var CODE_LIMITS = {
    ttlMs: 30 * 60 * 1000, maxTries: 5,
    waitsMs: [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 3 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
    quietMs: 24 * 60 * 60 * 1000, quotaReserve: 20, requestsPerWindow: 10, windowMs: 6 * 60 * 60 * 1000
  };
  var PROFILE_FIELDS = ['role', 'company', 'city', 'program', 'industry', 'help', 'looking', 'open_to', 'interests', 'linkedin', 'phone', 'show_phone', 'show_email', 'hidden', 'bio', 'photo'];
  // Adding a kind of event or post is one line here; the forms and pages read these lists.
  var EVENT_KINDS = { meeting: 'Meeting', meetup: 'Meetup', dinner: 'Dinner', external: 'Outside event' };
  var POST_KINDS = { job: 'Job', opportunity: 'Opportunity', ask: 'Ask', resource: 'Resource', partner: 'From a partner' };
  var LEADER_POST_KINDS = ['partner'];
  var POST_DAYS = 60;
  var STALE_DAYS = 180;
  var TIME_ZONE = 'Asia/Jerusalem';

  function toBool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') return /^(true|yes|1)$/i.test(v.trim());
    return false;
  }

  function str(v) {
    return v === null || v === undefined ? '' : String(v).trim();
  }

  function isTier(t) {
    return TIERS.indexOf(t) !== -1;
  }

  /* ---------- rules ---------- */

  function normalizeRules(rules) {
    var out = {};
    TIERS.forEach(function (viewer) {
      out[viewer] = {};
      TIERS.forEach(function (subject) {
        var given = rules && rules[viewer] && rules[viewer][subject];
        out[viewer][subject] = given === undefined || given === null || given === ''
          ? DEFAULT_RULES[viewer][subject]
          : toBool(given);
      });
    });
    out.leader = { leader: true, club: true, community: true };
    return out;
  }

  function canSee(rules, viewerTier, subjectTier) {
    if (!isTier(viewerTier) || !isTier(subjectTier)) return false;
    return !!(rules && rules[viewerTier] && rules[viewerTier][subjectTier] === true);
  }

  function hiddenTiers(rules, viewerTier) {
    return TIERS.filter(function (t) { return !canSee(rules, viewerTier, t); });
  }

  /* ---------- lists, emails, ids ---------- */

  function splitList(v) {
    var arr = Array.isArray(v) ? v : str(v).split(',');
    var seen = {};
    var out = [];
    arr.forEach(function (x) {
      var s = str(x);
      var k = s.toLowerCase();
      if (s && !seen[k]) { seen[k] = true; out.push(s); }
    });
    return out;
  }

  function normalizeEmail(e) {
    return str(e).toLowerCase();
  }

  function isEmail(e) {
    return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(str(e));
  }

  function nextId(prefix, ids) {
    var max = 0;
    var re = new RegExp('^' + prefix + '(\\d+)$');
    (ids || []).forEach(function (id) {
      var m = re.exec(String(id));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var n = String(max + 1);
    while (n.length < 3) n = '0' + n;
    return prefix + n;
  }

  /* ---------- profiles ---------- */

  function publicProfile(p) {
    p = p || {};
    var out = {
      role: str(p.role),
      company: str(p.company),
      city: str(p.city),
      program: str(p.program),
      industry: str(p.industry),
      help: splitList(p.help),
      looking: splitList(p.looking),
      open_to: splitList(p.open_to),
      interests: splitList(p.interests),
      linkedin: str(p.linkedin),
      bio: str(p.bio),
      photo: str(p.photo)
    };
    if (toBool(p.show_phone) && str(p.phone)) out.phone = str(p.phone);
    return out;
  }

  function validateName(name) {
    var n = str(name).replace(/\s+/g, ' ');
    if (n.length < 2) return { ok: false, error: 'Name needs at least 2 characters' };
    if (n.length > LIMITS.name) return { ok: false, error: 'Name is longer than ' + LIMITS.name + ' characters' };
    return { ok: true, value: n };
  }

  function isLinkedIn(url) {
    return /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s"'<>]*$/i.test(url) && url.length <= LIMITS.linkedin;
  }

  function validateProfile(input) {
    input = input || {};
    var errors = {};
    var v = {};
    ['role', 'company', 'city', 'program'].forEach(function (f) {
      v[f] = str(input[f]);
      if (v[f].length > LIMITS[f]) errors[f] = 'Up to ' + LIMITS[f] + ' characters';
    });
    v.bio = str(input.bio);
    if (v.bio.length > LIMITS.bio) errors.bio = 'Up to ' + LIMITS.bio + ' characters';

    v.industry = str(input.industry);
    if (v.industry && INDUSTRIES.indexOf(v.industry) === -1) errors.industry = 'Pick one from the list';

    ['help', 'looking', 'interests'].forEach(function (f) {
      v[f] = splitList(input[f]);
      if (v[f].length > LIMITS.tags) errors[f] = 'Up to ' + LIMITS.tags + ' items';
      else if (v[f].some(function (t) { return t.length > LIMITS.tag; })) errors[f] = 'Each item up to ' + LIMITS.tag + ' characters';
    });

    v.open_to = splitList(input.open_to);
    if (v.open_to.some(function (o) { return OPEN_TO.indexOf(o) === -1; })) errors.open_to = 'Unknown option';

    v.linkedin = str(input.linkedin);
    if (v.linkedin && !isLinkedIn(v.linkedin)) errors.linkedin = 'Use your https://linkedin.com/in/... link';

    var rawPhone = str(input.phone);
    v.phone = rawPhone.replace(/[\s\-().]/g, '');
    if (v.phone && !/^\+?\d{7,15}$/.test(v.phone)) errors.phone = 'Digits only, with the country code, like +972501234567';
    v.show_phone = toBool(input.show_phone) && !!v.phone;
    v.show_email = toBool(input.show_email);
    v.hidden = toBool(input.hidden);

    var ok = Object.keys(errors).length === 0;
    return { ok: ok, value: v, errors: errors };
  }

  /* ---------- directory ---------- */

  function directoryEntry(member, profile, includePrivate) {
    var e = {
      id: member.id,
      name: str(member.name),
      tier: member.tier,
      cohort: str(member.cohort),
      joined: !!str(member.joined_on),
      profile: publicProfile(profile)
    };
    if (profile && toBool(profile.show_email) && normalizeEmail(member.email)) e.profile.email = normalizeEmail(member.email);
    if (includePrivate) {
      e.email = normalizeEmail(member.email);
      e.active = toBool(member.active);
    }
    return e;
  }

  function buildDirectory(members, profilesById, rules, viewer) {
    if (!viewer || !toBool(viewer.active) || !isTier(viewer.tier)) return { members: [], hiddenTiers: TIERS.slice() };
    var list = (members || [])
      .filter(function (m) {
        if (!toBool(m.active) || !canSee(rules, viewer.tier, m.tier)) return false;
        var p = (profilesById || {})[m.id];
        return !(p && toBool(p.hidden)) || viewer.tier === 'leader' || viewer.id === m.id;
      })
      .map(function (m) { return directoryEntry(m, (profilesById || {})[m.id], false); })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    return { members: list, hiddenTiers: hiddenTiers(rules, viewer.tier) };
  }

  function cohortLabel(c) {
    var s = str(c);
    if (!s) return '';
    return /^cohort\b/i.test(s) ? s : 'Cohort ' + s;
  }

  // Everything a member card shows, as one lowercase string to search in.
  function searchText(m) {
    var p = m.profile || {};
    return [m.name, cohortLabel(m.cohort), TIER_LABEL[m.tier] || m.tier, m.joined === false ? 'not signed in yet' : '',
      p.role, p.company, p.city, p.program, p.industry, p.bio]
      .concat(p.help || [], p.looking || [], p.open_to || [], p.interests || [])
      .join(' \n ').toLowerCase();
  }

  // Default: every word must appear somewhere on the card. opts.any: members matching any
  // word, most matching words first (the fallback when the strict search finds nobody).
  function searchMembers(list, query, filters, opts) {
    filters = filters || {};
    opts = opts || {};
    var words = str(query).toLowerCase().split(/\s+/).filter(Boolean);
    var open = filters.open || [];
    var scored = [];
    (list || []).forEach(function (m) {
      var p = m.profile || {};
      if (filters.cohort && m.cohort !== filters.cohort) return;
      if (filters.tier && m.tier !== filters.tier) return;
      if (filters.industry && p.industry !== filters.industry) return;
      if (open.length && !open.every(function (o) { return (p.open_to || []).indexOf(o) !== -1; })) return;
      if (!words.length) { scored.push({ m: m, score: 0 }); return; }
      var hay = searchText(m);
      var hits = words.filter(function (w) { return hay.indexOf(w) !== -1; }).length;
      if (opts.any ? hits > 0 : hits === words.length) scored.push({ m: m, score: hits });
    });
    if (opts.any) scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.m; });
  }

  /* ---------- dates, links, audiences ---------- */

  function isDate(s) {
    s = str(s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function isTime(s) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(str(s));
  }

  function isHttps(url) {
    url = str(url);
    return /^https:\/\/[^\s"'<>]+$/.test(url) && url.length <= LIMITS.url;
  }

  function addDays(iso, days) {
    return new Date(new Date(iso + 'T00:00:00Z').getTime() + days * 86400000).toISOString().slice(0, 10);
  }

  function weekday(iso) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(iso + 'T00:00:00Z').getUTCDay()];
  }

  // Who a post or event is for. "club" and "community" are exact, so each can have its own
  // things; "all" is everyone; "cohort:2" is one cohort. Leaders see everything.
  function isAudience(a) {
    return ['all', 'club', 'community', 'leaders'].indexOf(a) !== -1 || /^cohort:[\w-]{1,20}$/.test(str(a));
  }

  function inAudience(audience, member) {
    if (member.tier === 'leader') return true;
    if (audience === 'all') return true;
    if (audience === 'club' || audience === 'community') return member.tier === audience;
    var m = /^cohort:(.+)$/.exec(str(audience));
    return !!m && str(member.cohort) === m[1];
  }

  /* ---------- events ---------- */

  function wholeNumber(v, min) {
    var s = str(v);
    return s === '' || (/^\d+$/.test(s) && Number(s) >= min);
  }

  function validateEvent(input) {
    input = input || {};
    var e = {};
    var v = {};
    v.title = str(input.title);
    if (!v.title) e.title = 'Give it a title';
    else if (v.title.length > LIMITS.title) e.title = 'Up to ' + LIMITS.title + ' characters';
    v.date = str(input.date);
    if (!isDate(v.date)) e.date = 'Pick a date';
    v.time = str(input.time);
    if (!isTime(v.time)) e.time = 'Pick a time';
    v.end_time = str(input.end_time);
    if (v.end_time && !isTime(v.end_time)) e.end_time = 'Pick a time';
    v.place = str(input.place);
    if (v.place.length > LIMITS.place) e.place = 'Up to ' + LIMITS.place + ' characters';
    v.details = str(input.details);
    if (v.details.length > LIMITS.details) e.details = 'Up to ' + LIMITS.details + ' characters';
    v.recap = str(input.recap);
    if (v.recap.length > LIMITS.recap) e.recap = 'Up to ' + LIMITS.recap + ' characters';
    v.price = str(input.price);
    if (v.price.length > LIMITS.price) e.price = 'Up to ' + LIMITS.price + ' characters';
    ['map_url', 'pay_url', 'poster'].forEach(function (f) {
      v[f] = str(input[f]);
      if (v[f] && !isHttps(v[f])) e[f] = 'Use an https:// link';
    });
    v.audience = str(input.audience) || 'all';
    if (!isAudience(v.audience)) e.audience = 'Pick who it is for';
    v.kind = str(input.kind) || 'meetup';
    if (!Object.prototype.hasOwnProperty.call(EVENT_KINDS, v.kind)) e.kind = 'Pick a kind';
    ['seats', 'community_seats'].forEach(function (f) {
      v[f] = str(input[f]);
      if (!wholeNumber(v[f], 0)) e[f] = 'A whole number, or leave it empty';
    });
    v.group_size = str(input.group_size);
    if (!wholeNumber(v.group_size, 2)) e.group_size = 'At least 2, or leave it empty';
    v.rsvp = str(input.rsvp) === 'closed' ? 'closed' : 'open';
    v.rsvp_closes = str(input.rsvp_closes);
    if (v.rsvp_closes && !(isDate(v.rsvp_closes.slice(0, 10)) && isTime(v.rsvp_closes.slice(11)))) e.rsvp_closes = 'Pick a date and time';
    v.public = toBool(input.public);
    return { ok: Object.keys(e).length === 0, value: v, errors: e };
  }

  function goingRows(rows) {
    return rows.filter(function (r) { return r.status === 'going'; });
  }

  // "going" if a seat is free for this member right now, else "waitlist". Community seats are
  // the first-come allowance on club meetings; seats is the room's total.
  function seatFor(event, rows, member) {
    var going = goingRows(rows);
    if (str(event.seats) !== '' && going.length >= Number(event.seats)) return 'waitlist';
    if (member.tier === 'community' && str(event.community_seats) !== '' &&
        going.filter(function (r) { return r.tier === 'community'; }).length >= Number(event.community_seats)) return 'waitlist';
    return 'going';
  }

  function nextOffWaitlist(event, rows) {
    var queue = rows.filter(function (r) { return r.status === 'waitlist'; })
      .sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    for (var i = 0; i < queue.length; i++) if (seatFor(event, rows, queue[i]) === 'going') return queue[i];
    return null;
  }

  // now is {date, time} in Israel, so everything compares as plain local text.
  function signupState(event, now) {
    var at = now.date + 'T' + now.time;
    if (event.status === 'cancelled') return { open: false, reason: 'Cancelled' };
    if (event.date + 'T' + (event.time || '23:59') <= at) return { open: false, reason: 'This has passed' };
    if (event.rsvp === 'closed') return { open: false, reason: 'Sign-up is not open yet' };
    if (str(event.rsvp_closes) && event.rsvp_closes <= at) return { open: false, reason: 'Sign-up has closed' };
    return { open: true, reason: '' };
  }

  // Deals people into even groups of at most size, cohort by cohort, so tables mix.
  function makeGroups(people, size) {
    var sorted = people.slice().sort(function (a, b) { return String(a.cohort).localeCompare(String(b.cohort)) || String(a.member_id).localeCompare(String(b.member_id)); });
    var groups = Math.max(1, Math.ceil(sorted.length / size));
    var out = {};
    sorted.forEach(function (p, i) { out[p.member_id] = 'Group ' + ((i % groups) + 1); });
    return out;
  }

  /* ---------- board ---------- */

  function validatePost(input) {
    input = input || {};
    var e = {};
    var v = {};
    v.kind = str(input.kind);
    if (!Object.prototype.hasOwnProperty.call(POST_KINDS, v.kind)) e.kind = 'Pick a kind';
    v.title = str(input.title);
    if (!v.title) e.title = 'Give it a title';
    else if (v.title.length > LIMITS.title) e.title = 'Up to ' + LIMITS.title + ' characters';
    ['company', 'location'].forEach(function (f) {
      v[f] = str(input[f]);
      if (v[f].length > LIMITS.company) e[f] = 'Up to ' + LIMITS.company + ' characters';
    });
    v.body = str(input.body);
    if (v.body.length > LIMITS.details) e.body = 'Up to ' + LIMITS.details + ' characters';
    v.link = str(input.link);
    if (v.link && !isHttps(v.link)) e.link = 'Use an https:// link';
    v.contact = str(input.contact);
    if (v.contact.length > LIMITS.contact) e.contact = 'Up to ' + LIMITS.contact + ' characters';
    v.audience = str(input.audience) || 'all';
    if (!isAudience(v.audience)) e.audience = 'Pick who it is for';
    return { ok: Object.keys(e).length === 0, value: v, errors: e };
  }

  function canPostKind(kind, tier) {
    return LEADER_POST_KINDS.indexOf(kind) === -1 || tier === 'leader';
  }

  function postIsLive(post, today) {
    return post.status === 'open' && (!str(post.expires_on) || post.expires_on >= today);
  }

  function profileIsStale(reviewedOn, today) {
    return !str(reviewedOn) || addDays(str(reviewedOn).slice(0, 10), STALE_DAYS) < today;
  }

  /* ---------- sharing ---------- */

  function eventEnd(ev) {
    if (str(ev.end_time)) return { date: ev.end_time <= ev.time ? addDays(ev.date, 1) : ev.date, time: ev.end_time };
    var h = Number(ev.time.slice(0, 2)) + 2;
    return { date: h >= 24 ? addDays(ev.date, 1) : ev.date, time: ('0' + (h % 24)).slice(-2) + ev.time.slice(2) };
  }

  function stamp(date, time) {
    return date.replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
  }

  function icsText(s) {
    return str(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function toIcs(ev, url) {
    var end = eventEnd(ev);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//The Masters Club//EN', 'BEGIN:VEVENT',
      'UID:' + ev.id + '@masters-club',
      'DTSTAMP:' + stamp(ev.date, ev.time) + 'Z',
      'DTSTART;TZID=' + TIME_ZONE + ':' + stamp(ev.date, ev.time),
      'DTEND;TZID=' + TIME_ZONE + ':' + stamp(end.date, end.time),
      'SUMMARY:' + icsText(ev.title),
      'LOCATION:' + icsText(ev.place),
      'DESCRIPTION:' + icsText([ev.details, url].filter(Boolean).join('\n')),
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }

  function googleCalendarUrl(ev, url) {
    var end = eventEnd(ev);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(ev.title) +
      '&dates=' + encodeURIComponent(stamp(ev.date, ev.time) + '/' + stamp(end.date, end.time)) +
      '&ctz=' + encodeURIComponent(TIME_ZONE) +
      '&location=' + encodeURIComponent(str(ev.place)) +
      '&details=' + encodeURIComponent([ev.details, url].filter(Boolean).join('\n'));
  }

  function whatsappUrl(text) {
    return 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  function shortDate(iso) {
    var d = new Date(iso + 'T00:00:00Z');
    return weekday(iso).slice(0, 3) + ' ' + d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  }

  // The week's update for a leader to paste into WhatsApp. Only what everyone may see.
  function buildDigest(o) {
    var soon = addDays(o.today, 30);
    var weekAgo = addDays(o.today, -7);
    var events = (o.events || []).filter(function (e) { return e.status !== 'cancelled' && e.audience === 'all' && e.date >= o.today && e.date <= soon; })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });
    var posts = (o.posts || []).filter(function (p) { return p.status === 'open' && p.audience === 'all' && String(p.created_at).slice(0, 10) >= weekAgo; });
    var joined = o.joined || [];
    if (!events.length && !posts.length && !joined.length) return '';
    var lines = ['*This week in The Masters Club*'];
    if (events.length) lines.push('', '*Coming up*');
    events.forEach(function (e) { lines.push(shortDate(e.date) + ', ' + e.time + ': ' + e.title + (e.place ? ' at ' + e.place : '')); });
    if (posts.length) lines.push('', '*New on the board*');
    posts.forEach(function (p) { lines.push((POST_KINDS[p.kind] || p.kind) + ': ' + p.title); });
    if (joined.length) lines.push('', '*Just joined the directory*', joined.join(', '));
    lines.push('', o.siteUrl);
    return lines.join('\n');
  }

  /* ---------- bulk add ---------- */

  function splitPosition(text) {
    var s = str(text);
    if (/^[-–—]*$/.test(s)) return { role: '', company: '' };
    // The application form asks for "Company - Role".
    var dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(s);
    if (dash) return { role: dash[2].trim(), company: dash[1].trim() };
    var m = /^(.+?)(?:\s+at\s+|\s*@\s*|,\s*)(.+)$/i.exec(s);
    return m ? { role: m[1].trim(), company: m[2].trim() } : { role: s, company: '' };
  }

  function isPeopleTable(text) {
    return str(text).split(/\r?\n/)[0].indexOf('\t') !== -1;
  }

  // Reads a block pasted from a sheet. Only these columns are ever looked at, so a form export
  // with ID numbers, birthdays, allergies or phones can be pasted whole and those stay out.
  var PEOPLE_COLUMNS = [
    ['name', /^(full name|name)$/], ['email', /^(e-?mail|mail|google email)$/], ['position', /^(current position|position)$/],
    ['role', /^role$/], ['company', /^(company|employer)$/], ['city', /^city$/], ['program', /^program/],
    ['linkedin', /^linkedin/], ['interests', /^interests/], ['tier', /^tier$/], ['cohort', /^cohort/]
  ];

  function parsePeopleTable(text) {
    var lines = str(text).split(/\r?\n/);
    var cols = {};
    lines[0].split('\t').forEach(function (h, i) {
      var label = str(h).toLowerCase();
      PEOPLE_COLUMNS.forEach(function (c) { if (c[1].test(label) && cols[c[0]] === undefined) cols[c[0]] = i; });
    });
    if (cols.name === undefined) return { rows: [], skipped: [], error: 'The first line needs a "Name" column' };
    var rows = [];
    var skipped = [];
    lines.slice(1).forEach(function (line, n) {
      if (!str(line)) return;
      var cells = line.split('\t');
      var cell = function (k) { return cols[k] === undefined ? '' : str(cells[cols[k]]); };
      var email = normalizeEmail(cell('email'));
      if (!isEmail(email)) email = '';
      var name = validateName(cell('name'));
      if (!name.ok) { skipped.push({ line: email || 'Row ' + (n + 2), reason: 'Needs a name' }); return; }
      var pos = splitPosition(cell('position'));
      var linkedin = cell('linkedin');
      var tier = cell('tier').toLowerCase();
      rows.push({
        name: name.value, email: email,
        role: (cell('role') || pos.role).slice(0, LIMITS.role), company: (cell('company') || pos.company).slice(0, LIMITS.company),
        city: cell('city').slice(0, LIMITS.city), program: cell('program').slice(0, LIMITS.program),
        linkedin: isLinkedIn(linkedin) ? linkedin : '', interests: splitList(cell('interests')).slice(0, LIMITS.tags).filter(function (t) { return t.length <= LIMITS.tag; }).join(', '),
        tier: isTier(tier) ? tier : '', cohort: cell('cohort').slice(0, 20)
      });
    });
    return { rows: rows, skipped: skipped };
  }

  function parseMemberLines(text, existingEmails, opts) {
    opts = opts || {};
    var taken = {};
    (existingEmails || []).forEach(function (e) { if (e) taken[normalizeEmail(e)] = true; });
    var rows = [];
    var skipped = [];
    str(text).split(/\r?\n/).forEach(function (line) {
      if (!str(line)) return;
      var parts = line.split(',');
      var name = validateName(parts[0]);
      var email = normalizeEmail(parts.slice(1).join(','));
      if (!name.ok) { skipped.push({ line: line, reason: name.error }); return; }
      if (!email && opts.emailOptional) { rows.push({ name: name.value, email: '' }); return; }
      if (!isEmail(email)) { skipped.push({ line: line, reason: 'Needs "Name, email"' }); return; }
      if (taken[email]) { skipped.push({ line: line, reason: 'Email already on the list' }); return; }
      taken[email] = true;
      rows.push({ name: name.value, email: email });
    });
    return { rows: rows, skipped: skipped };
  }

  /* ---------- email codes ---------- */

  // Six digits from at least 48 bits of random hex (a UUID from Utilities.getUuid).
  function makeCode(hex) {
    var h = str(hex).slice(0, 12);
    if (!/^[0-9a-f]{12}$/i.test(h)) throw new Error('makeCode needs 12 random hex digits');
    var n = String(parseInt(h, 16) % 1000000);
    while (n.length < 6) n = '0' + n;
    return n;
  }

  // state: {first, n, last} for one sender in the current window, or null. Returns ok, the
  // state to store if sent, and when refused, the seconds until the next send is allowed.
  function codeThrottle(state, now) {
    var L = CODE_LIMITS;
    if (!state || !state.n || !(now - state.last < L.quietMs)) return { ok: true, next: { n: 1, last: now } };
    var wait = L.waitsMs[Math.min(state.n, L.waitsMs.length) - 1];
    if (now - state.last < wait) return { ok: false, waitSeconds: Math.ceil((state.last + wait - now) / 1000) };
    return { ok: true, next: { n: state.n + 1, last: now } };
  }

  // The square to keep from a photo: all of a square one, the middle of a wide one, and near the
  // top of a tall one, where the face usually is.
  function cropSquare(w, h) {
    var side = Math.min(w, h);
    return { x: Math.round((w - side) / 2), y: h > w ? Math.round((h - side) * 0.2) : 0, side: side };
  }

  /* ---------- sheet and csv safety ---------- */

  function sanitizeCell(v) {
    if (typeof v !== 'string') return v;
    return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  }

  function toCsv(headers, rows) {
    function cell(v) {
      if (Array.isArray(v)) v = v.join(', ');
      if (v === true) return 'TRUE';
      if (v === false) return 'FALSE';
      var s = sanitizeCell(str(v));
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var out = headers.map(cell).join(',') + '\r\n';
    (rows || []).forEach(function (r) {
      out += headers.map(function (h) { return cell(r[h]); }).join(',') + '\r\n';
    });
    return out;
  }

  function escapeHtml(v) {
    return str(v === 0 ? '0' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- sessions ---------- */

  function safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function signSession(payload, secret, crypto) {
    if (!secret) throw new Error('Session secret is not set');
    var body = crypto.b64encode(JSON.stringify(payload));
    return body + '.' + crypto.hmac(body, secret);
  }

  function verifySession(token, secret, crypto, now) {
    if (!secret || typeof token !== 'string') return null;
    var parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    var expected;
    try { expected = crypto.hmac(parts[0], secret); } catch (e) { return null; }
    if (!safeEqual(expected, parts[1])) return null;
    var payload;
    try { payload = JSON.parse(crypto.b64decode(parts[0])); } catch (e) { return null; }
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return payload;
  }

  return {
    TIERS: TIERS,
    TIER_LABEL: TIER_LABEL,
    INDUSTRIES: INDUSTRIES,
    OPEN_TO: OPEN_TO,
    LIMITS: LIMITS,
    DEFAULT_RULES: DEFAULT_RULES,
    PROFILE_FIELDS: PROFILE_FIELDS,
    EVENT_KINDS: EVENT_KINDS,
    POST_KINDS: POST_KINDS,
    POST_DAYS: POST_DAYS,
    TIME_ZONE: TIME_ZONE,
    CODE_LIMITS: CODE_LIMITS,
    toBool: toBool,
    isTier: isTier,
    normalizeRules: normalizeRules,
    canSee: canSee,
    hiddenTiers: hiddenTiers,
    splitList: splitList,
    normalizeEmail: normalizeEmail,
    isEmail: isEmail,
    nextId: nextId,
    publicProfile: publicProfile,
    validateName: validateName,
    validateProfile: validateProfile,
    directoryEntry: directoryEntry,
    buildDirectory: buildDirectory,
    cohortLabel: cohortLabel,
    searchMembers: searchMembers,
    parseMemberLines: parseMemberLines,
    isDate: isDate,
    isHttps: isHttps,
    addDays: addDays,
    weekday: weekday,
    shortDate: shortDate,
    isAudience: isAudience,
    inAudience: inAudience,
    validateEvent: validateEvent,
    seatFor: seatFor,
    nextOffWaitlist: nextOffWaitlist,
    signupState: signupState,
    makeGroups: makeGroups,
    validatePost: validatePost,
    canPostKind: canPostKind,
    postIsLive: postIsLive,
    profileIsStale: profileIsStale,
    toIcs: toIcs,
    googleCalendarUrl: googleCalendarUrl,
    whatsappUrl: whatsappUrl,
    buildDigest: buildDigest,
    splitPosition: splitPosition,
    cropSquare: cropSquare,
    isPeopleTable: isPeopleTable,
    parsePeopleTable: parsePeopleTable,
    makeCode: makeCode,
    codeThrottle: codeThrottle,
    sanitizeCell: sanitizeCell,
    toCsv: toCsv,
    escapeHtml: escapeHtml,
    safeEqual: safeEqual,
    signSession: signSession,
    verifySession: verifySession
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;
