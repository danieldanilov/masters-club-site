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
  var OPEN_TO = ['Coffee chats', 'Mentoring', 'Hiring', 'Collaborating'];
  var LIMITS = { name: 60, role: 60, company: 60, bio: 280, tag: 40, tags: 6, note: 280, linkedin: 200 };
  var DEFAULT_RULES = {
    leader: { leader: true, club: true, community: true },
    club: { leader: true, club: true, community: false },
    community: { leader: true, club: true, community: true }
  };
  var PROFILE_FIELDS = ['role', 'company', 'industry', 'help', 'looking', 'open_to', 'linkedin', 'phone', 'show_phone', 'bio', 'photo'];

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
      industry: str(p.industry),
      help: splitList(p.help),
      looking: splitList(p.looking),
      open_to: splitList(p.open_to),
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
    ['role', 'company'].forEach(function (f) {
      v[f] = str(input[f]);
      if (v[f].length > LIMITS[f]) errors[f] = 'Up to ' + LIMITS[f] + ' characters';
    });
    v.bio = str(input.bio);
    if (v.bio.length > LIMITS.bio) errors.bio = 'Up to ' + LIMITS.bio + ' characters';

    v.industry = str(input.industry);
    if (v.industry && INDUSTRIES.indexOf(v.industry) === -1) errors.industry = 'Pick one from the list';

    ['help', 'looking'].forEach(function (f) {
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
      joined: !!normalizeEmail(member.email),
      profile: publicProfile(profile)
    };
    if (includePrivate) {
      e.email = normalizeEmail(member.email);
      e.active = toBool(member.active);
    }
    return e;
  }

  function buildDirectory(members, profilesById, rules, viewer) {
    if (!viewer || !toBool(viewer.active) || !isTier(viewer.tier)) return { members: [], hiddenTiers: TIERS.slice() };
    var list = (members || [])
      .filter(function (m) { return toBool(m.active) && canSee(rules, viewer.tier, m.tier); })
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
      p.role, p.company, p.industry, p.bio]
      .concat(p.help || [], p.looking || [], p.open_to || [])
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

  /* ---------- bulk add ---------- */

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
    sanitizeCell: sanitizeCell,
    toCsv: toCsv,
    escapeHtml: escapeHtml,
    safeEqual: safeEqual,
    signSession: signSession,
    verifySession: verifySession
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;
