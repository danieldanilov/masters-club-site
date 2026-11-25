// js/config.js
// Public settings for the live site. None of these is a secret: the API URL, the Google client ID
// and PostHog's project key are visible to every visitor by design. The dev server serves its own
// version, without a PostHog key, so analytics stays off there and in the tests.
var CONFIG = {
  ENV: 'production',
  API_URL: 'https://script.google.com/macros/s/AKfycbyKf_Ke5gL88X_mHAFAokBOvxhlAa49UszOg0rtiHOI2W_FPg25e9MPsAMkMf331M5g/exec',
  DEV_SIGNIN: false,
  // The club's own PostHog project (720681, US Cloud). See docs/02-architecture.md, "Analytics".
  POSTHOG_KEY: 'phc_rvT8pQoFLGEBPBc4WC8JUz9F5jkyqQA3eVqGmJMSDsie',
  POSTHOG_HOST: 'https://us.i.posthog.com'
};
;
// js/analytics.js
// Analytics, all in one place: the rest of the site calls Analytics.track(), identify(), reset(),
// error(), flag() and whenReady(), and only this file knows it's PostHog. It's off unless CONFIG has a PostHog
// key and this is the live site or staging, so the dev server and every test send nothing. Staging
// has its own PostHog project, and stays off while its key is empty (docs/07-setup.md).
// What's tracked and how to add an event: docs/02-architecture.md, "Analytics".
var Analytics = (function () {
  var on = !!(typeof CONFIG !== 'undefined' && CONFIG.POSTHOG_KEY && (CONFIG.ENV === 'production' || CONFIG.ENV === 'staging'));
  // The flag override's key, for local work and staging.
  var FLAGS_KEY = 'mc-flags-v1';
  // Who this browser was last named as, with their details, so they're sent once and not on
  // every page load (F130).
  var NAMED_KEY = 'mc-named-v1';
  function stored() { try { return localStorage.getItem(NAMED_KEY); } catch (e) { return null; } }
  function store(v) { try { if (v) localStorage.setItem(NAMED_KEY, v); else localStorage.removeItem(NAMED_KEY); } catch (e) { /* private mode */ } }

  /* ---------- keeping personal details out of events ---------- */

  // An email address, plain or URL-encoded, and a run of 9 or more digits, which is a phone or
  // an ID number (a date has 8, so dates stay).
  var EMAIL = /[^\s@\/?#&=:"'<>]+(?:@|%40)[^\s@\/?#&="'<>]+\.[a-z]{2,}/gi;
  var PHONE = /\+?\d[\d\s().-]{7,}\d/g;
  function longNumber(m) { return m.replace(/\D/g, '').length >= 9 ? '[number]' : m; }
  // Properties PostHog fills from the page's address, whose query can carry an email.
  var URL_KEYS = ['$current_url', '$pathname', '$referrer', '$initial_current_url', '$session_entry_url', '$prev_pageview_pathname', '$external_click_url', '$initial_referrer', 'title'];
  // Properties autocapture fills from what was clicked.
  var TEXT_KEYS = ['$el_text', '$elements_chain'];

  function cleanUrl(s) { return String(s).replace(EMAIL, '[email]'); }
  function cleanText(s) { return cleanUrl(s).replace(PHONE, longNumber); }

  function cleanProps(props, keys, fn) {
    if (!props) return;
    keys.forEach(function (k) { if (typeof props[k] === 'string') props[k] = fn(props[k]); });
  }

  // Runs on every event just before it leaves the browser.
  function scrub(event) {
    if (!event) return event;
    var p = event.properties;
    cleanProps(p, URL_KEYS, cleanUrl);
    cleanProps(p, TEXT_KEYS, cleanText);
    if (p && Array.isArray(p.$elements)) p.$elements.forEach(function (el) { cleanProps(el, ['$el_text', 'attr__href'], cleanText); });
    cleanProps(event.$set, URL_KEYS, cleanUrl);
    cleanProps(event.$set_once, URL_KEYS, cleanUrl);
    return event;
  }

  // Session replay keeps the page's address and the API calls' addresses: no emails, and no
  // query strings on anything but the site itself.
  function maskRequest(req) {
    if (req && req.name) {
      var site = req.name.indexOf(location.origin) === 0;
      req.name = cleanUrl(site ? req.name : req.name.split('?')[0]);
    }
    return req;
  }

  /* ---------- loading PostHog ---------- */

  var ready = false;
  var waiting = [];

  // The settings, kept apart so the tests can read them.
  var options = {
    api_host: on ? CONFIG.POSTHOG_HOST : '',
    defaults: '2026-08-30',
    // Visitors stay anonymous. A person profile starts when someone gives their email on Join or
    // signs in (identify below).
    person_profiles: 'identified_only',
    capture_pageleave: true,
    autocapture: true,
    capture_heatmaps: true,
    capture_dead_clicks: true,
    capture_exceptions: true,
    capture_performance: { web_vitals: true, network_timing: true },
    // Every input is masked, and so is the text of anything marked ph-sensitive (what members
    // wrote about themselves, emails, notes). Photos and contact links carry ph-no-capture,
    // which replay shows as an empty box. Network bodies and headers are never recorded.
    session_recording: { maskAllInputs: true, maskTextSelector: '.ph-sensitive', maskCapturedNetworkRequestFn: maskRequest },
    before_send: scrub,
    // posthog-js has arrived: whatever waited for it goes now.
    loaded: function () {
      ready = true;
      waiting.splice(0).forEach(function (fn) { fn(); });
    }
  };

  if (on) {
    // PostHog's official snippet, unchanged. It loads the current posthog-js from PostHog's CDN
    // (allowed by the page's Content-Security-Policy) and queues every call until it arrives.
    /* eslint-disable */
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    /* eslint-enable */
    posthog.init(CONFIG.POSTHOG_KEY, options);
  }

  function ph() { return on && window.posthog; }
  // Who this page load has named, until posthog-js has loaded and can say itself.
  var named = null;
  // The member id this browser is named as, or null while it's anonymous.
  function member() {
    return posthog.__loaded && typeof posthog.get_distinct_id === 'function' && posthog.get_property('$user_state') === 'identified' ? posthog.get_distinct_id() : named;
  }

  /* ---------- what the site calls ---------- */

  return {
    on: on,
    options: options,
    scrub: scrub,
    maskRequest: maskRequest,

    // An event named "object verb", lowercase, past tense: "post created". Properties are ids,
    // counts, choices and yes/no only, never what someone typed.
    // leaving: true is for an event sent just before the page goes somewhere else. It goes by
    // beacon, which the browser delivers even after the page is gone (F129).
    track: function (name, props, opts) {
      if (!ph()) return;
      if (opts && opts.leaving) posthog.capture(name, props || {}, { transport: 'sendBeacon' });
      else posthog.capture(name, props || {});
    },

    // Runs fn once posthog-js has loaded, or after ms (2 seconds) if it's slow or blocked, and at
    // once when analytics is off. For a page that sends an event and then leaves the site: calls
    // made before posthog-js arrives only wait in memory, and leaving would drop them.
    whenReady: function (fn, ms) {
      if (!on || ready) { fn(); return; }
      var done = false;
      var once = function () { if (!done) { done = true; fn(); } };
      waiting.push(once);
      setTimeout(once, ms || 2000);
    },

    // Names this browser's person. A member, by their id from the Members tab, with name, email,
    // tier and cohort. Someone who only gave an email (on Join, or by opening the link in the
    // application email) keeps their anonymous id and gets that email as a property, so when they
    // sign in the same visit becomes the member's and the sign-in funnel reads as one person
    // (F123). A signed-in member is never renamed by an email, and moving from one member to
    // another starts a new person, so nobody's actions land on someone else (F109). The site
    // names a member on every page load; their details go along only when they changed (F130).
    identify: function (who) {
      if (!ph() || !who) return;
      var current = member();
      if (!who.id) {
        if (who.email && !current) posthog.setPersonProperties({ email: who.email });
        return;
      }
      if (current && current !== who.id) { posthog.reset(); store(null); }
      var props = {};
      ['name', 'email', 'tier', 'cohort'].forEach(function (k) { if (who[k] !== undefined) props[k] = who[k]; });
      var details = JSON.stringify([who.id, props]);
      if (stored() === details) posthog.identify(who.id);
      else posthog.identify(who.id, props);
      store(details);
      named = who.id;
    },

    // Signing out: the next person on this browser starts anonymous.
    reset: function () {
      named = null;
      store(null);
      if (ph()) posthog.reset();
    },

    // An error the site caught itself, so it still shows in error tracking.
    error: function (e, props) {
      if (ph()) posthog.captureException(e, props || {});
    },

    // A feature flag: true, false, or a variant name. Until PostHog's flags arrive it's false, so
    // a flagged thing starts hidden and never flashes in for someone it's off for. Off the live
    // site every flag is off, unless the override in localStorage (FLAGS_KEY, mc-flags-v1) turns
    // it on for local work, staging and the tests: {"portal-board": true}.
    // The live site ignores it.
    // onFlags runs once flags have loaded, and again whenever they change.
    flag: function (key) {
      if (ph()) return posthog.getFeatureFlag(key) || false;
      if (typeof CONFIG !== 'undefined' && CONFIG.ENV === 'production') return false;
      try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '{}')[key] || false; } catch (e) { return false; }
    },
    onFlags: function (fn) {
      if (ph()) posthog.onFeatureFlags(fn); else fn([]);
    }
  };
})();
;
// js/content.js
// Everything a leader might want to change on the public pages lives here.
// Edit the text between the quotes, commit, and the site updates on its own.
var CONTENT = {
  tagline: 'An invite-only community of Reichman graduate students and alumni, for people who do, not just talk.',

  club: 'A hand-picked cohort each semester, up to 50 people, meeting for curated sessions with founders, operators and investors.',
  community: 'Everyone who has been through a cohort, for life: dinners, low-key meetups, and a directory of who can help with what.',
  // About: why the club exists, in a few sentences.
  mission: "Reichman's master's programmes are full of people building companies, teams and careers. The club brings the most driven of them together every semester, and the community keeps them close for life. It's for people who do, not just talk, and who give first.",

  giveFirst: 'Give first.',
  giveFirstRest: 'Intros, advice, jobs. You get out of the club what you put in.',

  // Dates come from Kishon's sheet "The Masters Club - Gantt 26/27".
  nextMeeting: {
    day: '2',
    month: 'December',
    title: 'Meeting 1, hosted by Playtika',
    note: 'Members RSVP in the WhatsApp event.'
  },

  applyUrl: 'https://forms.gle/umgLKBHcCzH7N6uS8',

  // Photos on Home, the first one large. Built from assets/club by tools/build-images.sh, from
  // the club's own folder of selected photos, which are cleared for the public site.
  moments: [
    { src: 'img/club/cohort-1-together.jpg', alt: 'Cohort 1 together on stage at the closing night' },
    { src: 'img/club/cohort-1-at-the-gala.jpg', alt: 'The cohort and its speakers after a session' },
    { src: 'img/club/opening-night-circle.jpg', alt: 'Members standing in a circle at the opening workshop' },
    { src: 'img/club/talk-in-the-round.jpg', alt: 'A speaker in conversation with the cohort, seated in a circle' },
    { src: 'img/club/community-night-out.jpg', alt: 'Members raising glasses at a night out' }
  ],

  // What applicants ask, on Join. Keep each answer to a sentence or two.
  faq: [
    { q: 'Who can apply?', a: "Master's students at Reichman University, from any school or programme." },
    { q: 'How many people get in?', a: 'Up to 50 each cohort. We look for people who build, lead and show up for others.' },
    { q: 'What happens after I apply?', a: "We read every application and invite the people we'd like to meet to a short interview. Everyone hears back." },
    { q: 'What does a cohort look like?', a: 'Sessions with founders, executives and investors, workshops, and dinners, about once a month through the year.' },
    { q: 'What language is it in?', a: 'English.' },
    { q: 'What happens when my cohort ends?', a: 'You stay in the community for life: dinners, meetups and the directory of who can help with what.' },
    { q: "I'm already a member. How do I sign in?", a: 'Enter your email above and we send you a sign-in link. No password.' }
  ],

  // Photos are built from assets/leaders by tools/build-images.sh.
  leaders: [
    { name: 'Michael Kishon', role: 'Founder, club lead', photo: 'img/leaders/michael-kishon.jpg', linkedin: 'https://www.linkedin.com/in/michael-kishon' },
    { name: 'Noy Segal Swisa', role: 'Club lead', photo: 'img/leaders/noy-segal-swisa.jpg', linkedin: 'https://www.linkedin.com/in/noy-segal26' },
    { name: 'Dor Bitton', role: 'Club lead', photo: 'img/leaders/dor-bitton.jpg', linkedin: 'https://www.linkedin.com/in/dor-bitton22' },
    { name: 'Maor Kaufman', role: 'Community lead', photo: 'img/leaders/maor-kaufman.jpg', linkedin: 'https://www.linkedin.com/in/maor-kaufman' },
    { name: 'Omri Bitan', role: 'Community lead', photo: 'img/leaders/omri-bitan.jpg', linkedin: 'https://www.linkedin.com/in/omri-bitan' },
    { name: 'Daniel Danilov', role: 'Community lead', photo: 'img/leaders/daniel-danilov.jpg', linkedin: 'https://www.linkedin.com/in/danieldanilov' }
  ],

  // Past meetings, oldest first. Posters and photos are built from assets/meetings by
  // tools/build-images.sh. Dates and quotes come from the club's own posts in the Cohort 1 group.
  meetings: [
    {
      id: 'inon-tagner', date: '2026-04-28', kind: 'Opening event',
      speaker: 'Inon Tagner', role: 'Experience architect, The Blender Experience',
      quote: 'It\'s an art to really connect.',
      recap: 'The night Cohort 1 met for the first time. Sushi, wine and mingling, the founders on why they started the club, then a workshop with Inon on connection, trust and soft influence. Inon has prepared over 400 TED speakers.',
      poster: 'img/meetings/inon-tagner.jpg',
      photos: [
        { src: 'img/meetings/inon-tagner-room.jpg', alt: 'Members facing the opening slide at the first meeting' },
        { src: 'img/meetings/inon-tagner-view.jpg', alt: 'Wine glasses lined up by a window over the city' }
      ]
    },
    {
      id: 'yonatan-stern', date: '2026-05-19', kind: 'Flagship meeting',
      speaker: 'Yonatan Stern', role: 'Founder and CEO, SmartUp Academy',
      quote: 'Why do some startups succeed while others fail?',
      recap: 'Pizza and networking, then Yonatan on the eight tech companies he co-founded and the SmartUp method he built from them, followed by a long Q&A. SmartUp Academy hosted the evening.',
      poster: 'img/meetings/yonatan-stern.jpg',
      photos: [
        { src: 'img/meetings/yonatan-stern-room.jpg', alt: 'Yonatan Stern presenting to the cohort' },
        { src: 'img/meetings/yonatan-stern-entrance.jpg', alt: 'Masters Club banners at the entrance to the venue' }
      ]
    },
    {
      id: 'ruthie-rousso', date: '2026-06-05', kind: 'Community meeting',
      speaker: 'Ruthie Rousso', role: 'Chef, writer and entrepreneur',
      quote: 'You don\'t have to know how to cook. Just start with one dish, and make it eight times until you master it.',
      recap: 'A Friday meal, a round of catching up on what everyone had been working on, then an open conversation with Ruthie about ambitious dreams, mistakes, and building a career around curiosity.',
      poster: 'img/meetings/ruthie-rousso.jpg',
      photos: [
        { src: 'img/meetings/ruthie-rousso-room.jpg', alt: 'Ruthie Rousso talking to the cohort beside the club banner' },
        { src: 'img/meetings/ruthie-rousso-circle.jpg', alt: 'The cohort sitting in a wide circle' }
      ]
    },
    {
      id: 'eran-hadass', date: '2026-06-16', kind: 'Flagship workshop',
      speaker: 'Eran Hadass', role: 'Public speaking expert and trainer',
      quote: 'Today, being a doer isn\'t enough. You also need to know how to communicate your story.',
      recap: 'A hands-on workshop on speaking, presenting and influencing with confidence, from the founder of Reshet\'s TV School, who has trained thousands of managers and founders.',
      poster: 'img/meetings/eran-hadass.jpg',
      photos: []
    },
    {
      id: 'yaniv-rivlin', date: '2026-06-30', kind: 'Gala, closing Cohort 1',
      speaker: 'Yaniv Rivlin', role: 'Entrepreneur, author and keynote speaker',
      quote: 'Life is an amusement park full of opportunities. The question is: which rides are you willing to get on?',
      recap: 'Festive business dress at Reichman for the end of the first cohort. Sushi, wine and cocktails, two-minute spotlights from members, and Yaniv, founding CEO of Bird Israel and author of "Live Like a Startup", on spotting opportunities.',
      poster: 'img/meetings/gala-yaniv-rivlin.jpg',
      photos: [
        { src: 'img/meetings/gala-yaniv-rivlin-bar.jpg', alt: 'The club banner beside the drinks table at the Gala' }
      ]
    }
  ],

  // What Partners shows for the moment before the live list from Admin arrives. Keep it matching
  // Admin's list and order, so the page doesn't change under the reader.
  partners: [
    { name: 'Reichman University', note: "The club's home university", url: 'https://www.runi.ac.il/en/', logo: 'img/partners/reichman-university.png' },
    { name: 'Playtika', note: 'Hosts meetings 1 and 3 of Cohort 2', url: 'https://www.playtika.com', logo: 'img/partners/playtika.png' }
  ],

  // The Partners page: who a partner reaches, then how a partnership works. Admin's "Opening line
  // on the Partners page" replaces partnerPitch when it's filled in.
  partnerPitch: "Every cohort, the club hand-picks 40 to 50 of the best master's students at Reichman. They stay in the community for life, so every intake widens the circle a partner reaches.",
  partnerDeal: "We shape each partnership with the partner, so it works for you and for our members. Tell us what you have in mind and we'll come back with the details.",
  // The last card in the partner grid, which leads to the form.
  partnerInvite: { title: 'This could be you', note: "Tell us how you'd like to work with the club." }
};
;
// js/core.js
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
  // Sign-in emails: a code lives 30 minutes and allows 5 tries; each new email to the same address
  // waits longer than the last (F110), up to six hours, and six hours with none start the count
  // again. Six hours is the longest Google's cache keeps anything, and the count lives there, so
  // no wait may be longer (F125). quotaReserve is
  // the day's mail kept for sign-in emails, and applicationsPerDay is the most application emails
  // sent in a day to addresses not on the list (F118); listNoticesPerDay is the most emails telling
  // leaders someone joined the list for the next cohort (F144); requests and partner messages share
  // a cap per window.
  var CODE_LIMITS = {
    ttlMs: 30 * 60 * 1000, maxTries: 5,
    waitsMs: [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 3 * 60 * 60 * 1000, 6 * 60 * 60 * 1000],
    quietMs: 6 * 60 * 60 * 1000, quotaReserve: 20, applicationsPerDay: 40, listNoticesPerDay: 10, requestsPerWindow: 10, windowMs: 6 * 60 * 60 * 1000
  };
  // Where the club is online and its contact email: the footer of every page, Home, and the club's
  // emails. With email empty, its link is left out.
  var SOCIAL = {
    instagram: 'https://www.instagram.com/the_masters_club/',
    linkedin: 'https://www.linkedin.com/company/111716473/',
    email: 'mastersclub.runi@gmail.com'
  };
  var PROFILE_FIELDS = ['role', 'company', 'city', 'program', 'industry', 'help', 'looking', 'open_to', 'interests', 'linkedin', 'phone', 'show_phone', 'show_email', 'bio', 'photo'];
  // Adding a kind of event or post is one line here; the forms and pages read these lists.
  var EVENT_KINDS = { meeting: 'Meeting', meetup: 'Meetup', dinner: 'Dinner', external: 'Outside event' };
  // What only a leader sets on an event. The edit form shows these to leaders alone, and a save
  // by anyone else keeps what the event already has (F120).
  var EVENT_LEADER_FIELDS = ['kind', 'audience', 'public', 'community_seats', 'poster', 'recap'];
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

  // Which of the avatar gradients someone without a photo wears: always the same one for the
  // same person, and neighbours in the members list get different ones.
  var AVATAR_TONES = 6;
  function avatarTone(key) {
    var s = String(key || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return h % AVATAR_TONES + 1;
  }

  // The site's own photos are built as JPEG and as WebP, about half the size (F136). The page
  // asks for the WebP; a photo from anywhere else, a logo or a saved member photo is left alone.
  function webp(src) {
    return /^img\/(?:[\w-]+\/)*[\w-]+\.jpe?g$/.test(String(src)) ? String(src).replace(/\.jpe?g$/, '.webp') : src;
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
    SOCIAL: SOCIAL,
    EVENT_LEADER_FIELDS: EVENT_LEADER_FIELDS,
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
    AVATAR_TONES: AVATAR_TONES,
    avatarTone: avatarTone,
    webp: webp,
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
;
// js/api.js
// Talks to the API. Sends JSON as text/plain so the browser skips the CORS preflight,
// which Apps Script can't answer.
var Api = (function () {
  var SESSION_KEY = 'mc-session-v1';
  var onSignedOut = function () {};
  var READS = { boot: 1, me: 1, directory: 1, photos: 1, publicInfo: 1, eventRoster: 1, 'admin.overview': 1 };
  var writes = 0;

  function read(store, key) { try { return window[store].getItem(key); } catch (e) { return null; } }
  function write(store, key, value) {
    try { if (value) window[store].setItem(key, value); else window[store].removeItem(key); } catch (e) { /* private mode */ }
  }

  function ApiError(code, message, fields, retryAfter) {
    this.code = code;
    this.message = message;
    this.fields = fields || {};
    this.retryAfter = retryAfter || 0;
  }

  async function call(action, body, opts) {
    opts = opts || {};
    if (!READS[action]) writes++;
    var payload = Object.assign({ action: action, session: opts.session !== undefined ? opts.session : read('localStorage', SESSION_KEY) }, body || {});
    var res;
    try {
      res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      throw new ApiError('network', "Can't reach the server. Check your connection and try again.");
    }
    if (!READS[action]) writes++;
    var data;
    try { data = await res.json(); } catch (e) { throw new ApiError('server', 'The server sent something unexpected. Try again in a minute.'); }
    if (!data.ok) {
      var err = new ApiError(data.error.code, data.error.message, data.error.fields, data.error.retryAfter);
      if (err.code === 'unauthorized') {
        write('localStorage', SESSION_KEY, null);
        onSignedOut(err);
      }
      throw err;
    }
    return data;
  }

  return {
    ApiError: ApiError,
    call: call,
    session: function () { return read('localStorage', SESSION_KEY); },
    setSession: function (s) { write('localStorage', SESSION_KEY, s); },
    onSignedOut: function (fn) { onSignedOut = fn; },
    // Counts changes sent, so a refresh can tell it started before one of them.
    writes: function () { return writes; }
  };
})();
;
// js/app.js
// The shell of the site: shared helpers, sign-in, the saved copy of member data, the router.
// Each area of the site is its own file in js/pages/ and adds itself with App.route().
// Look and feel: docs/06-design.md.
var App = (function () {
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var esc = Core.escapeHtml;
  var TIER_LABEL = Core.TIER_LABEL;
  var cohortLabel = Core.cohortLabel;

  var state = {
    me: null,          // signed-in member
    data: null,        // {directory, events, posts, pending, today} from boot, or the saved copy
    dir: { q: '', cohort: '', industry: '', open: [], tier: '' },
    board: { q: '', kind: '' },
    publicInfo: null,  // live data for the public pages
    admin: null,       // what Admin shows, for leaders: kept in memory only, never saved to the browser
    rosters: {}        // attendance lists opened this session, by event id
  };
  var routes = {};
  var drawFailed = false;

  /* ---------- icons (one stroke family, drawn here) ---------- */

  var ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="M7 10l5 5 5-5"/>',
    chat: '<path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.3z"/><path d="M9.5 9.5c0 2.5 2 4.5 4.5 5l1-1.2-1.6-.9-.8.8c-.9-.4-1.6-1.1-2-2l.8-.8-.9-1.6z"/>',
    linkedin: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10.5v5.5M8 7.8v.2M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16"/>'
  };
  function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  /* ---------- small helpers ---------- */

  function initials(n) {
    return String(n || '?').split(/\s+/).filter(Boolean).map(function (p) { return p[0]; }).slice(0, 2).join('').toUpperCase();
  }
  // An uploaded photo lives in the Sheet and arrives through the API; until it's here, the initials show.
  function photoSrc(person) {
    var photo = person.profile && person.profile.photo;
    if (!photo) return '';
    if (photo.indexOf('sheet:') !== 0) return Core.webp(photo);
    var saved = photoCache()[person.id];
    return saved && saved.v === photo ? saved.data : '';
  }
  // A member's photo is kept out of session replay (ph-no-capture). Leaders' public photos aren't members' rows.
  function avatar(person, cls) {
    var src = photoSrc(person);
    if (src) return '<img class="avatar ' + (cls || '') + (person.id ? ' ph-no-capture' : '') + '" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer">';
    return '<div class="avatar tone-' + Core.avatarTone(person.id || person.name) + ' ' + (cls || '') + '" aria-hidden="true">' + esc(initials(person.name)) + '</div>';
  }
  function tags(m) {
    return '<span class="tag ' + esc(m.tier) + '">' + esc(TIER_LABEL[m.tier] || m.tier) + '</span>' +
      (m.cohort ? '<span class="tag">' + esc(cohortLabel(m.cohort)) + '</span>' : '') +
      (m.profile.industry ? '<span class="tag">' + esc(m.profile.industry) + '</span>' : '') +
      (m.joined === false ? '<span class="tag unjoined">Not signed in yet</span>' : '');
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var d = String(iso).split('-');
    return Number(d[2]) + ' ' + MONTHS[Number(d[1]) - 1] + ' ' + d[0];
  }
  function roleLine(p) {
    if (p.role && p.company) return esc(p.role) + ' at ' + esc(p.company);
    return esc(p.role || p.company || '');
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  /* ---------- addresses ---------- */

  // A page is named by its address under the site's base (from the <base> the build writes): 'meetings?m=x', and '' for home. Links are written the same way,
  // href="meetings", and resolve against the base from any page (F108).
  var BASE = new URL(document.baseURI).pathname;
  function toPath(route) {
    return BASE + route;
  }
  function routeAt(url) {
    var p = url.pathname.indexOf(BASE) === 0 ? url.pathname.slice(BASE.length) : '';
    return p.replace(/(^|\/)index\.html$/, '').replace(/\/$/, '') + url.search;
  }
  function currentRoute() {
    return routeAt(location);
  }
  // A click on a link inside the site changes the page without reloading it.
  function followLink(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute('download')) return;
    var url = new URL(a.href, document.baseURI);
    if (url.origin !== location.origin || url.pathname.indexOf(BASE) !== 0 || /\.[a-z0-9]+$/i.test(url.pathname)) return;
    e.preventDefault();
    go(routeAt(url));
  }

  // A page that sends people elsewhere while it's being drawn gets the new page after it
  // finishes, so its own empty draw doesn't land on top.
  var drawing = false;
  function go(hash) {
    if (currentRoute() !== hash) history.pushState(null, '', toPath(hash));
    if (drawing) Promise.resolve().then(render); else render();
  }
  function loading(text) {
    return '<div class="loading"><div class="spinner"></div>' + esc(text || 'Loading') + '</div>';
  }
  function errorBlock(err) {
    return '<div class="wrap page"><div class="note warn">' + esc(err.message || 'Something went wrong') + '</div>' +
      '<p class="mt-2"><button class="btn quiet" data-retry>Try again</button></p></div>';
  }
  function page(inner) {
    return '<div class="wrap page">' + inner + '</div>';
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Saving…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function copyText(text) {
    if (navigator.clipboard) return navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, function () { toast("Couldn't copy"); });
    toast("Couldn't copy");
  }
  // The address to share for a page, the same one the WhatsApp links use.
  function siteLink(hash) {
    return location.origin + toPath(hash);
  }
  function downloadFile(name, type, text) {
    var url = URL.createObjectURL(new Blob([text], { type: type }));
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---------- side sheet ---------- */

  var lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    $('#modal').innerHTML = '<button class="close" data-close aria-label="Close">' + icon('close') + '</button><div class="sheet">' + html + '</div>';
    $('#scrim').classList.add('open');
    $('#modal [data-close]').addEventListener('click', closeSheet);
    $('#modal [data-close]').focus();
  }
  function closeSheet() {
    if (!$('#scrim').classList.contains('open')) return;
    $('#scrim').classList.remove('open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#scrim').addEventListener('click', function (e) { if (e.target.id === 'scrim') closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

  /* ---------- the saved copy ---------- */

  // Member data is kept in this browser so pages open at once, even when the API is slow. Signing
  // out or losing the session wipes it. Photos are saved separately so they're fetched only once.
  var BOOT_KEY = 'mc-boot-v1';
  var PHOTOS_KEY = 'mc-photos-v1';
  var PUBLIC_KEY = 'mc-public-v1';
  var INTENDED_KEY = 'mc-intended-v1';
  function readJson(store, key) {
    try { return JSON.parse(window[store].getItem(key) || 'null'); } catch (e) { return null; }
  }
  function writeJson(store, key, value) {
    try { if (value) window[store].setItem(key, JSON.stringify(value)); else window[store].removeItem(key); } catch (e) { /* full or private mode */ }
  }
  var photos = null;
  function photoCache() {
    if (!photos) photos = readJson('localStorage', PHOTOS_KEY) || {};
    return photos;
  }
  function saveData() {
    writeJson('localStorage', BOOT_KEY, state.me && state.data ? { me: state.me, data: state.data } : null);
  }
  function clearSaved() {
    state.me = null;
    state.data = null;
    state.admin = null;
    state.rosters = {};
    adminCall = null;
    adminAsk++;
    photos = null;
    writeJson('localStorage', BOOT_KEY, null);
    writeJson('localStorage', PHOTOS_KEY, null);
  }
  function loadSaved() {
    var saved = readJson('localStorage', BOOT_KEY);
    if (saved && saved.me && saved.data) { state.me = saved.me; state.data = saved.data; }
  }

  // Fetches everything fresh and tells the open page if anything changed.
  async function refresh() {
    var writesAtStart = Api.writes();
    var r = await Api.call('boot');
    // A change went out after this reply was made, so it's out of date. Ask again.
    if (Api.writes() !== writesAtStart) return refresh();
    if (r.session) Api.setSession(r.session);
    var before = JSON.stringify(state.data);
    take(r);
    var fetched = await fetchPhotos();
    renderNav(routeOf().route);
    if (drawFailed) render();
    else if (before !== JSON.stringify(state.data) || fetched) notifyPage();
  }

  // Admin's data for a leader (F133). It's asked for as soon as a leader's data arrives, so Admin
  // opens at once instead of waiting on the API. fresh=true starts a new call, for after a change;
  // otherwise a call already on its way is shared. Only the newest call's answer is kept.
  var adminCall = null;
  var adminAsk = 0;
  function loadAdmin(fresh) {
    if (adminCall && !fresh) return adminCall;
    var mine = ++adminAsk;
    var call = Api.call('admin.overview').then(function (r) {
      if (mine === adminAsk) state.admin = r;
      return r;
    });
    adminCall = call;
    var done = function () { if (adminCall === call) adminCall = null; };
    call.then(done, done);
    return call;
  }

  // Keeps what a boot or a sign-in sent.
  function take(r) {
    state.me = r.me;
    state.data = { directory: r.directory, events: r.events, posts: r.posts, pending: r.pending || 0, today: r.today };
    saveData();
    Analytics.identify(state.me);
    if (state.me.tier === 'leader') loadAdmin().catch(function () {});
  }

  function notifyPage() {
    var r = routes[routeOf().route];
    if (r && r.onData && !$('#scrim.open')) r.onData(routeOf().params);
  }

  async function fetchPhotos() {
    var saved = photoCache();
    var people = state.data.directory.members.slice();
    if (!people.some(function (m) { return m.id === state.me.id; })) people.push({ id: state.me.id, profile: state.me.profile });
    var want = people.filter(function (m) {
      var p = m.profile && m.profile.photo;
      return p && p.indexOf('sheet:') === 0 && (!saved[m.id] || saved[m.id].v !== p);
    }).map(function (m) { return m.id; });
    if (!want.length) return false;
    try {
      var r = await Api.call('photos', { ids: want });
      Object.keys(r.photos).forEach(function (id) { saved[id] = r.photos[id]; });
      writeJson('localStorage', PHOTOS_KEY, saved);
      return Object.keys(r.photos).length > 0;
    } catch (e) { return false; }
  }

  // Applies a change the API just confirmed, without waiting for a full reload.
  function replaceItem(list, item) {
    var i = state.data[list].map(function (x) { return x.id; }).indexOf(item.id);
    if (i === -1) state.data[list].unshift(item); else state.data[list][i] = item;
    saveData();
  }

  // Public pages draw from content.js at once, then pick up what leaders set in Admin.
  async function refreshPublic() {
    if (!state.publicInfo) state.publicInfo = readJson('localStorage', PUBLIC_KEY);
    try {
      var r = await Api.call('publicInfo', {}, { session: '' });
      delete r.ok;
      var at = routeOf();
      var route = routes[at.route];
      var isPublic = route && route.isPublic;
      // The page is drawn again only if the fresh data changes what it shows (F137). On a first
      // visit the data is always new, but most pages show none of it, and drawing them twice
      // fetched every image again and moved the page under the reader.
      var before = isPublic ? route.page(at.params) : '';
      state.publicInfo = r;
      writeJson('localStorage', PUBLIC_KEY, r);
      var changed = isPublic && route.page(at.params) !== before;
      if (changed && !$('form:focus-within')) {
        var y = window.scrollY;
        render();
        window.scrollTo(0, y);
      }
    } catch (e) { /* the public pages still work from content.js */ }
  }

  /* ---------- sign-in ---------- */

  // Where a sign-in lands: the link they came for, a first look at their profile, or the directory.
  async function signedIn(r, method) {
    setPendingCode(null);
    clearSaved();
    Api.setSession(r.session);
    take(r);
    Analytics.track('signed in', { method: method, first_time: !!r.me.first });
    // Photos follow on their own, so the page isn't held up waiting for them.
    fetchPhotos().then(function (got) { if (got) notifyPage(); });
    toast('Welcome, ' + r.me.name.split(' ')[0]);
    var intended = readJson('sessionStorage', INTENDED_KEY);
    writeJson('sessionStorage', INTENDED_KEY, null);
    go(intended || (r.me.first ? 'me' : 'members'));
  }

  // The dev server's one-click sign-in for the browser tests: it hands back the same answer a
  // code would. The live site has no such address.
  async function devSignIn(email) {
    var res = await fetch('/__signin', { method: 'POST', body: JSON.stringify({ email: email }) });
    var data = await res.json();
    if (!data.ok) throw new Api.ApiError(data.error.code, data.error.message);
    return signedIn(data, 'dev');
  }

  /* ---------- sign-in by email code ---------- */

  // The address a code went to, kept for the tab so the code step survives a reload.
  var CODE_KEY = 'mc-code-v1';
  function pendingCode() {
    try {
      var p = JSON.parse(sessionStorage.getItem(CODE_KEY) || 'null');
      return p && Date.now() - p.at < Core.CODE_LIMITS.ttlMs ? p : null;
    } catch (e) { return null; }
  }
  // n counts the emails sent to that address, so the page knows the next wait (F110); readyAt,
  // when the API said exactly when a new one can go, overrides it.
  function setPendingCode(email, n, readyAt) {
    try {
      if (email) sessionStorage.setItem(CODE_KEY, JSON.stringify({ email: email, at: Date.now(), n: n || 1, readyAt: readyAt || 0 }));
      else sessionStorage.removeItem(CODE_KEY);
    } catch (e) { /* private mode */ }
  }

  // The one way a code becomes a session, typed or from the link in the email.
  async function signInWithCode(email, code, method) {
    var r;
    try {
      r = await Api.call('emailVerify', { email: email, code: code }, { session: '' });
    } catch (err) {
      Analytics.track('sign in failed', { method: method, reason: err.code });
      throw err;
    }
    return signedIn(r, method);
  }

  function signOut() {
    // Sent while still named, then this browser goes back to anonymous for whoever's next.
    Analytics.track('signed out', { reason: 'user' });
    Analytics.reset();
    Api.setSession(null);
    clearSaved();
    setPendingCode(null);
    toast('Signed out');
    go('');
  }

  Api.onSignedOut(function () {
    // The API stopped accepting the session: counted like a sign-out, with why.
    if (state.me) Analytics.track('signed out', { reason: 'expired' });
    Analytics.reset();
    clearSaved();
    toast('Your session ended. Please sign in again.');
  });

  /* ---------- nav ---------- */

  // Where the club is online, from content.js: Instagram, LinkedIn, and the email once it has one.
  // The club's links, each with its icon: a line of them in the footer, and as cards (with the
  // handle under the name) for "Follow the club" on Home.
  var SOCIAL_ICONS = {
    Instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.25" cy="6.75" r="0.75" fill="currentColor"/>',
    LinkedIn: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V16.5M8 7.5v.01M12 16.5v-6M12 13.25c0-1.5 1-2.75 2.5-2.75s2 1 2 2.5v3.5"/>',
    'Email us': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'
  };
  function socialLinks(cards) {
    var s = Core.SOCIAL;
    return [['Instagram', s.instagram, '@' + String(s.instagram || '').replace(/\/+$/, '').split('/').pop()], ['LinkedIn', s.linkedin, 'The Masters Club'], ['Email us', s.email ? 'mailto:' + s.email : '', s.email]]
      .filter(function (l) { return l[1]; })
      .map(function (l) {
        var mail = l[1].indexOf('mailto:') === 0;
        var icon = '<svg class="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SOCIAL_ICONS[l[0]] + '</svg>';
        return '<a href="' + esc(l[1]) + '" class="' + (cards ? 'follow-card' : '') + (mail ? ' ph-no-capture' : '') + '"' + (mail ? '' : ' target="_blank" rel="noopener"') + '>' + icon +
          (cards ? '<span><b>' + l[0] + '</b><small>' + esc(l[2]) + '</small></span>' : l[0]) + '</a>';
      }).join('');
  }

  // The menu is places to go. Signing in adds the members' pages to it and keeps the club's own
  // (F143); only Partners and Join, which are for outsiders, step back to the footer. Your profile
  // and Sign out sit under your photo at the right, and in the phone menu they close the list.
  function renderNav(route) {
    var link = function (l) { return '<a href="' + l[0] + '" class="' + (route === l[0] ? 'active' : '') + '">' + l[1] + '</a>'; };
    $('#footSocial').innerHTML = socialLinks();
    $('#footLinks').innerHTML = state.me ? [['about', 'About'], ['meetings', 'Meetings'], ['partners', 'Partners'], ['join', 'Join']].map(function (l) { return '<a href="' + l[0] + '">' + l[1] + '</a>'; }).join('') : '';
    if (!state.me) {
      $('#nav').innerHTML = [['about', 'About'], ['meetings', 'Meetings'], ['partners', 'Partners']].map(link).join('') + '<a href="join" class="btn gold small">Sign in</a>';
      return;
    }
    var links = [['members', 'Directory'], ['events', 'Events'], ['board', 'Board']].filter(function (l) { return routeOn(l[0]); });
    links.push(['about', 'About'], ['meetings', 'Past meetings']);
    if (state.me.tier === 'leader') links.push(['admin', 'Admin' + (state.data && state.data.pending ? ' (' + state.data.pending + ')' : '')]);
    $('#nav').innerHTML = links.map(link).join('') +
      '<div class="account"><button type="button" class="account-btn' + (route === 'me' ? ' active' : '') + '" aria-label="Your account" aria-expanded="false" aria-controls="accountMenu">' +
      avatar({ id: state.me.id, name: state.me.name, profile: state.me.profile }, 'xs') + icon('chevron') + '</button>' +
      '<div class="account-menu" id="accountMenu">' + link(['me', 'My profile']) + '<a href="./" data-signout>Sign out</a></div></div>';
    $('[data-signout]').addEventListener('click', function (e) { e.preventDefault(); signOut(); });
    wireAccount();
  }

  // The menu under your photo: the button opens it; Escape, a click elsewhere, tabbing out or going
  // to another page closes it. Fresh data redraws the menu, so whether it's open, and which of its
  // links had focus, carry over to the new one.
  var accountOpen = false;
  var accountFocus = '';
  function wireAccount() {
    var box = $('#nav .account');
    var btn = $('.account-btn', box);
    var setOpen = function (open) {
      accountOpen = open;
      box.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    if (accountOpen) {
      setOpen(true);
      if (accountFocus) { var again = $('.account-menu [href="' + accountFocus + '"]', box); if (again) again.focus(); }
    }
    box.addEventListener('focusin', function (e) { accountFocus = e.target.closest('.account-menu a') ? e.target.getAttribute('href') : ''; });
    btn.addEventListener('click', function () {
      var open = !box.classList.contains('open');
      setOpen(open);
      if (open) $('.account-menu a', box).focus();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && box.classList.contains('open')) { e.stopPropagation(); setOpen(false); btn.focus(); }
    });
    // Only a move of focus to somewhere else closes it: Safari gives a clicked link no focus, so
    // a click on My profile must not count as leaving.
    box.addEventListener('focusout', function (e) { if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false); });
    document.addEventListener('click', function close(e) {
      if (!document.body.contains(box)) return document.removeEventListener('click', close);
      if (!box.contains(e.target)) setOpen(false);
    });
  }

  /* ---------- forms ---------- */

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

  /* ---------- router ---------- */

  function wireRetry() {
    $$('[data-retry]').forEach(function (b) { b.addEventListener('click', render); });
  }
  function routeOf() {
    var parts = currentRoute().split('?');
    return { route: parts[0], params: new URLSearchParams(parts[1] || '') };
  }

  function route(hash, def) {
    routes[hash] = def;
  }

  // A page with a flag (the Board) exists only for those its PostHog flag is on for. Until flags
  // load it's off, so it never flashes in for members; for a leader it appears once they arrive.
  function routeOn(hash) {
    var r = routes[hash];
    // Flags only gate members' pages, so a visitor's page never asks PostHog for one (F130).
    return !(r && r.flag) || (!!state.me && !!Analytics.flag(r.flag));
  }
  function flagsNow() {
    return Object.keys(routes).filter(function (h) { return routes[h].flag; }).map(function (h) { return h + routeOn(h); }).join();
  }
  var flagState = '';
  // Flags arrive after the page is drawn, and again on sign-in. Redraw only when one changed, and
  // only the menu unless the open page is a flagged one, so a half-typed form is never wiped.
  function flagsChanged() {
    var now = flagsNow();
    if (now === flagState) return;
    flagState = now;
    if (!state.me) return;
    var at = routeOf();
    if (routes[at.route] && routes[at.route].flag && state.data) render(); else renderNav(at.route);
  }

  function render() {
    var at = routeOf();
    var r = routes[at.route] || routes[''];
    // Signed in, a flagged page that's off opens Home, like an address that doesn't exist.
    if (r.flag && state.me && !routeOn(at.route)) r = routes[''];
    accountOpen = false;
    renderNav(at.route);
    setMenu(false);
    closeSheet();
    var app = $('#app');
    if (r.member && !state.me) {
      // A link from WhatsApp opens the right page after sign-in. The plain directory is the default anyway.
      if (currentRoute() !== 'members') writeJson('sessionStorage', INTENDED_KEY, currentRoute());
      app.innerHTML = routes['join'].page(new URLSearchParams(), { gated: true });
      routes['join'].wire(at.params);
    } else if (r.member && !state.data) {
      app.innerHTML = loading('Opening the club');
      refresh().then(render, function (e) {
        if (e.code === 'unauthorized') return render();
        app.innerHTML = errorBlock(e);
        wireRetry();
      });
      return;
    } else {
      // A page never stays stuck: say so, and the fresh data gets a chance to fix it. Pages that
      // load more data finish after an await, so their errors arrive later and land here too.
      var failed = function (e) {
        console.error(e);
        Analytics.error(e, { where: 'page draw', route: at.route });
        drawFailed = true;
        app.innerHTML = errorBlock({ message: "This page couldn't open. Try again in a moment." });
        wireRetry();
      };
      try {
        drawing = true;
        try { app.innerHTML = r.page(at.params); } finally { drawing = false; }
        var wired = r.wire ? r.wire(at.params) : null;
        if (wired && typeof wired.then === 'function') wired.catch(failed);
        if (wired === 'keep-scroll') return;
      } catch (e) {
        failed(e);
        return;
      }
    }
    drawFailed = false;
    window.scrollTo(0, 0);
  }

  function setMenu(open) {
    $('#nav').classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
    $('#menuBtn').innerHTML = icon(open ? 'close' : 'menu');
  }

  function start() {
    $('#menuBtn').addEventListener('click', function () { setMenu(!$('#nav').classList.contains('open')); });
    document.addEventListener('click', followLink);
    window.addEventListener('popstate', render);
    if (CONFIG.ENV !== 'production') $('#envNote').textContent = CONFIG.ENV + ' build with test data';
    if (!state.publicInfo) state.publicInfo = readJson('localStorage', PUBLIC_KEY);
    refreshPublic();
    flagState = flagsNow();
    Analytics.onFlags(flagsChanged);
    if (!Api.session()) {
      clearSaved();
      return render();
    }
    loadSaved();
    Analytics.identify(state.me);
    if (state.data) {
      // The saved copy shows now; the fresh one replaces it when it arrives.
      render();
      refresh().catch(function (e) { if (e.code === 'unauthorized') render(); });
    } else {
      $('#app').innerHTML = loading('Opening the club');
      refresh().then(render, function (e) {
        if (e.code === 'unauthorized') return render();
        $('#app').innerHTML = errorBlock(e);
        wireRetry();
      });
    }
  }

  return {
    $: $, $$: $$, esc: esc, state: state, icon: icon, page: page, avatar: avatar, tags: tags, roleLine: roleLine, toast: toast, go: go, loading: loading,
    errorBlock: errorBlock, setBusy: setBusy, wireRetry: wireRetry, clearErrors: clearErrors, showErrors: showErrors, longDate: longDate, signInWithCode: signInWithCode, pendingCode: pendingCode, setPendingCode: setPendingCode, devSignIn: devSignIn,
    openSheet: openSheet, closeSheet: closeSheet, route: route, render: render, refresh: refresh, refreshPublic: refreshPublic, loadAdmin: loadAdmin, replaceItem: replaceItem, saveData: saveData,
    siteLink: siteLink, toPath: toPath, socialLinks: socialLinks, copyText: copyText, downloadFile: downloadFile, photoCache: photoCache, writeJson: writeJson, PHOTOS_KEY: PHOTOS_KEY, fetchPhotos: fetchPhotos, start: start
  };
})();
;
// js/pages/public.js
// The public pages, and the pages for people who aren't signed in yet.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, avatar = App.avatar, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, longDate = App.longDate;

  var info = function () { return state.publicInfo || {}; };
  // Applications count as open until a leader turns them off in Admin. While they're closed, no page
  // links the form, and an email given on Join goes on the list for the next cohort (F144).
  var applicationsOpen = function () { return (info().settings || {}).applications_open !== false; };
  var CLOSED = 'Applications are closed right now.';
  var LEAVE_EMAIL = "Leave your email and we'll email you the application link as soon as the next cohort opens.";

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
      '<div class="actions on-navy"><a class="btn gold" href="join">' + (applicationsOpen() ? 'Apply for the next cohort' : 'Join the list for the next cohort') + '</a><a class="link" href="partners">Partner with us</a></div>' +
      '</div></section>' +
      '<div class="wrap">' +
      '<section class="split"><h2>A club and a community</h2><dl>' +
      '<div><dt>The club</dt><dd>' + esc(c.club) + '</dd></div>' +
      '<div><dt>The community</dt><dd>' + esc(c.community) + '</dd></div>' +
      '</dl></section>' +
      '<section class="moments" aria-label="Photos from the club">' + c.moments.map(function (m, i) {
        return '<img src="' + esc(Core.webp(m.src)) + '" alt="' + esc(m.alt) + '" width="' + (i ? 900 : 1600) + '" height="' + (i ? 600 : 1067) + '"' + (i ? ' loading="lazy"' : '') + '>';
      }).join('') + '</section></div>' +
      '<section class="statement"><div class="wrap"><p>' + esc(c.giveFirst) + ' <span>' + esc(c.giveFirstRest) + '</span></p></div></section>' +
      '<div class="wrap"><section class="past"><div class="past-head"><h2>In the past</h2><a class="link" href="meetings">All meetings</a></div>' +
      '<div class="rail">' + c.meetings.map(function (mt) {
        return '<a href="meetings?m=' + esc(mt.id) + '"><img src="' + esc(Core.webp(mt.poster)) + '" alt="" loading="lazy" width="640" height="800">' +
          '<span class="who">' + esc(mt.speaker) + '</span><span class="when">' + esc(longDate(mt.date)) + '</span></a>';
      }).join('') + '</div></section>' +
      (coming.length ? '<section class="coming"><div class="past-head"><h2>In the future</h2>' +
        (state.me ? '<a class="link" href="events">All events</a>' : '<a class="link" href="join">How to join</a>') + '</div>' +
        coming.map(function (m) {
          return '<div class="event-row"><div class="date" aria-label="' + esc(m.day + ' ' + m.month) + '"><b>' + esc(m.day) + '</b><span>' + esc(m.month.slice(0, 3)) + '</span></div>' +
            '<span class="body"><h3 class="title" dir="auto">' + esc(m.title) + '</h3><span class="muted" dir="auto">' + esc(m.note) + '</span></span></div>';
        }).join('') + '</section>' : '') +
      '<section class="follow"><h2>Follow the club</h2><div class="follow-links">' + App.socialLinks(true) + '</div></section>' +
      '</div>';
  }

  // Why the club exists, in a navy panel wearing the page's band, then the people who run it as
  // large square photos, each with a link to their LinkedIn on the name's line.
  function pageAbout() {
    return page('<section class="about-top panel navy tied"><h1>Why the club exists</h1>' +
      '<p class="lead measure">' + esc(CONTENT.mission) + '</p></section>' +
      '<section class="about-people"><h2>Who runs it</h2>' +
      '<p class="lead measure">The club is the current cohort. The community is everyone who has been through it. Both are run by volunteers who are Reichman students.</p>' +
      '<div class="people">' + CONTENT.leaders.map(function (p) {
        return '<div class="person">' + avatar({ name: p.name, profile: { photo: p.photo } }, 'portrait') +
          '<div class="person-head"><div class="person-who"><div class="name">' + esc(p.name) + '</div><div class="muted">' + esc(p.role) + '</div></div>' +
          (p.linkedin ? '<a class="person-link" href="' + esc(p.linkedin) + '" target="_blank" rel="noopener" aria-label="' + esc(p.name) + ' on LinkedIn">' + App.icon('linkedin') + ' LinkedIn</a>' : '') + '</div></div>';
      }).join('') + '</div></section>');
  }

  function pageMeetings() {
    var extra = (info().past_events || []).map(function (e) { return { id: e.id, date: e.date, kind: Core.EVENT_KINDS[e.kind] || '', speaker: e.title, role: e.place, quote: '', recap: e.recap, poster: e.poster, photos: [] }; });
    var list = CONTENT.meetings.concat(extra);
    return page('<h1>Past meetings</h1>' +
      '<p class="lead measure mt-2">Every meeting opens with food and structured networking, then a talk or workshop with someone worth hearing.</p>' +
      '<div class="meetings">' + list.map(function (m, i) {
        return '<article class="meeting" id="m-' + esc(m.id) + '">' +
          (m.poster ? '<img class="poster" src="' + esc(Core.webp(m.poster)) + '" alt="Poster for ' + esc(m.speaker) + '" width="640" height="800"' + (i ? '' : ' fetchpriority="high"') + (i > 1 ? ' loading="lazy"' : '') + '>' : '') +
          '<div class="body">' +
          '<p class="meta"><time datetime="' + esc(m.date) + '">' + esc(longDate(m.date)) + '</time><span>' + esc(m.kind) + '</span></p>' +
          '<h2>' + esc(m.speaker) + '</h2><p class="muted role">' + esc(m.role) + '</p>' +
          (m.quote ? '<blockquote>' + esc(m.quote) + '</blockquote>' : '') +
          '<p class="recap">' + esc(m.recap) + '</p>' +
          (m.photos && m.photos.length ? '<div class="photos n' + m.photos.length + '">' + m.photos.map(function (p) {
            return '<img src="' + esc(Core.webp(p.src)) + '" alt="' + esc(p.alt) + '" loading="lazy">';
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
    return page('<div class="partners-top"><section class="partner-pitch panel navy tied"><h1>Work with the club</h1>' +
      '<p class="lead">' + esc(pitch) + '</p><p>' + esc(c.partnerDeal) + '</p></section>' +
      '<section class="partner-form panel mist" id="talk"><h2>Talk to us</h2><form class="form-grid" id="inquiry" novalidate>' +
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

  // The one way in: one card wearing the page's band, the club on the left in navy, the form on mist
  // on the right. An email gets
  // a member a sign-in code and anyone else the application form, behind the same screen, so the
  // page never tells who's a member (F109, F113). Members-only pages show it too, with a line why.
  function pageJoin(params, opts) {
    var me = state.me;
    var gated = opts && opts.gated;
    var s = info().settings || {};
    var open = applicationsOpen();
    return page((gated ? '<p class="note gate">Members only. Sign in to continue.</p>' : '') +
      '<section class="join tied"><div class="join-club panel navy"><h1>Join the club</h1>' +
      '<p class="join-lead">Open to Reichman master\'s students.' + (open && s.applications_note ? ' ' + esc(s.applications_note) : '') + '</p>' +
      (open ? '' : '<p class="join-lead"><strong>' + esc(CLOSED) + '</strong></p><p class="join-lead">' + esc(LEAVE_EMAIL) + '</p>') +
      '<dl class="join-gets"><div><dt>The club</dt><dd>' + esc(CONTENT.club) + '</dd></div><div><dt>The community</dt><dd>' + esc(CONTENT.community) + '</dd></div></dl></div>' +
      '<div class="join-form panel mist">' +
      (me ? '<h2>You\'re signed in</h2><p class="muted">As ' + esc(me.name) + '.</p><a class="btn navy" href="members">Go to the directory</a>' : '<div id="joinFlow"></div>') +
      '</div></section>' +
      '<section class="faq"><h2>Questions applicants ask</h2><dl>' + CONTENT.faq.map(function (f) {
        return '<div><dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd></div>';
      }).join('') + '</dl></section>');
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
    var open = applicationsOpen();
    flow.innerHTML = '<h2>' + (open ? 'Sign in or apply' : 'Sign in or join the list') + '</h2>' +
      '<p class="muted small">Members get a sign-in code. ' + (open ? 'Everyone else gets the application form.' : 'Everyone else goes on the list for the next cohort.') + '</p>' +
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
        // This visit gets the email they gave; signing in as a member makes it that member's (F123).
        Analytics.identify({ email: email });
        // The API answers the same for everyone, so the site can't tell a sign-in code from an
        // application email. Which one it was shows in what the person does next.
        Analytics.track('join email sent', { resend: false });
        App.setPendingCode(email);
        checkStep(flow, email);
        $('input[name=code]', flow).focus();
      } catch (err) {
        // An email went out a little while ago: its code may still work, so go to the code step
        // and say when a new one can be sent.
        if (err.code === 'limited') {
          Analytics.identify({ email: email });
          App.setPendingCode(email, 1, Date.now() + err.retryAfter * 1000);
          checkStep(flow, email, err.message);
          return;
        }
        Analytics.track('sign in failed', { method: 'email', reason: err.code });
        setBusy(btn, false);
        showErrors(f, err);
      }
    });
  }

  // The same screen for everyone who gave an email: the code for members, the application for
  // everyone else. The address itself is the way back to the email step.
  function checkStep(flow, email, waitNote) {
    var s = info().settings || {};
    var open = applicationsOpen();
    flow.innerHTML = '<h2>Check your email</h2>' +
      '<p class="muted small">We sent you an email at <button class="link wrap ph-sensitive" type="button" data-change title="Use another email">' + esc(email) + '</button>.</p>' +
      '<form class="code-form" id="codeForm" novalidate>' +
      '<label>Member? Enter the code from your email.<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required class="code-input"><span class="field-error" data-err="code"></span></label>' +
      '<button class="btn gold" type="submit">Sign in</button>' +
      '<button class="btn quiet" type="button" data-resend disabled>Send a new code</button>' +
      '<p class="field-error" data-resend-note role="status"></p></form>' +
      '<div class="join-apply">' + (open
        ? '<p>Not a member?</p><a class="btn navy" href="' + esc(s.apply_url || CONTENT.applyUrl) + '" target="_blank" rel="noopener" data-apply>Start your application now</a>'
        : '<p class="on-list"><strong>Not a member? You\'re on the list for the next cohort.</strong> We\'ll email you the application link as soon as it opens.</p>') + '</div>';
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
    if (waitNote) $('[data-resend-note]', flow).textContent = waitNote;
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
      var ready = p.readyAt || p.at + waits[Math.min(p.n, waits.length) - 1];
      var left = Math.ceil((ready - Date.now()) / 1000);
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
        Analytics.track('join email sent', { resend: true });
        App.setPendingCode(email, p.n + 1);
        toast('New code sent');
      } catch (err) {
        note.textContent = err.message;
        if (err.retryAfter) App.setPendingCode(email, p.n, Date.now() + err.retryAfter * 1000);
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
      history.replaceState(null, '', App.toPath('tell') + location.search);
    }
    if (!tellEmail) { go('join'); return ''; }
    return page('<section class="signin-card panel mist"><h1>Tell the club leads</h1>' +
      '<p class="muted">In a cohort, but applied with another email? Send this and a leader will link <b class="ph-sensitive">' + esc(tellEmail) + '</b> to your name, so you can sign in with it.</p>' +
      '<form class="form-grid" id="tellForm" novalidate>' +
      '<label>Your full name<input type="text" name="name" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Anything that helps us find you <span class="hint">Your cohort, or the email you applied with</span><textarea name="note" maxlength="280" rows="2" dir="auto"></textarea><span class="field-error" data-err="note"></span></label>' +
      '<div class="row-actions"><button class="btn navy" type="submit">Send to the club leads</button></div></form></section>');
  }

  function wireTell() {
    var tell = $('#tellForm');
    if (!tell) return;
    Analytics.identify({ email: tellEmail });
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
    return page('<section class="signin-card panel mist"><h1>The application form</h1><p class="muted" id="applyNote">Opening it now…</p></section>');
  }

  async function wireApply() {
    var got = new URLSearchParams(location.hash.slice(1));
    if (got.get('e')) {
      Analytics.identify({ email: Core.normalizeEmail(got.get('e')) });
      history.replaceState(null, '', App.toPath('apply') + location.search);
    }
    await App.refreshPublic();
    var s = info().settings || {};
    if (!applicationsOpen()) {
      $('#applyNote').innerHTML = esc(CLOSED) + ' <a class="link" href="join">Leave your email</a> and we\'ll email you the application link as soon as the next cohort opens.';
      return;
    }
    var url = s.apply_url || CONTENT.applyUrl;
    $('#applyNote').innerHTML = 'Opening it now. If nothing happens, <a class="link" href="' + esc(url) + '">open the form</a>.';
    // The page is about to leave the site, so the click waits for posthog-js (2 seconds at most)
    // and goes by beacon, then a moment for it to leave (F129).
    Analytics.whenReady(function () {
      Analytics.track('apply clicked', { source: 'email' }, { leaving: true });
      setTimeout(function () { location.replace(url); }, 400);
    });
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
      // The email and code leave the address; the campaign the link came with stays (F129).
      history.replaceState(null, '', App.toPath('signin') + location.search);
    }
    if (!linkCode) { go('join'); return ''; }
    return page('<section class="signin-card panel mist tied"><h1>Sign in to the club</h1>' +
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
;
// js/pages/directory.js
// The directory: the people and the search, nothing else.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, icon = App.icon, page = App.page, avatar = App.avatar, tags = App.tags, roleLine = App.roleLine, toast = App.toast, openSheet = App.openSheet, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;

  function pageMembers() {
    return page('<div class="page-head"><h1>Directory</h1><span class="count" id="count" aria-live="polite"></span>' +
      '<span class="spacer"></span><a class="link" href="me">Edit my profile</a></div><div id="dirBody"></div>');
  }

  var page_draw = null;

  function nudge() {
    var u = state.me;
    if (!u.needs_review) return '';
    return '<p class="nudge" id="nudge">Is your profile still right? <button class="link" type="button" id="looksRight">Looks right</button><a class="link" href="me">Update it</a></p>';
  }

  function wireMembers(params) {
    var d = state.data.directory;
    var s = state.dir;
    var cohorts = Array.from(new Set(d.members.map(function (m) { return m.cohort; }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); });
    var hidden = d.hiddenTiers.length
      ? '<p class="note mb-2">You\'re viewing as ' + esc(TIER_LABEL[d.viewer.tier]) + ', so ' + esc(d.hiddenTiers.map(function (t) { return TIER_LABEL[t]; }).join(' and ')) + ' profiles are hidden from you.</p>'
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
      '<span class="role ph-sensitive" dir="auto">' + (role || 'No profile yet') + '</span>' +
      '<span class="tags ph-sensitive">' + tags(m) + '</span>' +
      (p.help.length ? '<span class="help ph-sensitive" dir="auto">Can help with ' + esc(p.help.join(', ')) + '</span>' : '') +
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
    var actions = wa || li || mail ? '<div class="actions ph-no-capture">' + wa + li + mail + '</div>' : (preview ? '' : '<p class="muted small mt-4">No contact links yet.</p>');
    return avatar(m, 'lg') +
      '<h2 dir="auto">' + esc(m.name) + '</h2>' +
      '<div class="role ph-sensitive" dir="auto">' + (roleLine(p) || 'No role yet') + '</div>' +
      (p.city || p.program ? '<div class="muted ph-sensitive" dir="auto">' + esc([p.program, p.city].filter(Boolean).join(', ')) + '</div>' : '') +
      '<div class="tags ph-sensitive mt-2">' + tags(m) + '</div>' +
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
  App.route('members', {
    page: pageMembers, wire: wireMembers, member: true,
    onData: function () { if (page_draw && $('#results')) page_draw(); }
  });
})();
;
// js/pages/me.js
// My profile: what others see, the photo, and the choices about being shown.
(function () {
  var $ = App.$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, cohortLabel = Core.cohortLabel;

  function pageMe() {
    var u = state.me;
    var p = u.profile;
    var first = u.first;
    var opt = function (list, val) { return list.map(function (i) { return '<option ' + (val === i ? 'selected' : '') + '>' + esc(i) + '</option>'; }).join(''); };
    return page('<div class="page-head"><h1>' + (!first ? 'Edit your profile' : u.hasProfile ? 'Welcome. Check your profile' : 'Welcome. Fill in your profile') + '</h1></div>' +
      (first ? '<p class="lead measure">' + (u.hasProfile ? 'We filled this in from your application. Fix anything that\'s off, and save.' : 'This is how other members find you. It takes a minute, and you can change it any time.') + ' <a class="link" href="members">Skip for now</a></p>' : '') +
      '<div class="two mt-4"><form class="form-grid cols" id="profileForm" novalidate>' +
      // Photos come only from uploads, so a first visit without one asks for it up front (F106).
      '<div class="photo-row"><span id="myPhoto">' + App.avatar(u, 'lg') + '</span><div class="row-actions"><label class="btn ' + (first && !p.photo ? 'gold' : 'quiet') + ' small file-btn">' + (p.photo ? 'Change photo' : 'Add a photo') + '<input type="file" accept="image/*" aria-label="Choose a photo" class="ph-no-capture"></label>' +
      (p.photo ? '<button class="link" type="button" id="removePhoto">Remove photo</button>' : '') + (first && !p.photo ? '<span class="muted small">Add one so people recognise you at meetings.</span>' : '') + '</div></div>' +
      '<label>Name<input type="text" name="name" value="' + esc(u.name) + '" maxlength="60" required dir="auto"><span class="field-error" data-err="name"></span></label>' +
      '<label>Role<input type="text" name="role" value="' + esc(p.role) + '" maxlength="60" dir="auto" placeholder="Product Manager"><span class="field-error" data-err="role"></span></label>' +
      '<label>Company<input type="text" name="company" value="' + esc(p.company) + '" maxlength="60" dir="auto" placeholder="Where you work now"><span class="field-error" data-err="company"></span></label>' +
      '<label>City<input type="text" name="city" value="' + esc(p.city) + '" maxlength="60" dir="auto"><span class="field-error" data-err="city"></span></label>' +
      '<label>Program<input type="text" name="program" value="' + esc(p.program) + '" maxlength="100" dir="auto" placeholder="GMBA, Arison"><span class="field-error" data-err="program"></span></label>' +
      '<label>Industry<select name="industry"><option value="">Choose one</option>' + opt(Core.INDUSTRIES, p.industry) + '</select><span class="field-error" data-err="industry"></span></label>' +
      '<label>Cohort <span class="hint">Set by leaders</span><input type="text" value="' + esc(cohortLabel(u.cohort)) + '" disabled></label>' +
      '<label>I can help with <span class="hint">Separate with commas, up to 6</span><input type="text" name="help" value="' + esc(p.help.join(', ')) + '" maxlength="250" dir="auto" placeholder="PM interviews, fundraising"><span class="field-error" data-err="help"></span></label>' +
      '<label>I\'m looking for <span class="hint">Separate with commas, up to 6</span><input type="text" name="looking" value="' + esc(p.looking.join(', ')) + '" maxlength="250" dir="auto" placeholder="Co-founder, PM roles"><span class="field-error" data-err="looking"></span></label>' +
      '<label>Outside work <span class="hint">Hobbies and interests, separated with commas</span><input type="text" name="interests" value="' + esc(p.interests.join(', ')) + '" maxlength="250" dir="auto" placeholder="Running, chess, cooking"><span class="field-error" data-err="interests"></span></label>' +
      '<div class="field">Open to<div class="checks">' + Core.OPEN_TO.map(function (o) { return '<label><input type="checkbox" name="open_to" value="' + esc(o) + '" ' + (p.open_to.indexOf(o) !== -1 ? 'checked' : '') + '> ' + esc(o) + '</label>'; }).join('') + '</div></div>' +
      '<label>Short bio <span class="hint">Up to 280 characters</span><textarea name="bio" maxlength="280" rows="3" dir="auto">' + esc(p.bio) + '</textarea><span class="field-error" data-err="bio"></span></label>' +
      '<label>LinkedIn URL<input type="url" name="linkedin" value="' + esc(p.linkedin) + '" placeholder="https://www.linkedin.com/in/..."><span class="field-error" data-err="linkedin"></span></label>' +
      '<label>WhatsApp number <span class="hint">Optional, with the country code</span><input type="tel" name="phone" value="' + esc(p.phone) + '" placeholder="+972..."><span class="field-error" data-err="phone"></span></label>' +
      '<label class="check-line"><input type="checkbox" name="show_phone" ' + (p.show_phone ? 'checked' : '') + '> Show a WhatsApp button on my profile</label>' +
      '<label class="check-line"><input type="checkbox" name="show_email" ' + (p.show_email ? 'checked' : '') + '> Show my email <span class="ph-sensitive">(' + esc(u.email) + ')</span> on my profile</label>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Save profile</button></div>' +
      '</form><div class="sticky"><div class="preview-label">How others see you</div><div class="preview panel mist tied"><div class="sheet" id="preview"></div></div></div></div>');
  }

  function readProfileForm(f) {
    var fd = new FormData(f);
    return {
      name: String(fd.get('name') || ''),
      profile: {
        role: fd.get('role'), company: fd.get('company'), city: fd.get('city'), program: fd.get('program'), industry: fd.get('industry'),
        help: fd.get('help'), looking: fd.get('looking'), interests: fd.get('interests'), open_to: fd.getAll('open_to'),
        bio: fd.get('bio'), linkedin: fd.get('linkedin'), phone: fd.get('phone'), show_phone: !!fd.get('show_phone'), show_email: !!fd.get('show_email')
      }
    };
  }

  function wireMe() {
    var f = $('#profileForm');
    var u = state.me;
    // Built by the same function the server uses for the directory, so it shows exactly what others will see.
    function preview() {
      var r = readProfileForm(f);
      var v = Core.validateProfile(r.profile).value;
      v.photo = u.profile.photo;
      var entry = Core.directoryEntry({ id: u.id, name: r.name || u.name, tier: u.tier, cohort: u.cohort, email: u.email, joined_on: 'yes' }, v, false);
      $('#preview').innerHTML = App.profileSheet(entry, true);
    }
    f.addEventListener('input', preview);
    preview();
    wirePhoto();
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
        Analytics.track('profile updated', profileFacts(u, check.value));
        state.me = res.me;
        toast('Profile saved');
        await App.refresh();
        go('members');
      } catch (err) {
        setBusy(btn, false);
        if (err.code !== 'unauthorized') showErrors(f, err);
        else App.render();
      }
    });
  }

  // What a save says about a profile, without a word of what's in it.
  function profileFacts(u, v) {
    var filled = ['role', 'company', 'city', 'program', 'industry', 'help', 'looking', 'interests', 'open_to', 'bio', 'linkedin', 'phone']
      .filter(function (k) { return Array.isArray(v[k]) ? v[k].length : !!v[k]; }).length;
    return { first_time: !!u.first, fields_filled: filled, has_photo: !!u.profile.photo, show_phone: !!v.show_phone, show_email: !!v.show_email };
  }

  // Crops to a square and shrinks to a small JPEG in the browser, so the file's original size,
  // format and location data never leave the phone.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var img = new Image();
      img.onload = function () {
        var box = Core.cropSquare(img.naturalWidth, img.naturalHeight);
        var c = document.createElement('canvas');
        c.width = c.height = 256;
        c.getContext('2d').drawImage(img, box.x, box.y, box.side, box.side, 0, 0, 256, 256);
        var q = 0.8;
        var data = c.toDataURL('image/jpeg', q);
        while (data.length > 40000 && q > 0.3) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
        resolve(data);
      };
      img.onerror = reader.onerror = function () { reject(new Error("That file doesn't look like a photo.")); };
      reader.onload = function () { img.src = reader.result; };
      reader.readAsDataURL(file);
    });
  }

  function wirePhoto() {
    var input = $('.file-btn input');
    input.addEventListener('change', async function () {
      if (!input.files[0]) return;
      try {
        var data = await shrink(input.files[0]);
        var r = await Api.call('savePhoto', { data: data });
        Analytics.track('photo uploaded');
        state.me = r.me;
        App.photoCache()[r.me.id] = { v: r.me.profile.photo, data: data };
        App.writeJson('localStorage', App.PHOTOS_KEY, App.photoCache());
        toast('Photo saved');
        App.render();
        App.refresh().catch(function () {});
      } catch (e) { toast(e.message); }
    });
    var remove = $('#removePhoto');
    if (remove) remove.addEventListener('click', async function () {
      try {
        var r = await Api.call('removePhoto');
        Analytics.track('photo removed');
        state.me = r.me;
        toast('Photo removed');
        App.render();
        App.refresh().catch(function () {});
      } catch (e) { toast(e.message); }
    });
  }

  App.route('me', { page: pageMe, wire: wireMe, member: true });
})();
;
// js/pages/events.js
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
    return page('<div class="page-head"><h1>Events</h1><span class="spacer"></span><a class="link" href="event-edit">Post an event</a></div><div id="eventList"></div>');
  }

  function drawList() {
    var today = state.data.today;
    var all = state.data.events;
    var next = all.filter(function (e) { return e.date >= today; });
    var past = all.filter(function (e) { return e.date < today; }).reverse();
    var row = function (e) {
      return '<a class="event-row" href="event?e=' + esc(e.id) + '">' + dateBlock(e) + '<span class="body"><h2 class="title" dir="auto">' + esc(e.title) + '</h2>' +
        '<span class="muted" dir="auto">' + esc(Core.weekday(e.date)) + ' at ' + esc(e.time) + (e.place ? ', ' + esc(e.place) : '') + '</span>' +
        '<span class="tags"><span class="tag">' + esc(Core.EVENT_KINDS[e.kind] || e.kind) + '</span>' + statusLine(e) + '</span></span></a>';
    };
    $('#eventList').innerHTML = '<div class="event-cols"><div class="event-next">' + (next.length ? next.map(row).join('') : '<div class="empty">Nothing on the calendar yet. Post a low-key meetup, or check back soon.</div>') + '</div>' +
      (past.length ? '<div class="event-past"><h2 class="past-title">Recently</h2>' + past.map(row).join('') + '</div>' : '') + '</div>';
  }

  /* ---------- one event ---------- */

  function pageEvent(params) {
    var e = find(params.get('e'));
    if (!e) return page('<div class="note warn">This event isn\'t here. It may be for another group, or it has passed.</div><p class="mt-2"><a class="link" href="events">All events</a></p>');
    return page('<p class="back"><a class="link" href="events">All events</a></p><div id="eventBody">' + eventHtml(e) + '</div>');
  }

  function seatNote(e) {
    if (state.me.tier === 'community' && e.community_seats !== '') {
      return Math.max(0, e.community_left) + ' of ' + e.community_seats + ' community seats left';
    }
    if (e.seats !== '') return Math.max(0, Number(e.seats) - e.going_count) + ' of ' + e.seats + ' seats left';
    return '';
  }

  function eventHtml(e) {
    var link = App.siteLink('event?e=' + e.id);
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
    return '<div class="event-layout"><div><h1 dir="auto">' + esc(e.title) + '</h1>' +
      '<div class="tags mt-2"><span class="tag">' + esc(Core.EVENT_KINDS[e.kind] || e.kind) + '</span><span class="tag">' + esc(audienceLabel(e.audience)) + '</span>' + (e.status === 'cancelled' ? statusLine(e) : '') + '</div>' +
      '<p class="lead mt-2">' + esc(when(e)) + (e.end_time ? ' to ' + esc(e.end_time) : '') + '</p>' +
      (e.place ? '<p dir="auto">' + (e.map_url ? '<a class="link" href="' + esc(e.map_url) + '" target="_blank" rel="noopener">' + esc(e.place) + '</a>' : esc(e.place)) + '</p>' : '') +
      (e.details ? '<p class="details ph-sensitive" dir="auto">' + esc(e.details) + '</p>' : '') +
      (e.price ? '<p>' + esc(e.price) + (e.pay_url ? ' <a class="link" href="' + esc(e.pay_url) + '" target="_blank" rel="noopener">Pay here</a>' : '') + (e.me.paid ? ' <span class="tag">Paid</span>' : '') + '</p>' : '') +
      (seatNote(e) && !e.me.status ? '<p class="muted">' + esc(seatNote(e)) + '</p>' : '') +
      (e.rsvp_closes && e.signup.open ? '<p class="muted">Sign-up closes ' + esc(Core.shortDate(e.rsvp_closes.slice(0, 10))) + ' at ' + esc(e.rsvp_closes.slice(11)) + '</p>' : '') +
      '<div class="signup">' + signup + '</div>' +
      (e.me.group ? '<p class="you">Your table: ' + esc(e.me.group) + (e.me.groupmates.length ? ', with ' + esc(e.me.groupmates.join(', ')) : '') + '</p>' : '') +
      '<div class="actions event-actions"><a href="' + esc(Core.googleCalendarUrl(e, link)) + '" target="_blank" rel="noopener" class="btn quiet small ph-no-capture" data-gcal>Google Calendar</a>' +
      '<button class="btn quiet small" data-ics>Apple or Outlook</button>' +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(share)) + '" target="_blank" rel="noopener" data-share>Share on WhatsApp</a></div></div>' +
      '<aside class="event-side panel mist tied"><h2 class="sub">Who\'s coming</h2>' +
      (e.going_count ? '<p>' + e.attendees.map(function (a) { return '<a class="person-link" href="members?m=' + esc(a.id) + '" dir="auto">' + esc(a.name) + '</a>'; }).join(', ') +
        (others > 0 ? (e.attendees.length ? ' and ' : '') + others + ' more' : '') + '</p>' : '<p class="muted">Nobody yet.</p>') +
      (e.waitlist_count ? '<p class="muted">' + e.waitlist_count + ' on the waitlist</p>' : '') +
      (e.owners.length ? '<p class="muted">Run by ' + esc(e.owners.map(function (o) { return o.name; }).join(', ')) + '</p>' : '') +
      (e.can_manage ? '<div class="row-actions mt-4"><a class="link" href="event-roster?e=' + esc(e.id) + '">Manage sign-ups</a><a class="link" href="event-edit?e=' + esc(e.id) + '">Edit</a>' +
        '<button class="link" data-cancel>' + (e.status === 'cancelled' ? 'Bring it back' : 'Cancel the event') + '</button></div>' : '') + '</aside></div>';
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
          var going = b.dataset.rsvp === 'in';
          var was = find(e.id).me.status;
          try {
            var r = await Api.call('rsvp', { eventId: e.id, going: going });
            if (going) Analytics.track('rsvp', { event_id: e.id, event_kind: r.event.kind, outcome: r.event.me.status });
            else Analytics.track('rsvp cancelled', { event_id: e.id, event_kind: r.event.kind, was: was });
            App.replaceItem('events', r.event);
            redraw();
          } catch (err) { setBusy(b, false); toast(err.message); }
        });
      });
      $('[data-gcal]', box).addEventListener('click', function () { Analytics.track('calendar added', { event_id: e.id, calendar: 'google' }); });
      $('[data-share]', box).addEventListener('click', function () { Analytics.track('event shared', { event_id: e.id }); });
      $('[data-ics]', box).addEventListener('click', function () {
        Analytics.track('calendar added', { event_id: e.id, calendar: 'file' });
        App.downloadFile(e.id + '.ics', 'text/calendar;charset=utf-8', Core.toIcs(find(e.id), App.siteLink('event?e=' + e.id)));
      });
      var c = $('[data-cancel]', box);
      if (c) c.addEventListener('click', async function () {
        var restoring = find(e.id).status === 'cancelled';
        if (!restoring && !window.confirm('Cancel this event? People who signed up will see it as cancelled.')) return;
        try {
          var r = await Api.call('eventCancel', { id: e.id, restore: restoring });
          Analytics.track(restoring ? 'event restored' : 'event cancelled', { event_id: e.id });
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
    return page('<p class="back"><a class="link" href="' + (id ? 'event?e=' + esc(id) : 'events') + '">Back</a></p><h1>' + (id ? 'Edit the event' : 'Post an event') + '</h1>' +
      (!leader && !id ? '<p class="lead measure mt-2">A bar, a run, a group going to something outside. Anyone in the club can get something going.</p>' : '') +
      '<form class="form-grid form-narrow mt-3" id="eventForm" novalidate>' +
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
        Analytics.track(input.id ? 'event updated' : 'event created', { event_id: r.event.id, kind: r.event.kind, audience: r.event.audience, public: !!r.event.public });
        App.replaceItem('events', r.event);
        state.data.events.sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); });
        App.saveData();
        toast('Saved');
        go('event?e=' + r.event.id);
      } catch (err) { setBusy(btn, false); showErrors(f, err); }
    });
  }

  /* ---------- running it ---------- */

  function pageRoster(params) {
    var e = find(params.get('e'));
    if (!e) return page('<div class="note warn">This event isn\'t here.</div>');
    return page('<p class="back"><a class="link" href="event?e=' + esc(e.id) + '">Back to the event</a></p><div class="page-head"><h1 dir="auto">' + esc(e.title) + '</h1><span class="spacer"></span>' +
      '<button class="btn quiet small" data-groups>Make groups</button><button class="btn quiet small" data-copy>Copy the names</button></div>' +
      '<p class="muted">' + esc(when(e)) + '</p><div id="roster">' + App.loading('Loading sign-ups') + '</div>' +
      (state.me.tier === 'leader' ? '<section class="roster-add"><label>Add someone who called<select id="addWho"><option value="">Choose a member</option>' + state.data.directory.members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'; }).join('') + '</select></label><button class="btn quiet small" data-add>Add</button></section>' : ''));
  }

  function drawRoster(eventId, rows) {
    var box = $('#roster');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<p class="muted mt-3">Nobody has signed up yet.</p>'; return; }
    box.innerHTML = '<div class="roster">' + rows.map(function (r) {
      return '<div class="roster-row" data-row="' + esc(r.member_id) + '"><div class="who"><span class="name" dir="auto">' + esc(r.name) + '</span> <span class="tag ' + esc(r.tier) + '">' + esc(TIER_LABEL[r.tier] || '') + '</span>' +
        (r.status === 'waitlist' ? ' <span class="tag">Waitlist</span>' : '') + (r.email ? '<div class="muted small ph-sensitive">' + esc(r.email) + '</div>' : '') + (r.note ? '<div class="muted small ph-sensitive" dir="auto">' + esc(r.note) + '</div>' : '') + '</div>' +
        '<label>Attendance<select data-f="attended">' + [['', 'Not marked'], ['yes', 'Came'], ['no', "Didn't come"], ['excused', 'Excused']].map(function (o) { return '<option value="' + o[0] + '" ' + (r.attended === o[0] ? 'selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label>Group<input type="text" data-f="group" value="' + esc(r.group) + '" maxlength="60" dir="auto"></label>' +
        '<label class="check-line"><input type="checkbox" data-f="paid" ' + (r.paid ? 'checked' : '') + '> Paid</label></div>';
    }).join('') + '</div>';
    $$('[data-row]', box).forEach(function (row) {
      $$('[data-f]', row).forEach(function (el) {
        el.addEventListener('change', async function () {
          var patch = { eventId: eventId, memberId: row.dataset.row };
          patch[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
          try {
            await Api.call('rosterUpdate', patch);
            // The kept copy (F134) takes the change too, so coming back shows it.
            (state.rosters[eventId] || []).forEach(function (r) { if (r.member_id === patch.memberId) r[el.dataset.f] = patch[el.dataset.f]; });
            Analytics.track('roster updated', { event_id: eventId, field: el.dataset.f });
            toast('Saved');
          } catch (err) { toast(err.message); }
        });
      });
    });
  }

  async function wireRoster(params) {
    var id = params.get('e');
    if (!find(id)) return;
    var rows = [];
    var load = function (r) { rows = r.rows; state.rosters[id] = rows; drawRoster(id, rows); };
    // A list opened before shows at once and the fresh one follows (F134), unless the leader is in
    // the middle of a field. The buttons work from the first draw.
    var kept = state.rosters[id];
    if (kept) { rows = kept; drawRoster(id, rows); }
    var fresh = Api.call('eventRoster', { eventId: id }).then(function (r) {
      if (!$('#roster')) return;
      var busy = $('#roster').contains(document.activeElement);
      if (!kept || (!busy && JSON.stringify(r.rows) !== JSON.stringify(rows))) load(r);
      else if (!busy) state.rosters[id] = rows = r.rows;
    }, function (err) { if (!kept && $('#roster')) $('#roster').innerHTML = '<div class="note warn">' + esc(err.message) + '</div>'; });
    if (!kept) await fresh;
    if (!$('#roster')) return;
    $('[data-groups]').addEventListener('click', async function (ev) {
      setBusy(ev.target, true, 'Making…');
      try {
        load(await Api.call('rosterGroups', { eventId: id }));
        Analytics.track('groups made', { event_id: id, people: rows.filter(function (r) { return r.status === 'going'; }).length });
        toast('Groups made');
      } catch (err) { toast(err.message); }
      setBusy(ev.target, false);
    });
    $('[data-copy]').addEventListener('click', function () {
      Analytics.track('names copied', { event_id: id });
      App.copyText(rows.filter(function (r) { return r.status === 'going'; }).map(function (r) { return r.name + (r.group ? ' (' + r.group + ')' : ''); }).join('\n'));
    });
    var add = $('[data-add]');
    if (add) add.addEventListener('click', async function () {
      var who = $('#addWho').value;
      if (!who) return;
      try {
        load(await Api.call('rosterAdd', { eventId: id, memberId: who }));
        Analytics.track('attendee added', { event_id: id });
        toast('Added');
      } catch (err) { toast(err.message); }
    });
  }

  App.route('events', { page: pageEvents, wire: drawList, member: true, onData: function () { if ($('#eventList')) drawList(); } });
  App.route('event', { page: pageEvent, wire: wireEvent, member: true, onData: function (params) { if ($('#eventBody') && find(params.get('e'))) { $('#eventBody').innerHTML = eventHtml(find(params.get('e'))); wireEvent(params); } } });
  App.route('event-edit', { page: pageEdit, wire: wireEdit, member: true });
  App.route('event-roster', { page: pageRoster, wire: wireRoster, member: true });
})();
;
// js/pages/board.js
// The board: jobs, opportunities, asks and resources. Searchable here, shared to WhatsApp in a tap.
(function () {
  var $ = App.$, $$ = App.$$, esc = App.esc, state = App.state, page = App.page, toast = App.toast, go = App.go, setBusy = App.setBusy, clearErrors = App.clearErrors, showErrors = App.showErrors, TIER_LABEL = Core.TIER_LABEL, cohortLabel = Core.cohortLabel;

  var PLURAL = { job: 'Jobs', opportunity: 'Opportunities', ask: 'Asks', resource: 'Resources', partner: 'From partners' };

  function pageBoard() {
    return page('<div class="page-head"><h1>Board</h1><span class="count" id="boardCount"></span><span class="spacer"></span><a class="link" href="post-edit">Post something</a></div>' +
      '<div class="search-row">' + App.icon('search') + '<label class="sr-only" for="boardQ">Search the board</label><input class="search" type="search" id="boardQ" aria-label="Search the board" placeholder="Search jobs, companies, anything" value="' + esc(state.board.q) + '" dir="auto" autocomplete="off"></div>' +
      '<div class="filters" id="boardKinds"></div><div id="boardList"></div>');
  }

  function postText(p) {
    return [p.title, p.company, p.location, p.body, Core.POST_KINDS[p.kind], p.author.name].join(' \n ').toLowerCase();
  }

  function postHtml(p) {
    var link = App.siteLink('board?p=' + p.id);
    var share = (Core.POST_KINDS[p.kind] || '') + ': ' + p.title + '\n' + link;
    var closed = p.status !== 'open' || p.expired;
    return '<article class="post" data-post="' + esc(p.id) + '" id="p-' + esc(p.id) + '"><div class="tags"><span class="tag">' + esc(Core.POST_KINDS[p.kind] || p.kind) + '</span>' +
      (p.status !== 'open' ? '<span class="tag unjoined">Closed</span>' : p.expired ? '<span class="tag unjoined">Expired</span>' : '') + '</div>' +
      '<h2 class="title ph-sensitive" dir="auto">' + esc(p.title) + '</h2>' +
      (p.company || p.location ? '<p class="muted ph-sensitive" dir="auto">' + esc([p.company, p.location].filter(Boolean).join(', ')) + '</p>' : '') +
      (p.body ? '<p class="details ph-sensitive" dir="auto">' + esc(p.body) + '</p>' : '') +
      (p.contact ? '<p dir="auto"><b>Contact:</b> <span class="ph-sensitive">' + esc(p.contact) + '</span></p>' : '') +
      '<p class="muted small">Posted by <a class="person-link" href="members?m=' + esc(p.author.id) + '" dir="auto">' + esc(p.author.name) + '</a> on ' + esc(Core.shortDate(new Date(p.created_at).toLocaleDateString('en-CA', { timeZone: Core.TIME_ZONE }))) + '</p>' +
      '<div class="row-actions">' + (p.link ? '<a class="btn quiet small" href="' + esc(p.link) + '" target="_blank" rel="noopener">Open the link</a>' : '') +
      '<a class="btn quiet small" href="' + esc(Core.whatsappUrl(share)) + '" target="_blank" rel="noopener" data-share>Share on WhatsApp</a>' +
      (p.can_edit ? '<a class="link" href="post-edit?p=' + esc(p.id) + '">Edit</a><button class="link" data-close-post>' + (closed ? 'Bring it back' : 'Close it') + '</button>' : '') + '</div></article>';
  }

  function drawBoard() {
    if (!$('#boardList')) return;
    var s = state.board;
    var posts = state.data.posts;
    var kinds = Object.keys(Core.POST_KINDS).filter(function (k) { return posts.some(function (p) { return p.kind === k; }); });
    $('#boardKinds').innerHTML = kinds.length > 1 ? '<button class="chip ' + (!s.kind ? 'on' : '') + '" data-kind="">All</button>' + kinds.map(function (k) {
      return '<button class="chip ' + (s.kind === k ? 'on' : '') + '" data-kind="' + k + '">' + esc(PLURAL[k] || k) + '</button>';
    }).join('') : '';
    var words = s.q.toLowerCase().split(/\s+/).filter(Boolean);
    var list = posts.filter(function (p) {
      if (s.kind && p.kind !== s.kind) return false;
      var text = postText(p);
      return words.every(function (w) { return text.indexOf(w) !== -1; });
    });
    $('#boardCount').textContent = list.length + (list.length === 1 ? ' post' : ' posts');
    $('#boardList').innerHTML = list.length ? list.map(postHtml).join('') : '<div class="empty">' + (posts.length ? 'Nothing matches. Try fewer words.' : 'Nothing here yet. Hiring, or looking for something? Post it, and share it to WhatsApp from here.') + '</div>';
    $$('[data-kind]').forEach(function (b) { b.addEventListener('click', function () { s.kind = b.dataset.kind; drawBoard(); }); });
    $$('[data-share]').forEach(function (a) {
      a.addEventListener('click', function () { Analytics.track('post shared', { post_id: a.closest('[data-post]').dataset.post }); });
    });
    $$('[data-close-post]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var id = b.closest('[data-post]').dataset.post;
        var p = state.data.posts.filter(function (x) { return x.id === id; })[0];
        setBusy(b, true, 'One moment…');
        try {
          var reopen = p.status !== 'open' || p.expired;
          var r = await Api.call('postClose', { id: id, reopen: reopen });
          Analytics.track(reopen ? 'post reopened' : 'post closed', { post_id: id, kind: p.kind });
          App.replaceItem('posts', r.post);
          drawBoard();
        } catch (err) { setBusy(b, false); toast(err.message); }
      });
    });
  }

  function wireBoard(params) {
    // Once someone stops typing: how many posts they found, never the words.
    $('#boardQ').addEventListener('input', function (e) {
      state.board.q = e.target.value;
      drawBoard();
      clearTimeout(wireBoard.timer);
      wireBoard.timer = setTimeout(function () {
        if (state.board.q.trim()) Analytics.track('board searched', { result_count: $$('[data-post]').length, kind: state.board.kind || 'all' });
      }, 800);
    });
    drawBoard();
    var target = params.get('p') && document.getElementById('p-' + params.get('p'));
    if (target) { target.scrollIntoView(); target.classList.add('hit'); return 'keep-scroll'; }
  }

  function pageEdit(params) {
    var id = params.get('p');
    var p = id ? state.data.posts.filter(function (x) { return x.id === id; })[0] : { kind: 'job', audience: 'all' };
    if (!p) return page('<div class="note warn">This post isn\'t here.</div>');
    var leader = state.me.tier === 'leader';
    var v = function (k) { return esc(p[k] || ''); };
    var kinds = Object.keys(Core.POST_KINDS).filter(function (k) { return Core.canPostKind(k, state.me.tier); });
    var cohorts = Array.from(new Set(state.data.directory.members.map(function (m) { return m.cohort; }).filter(Boolean))).sort();
    var audiences = leader ? [['all', 'Everyone'], ['club', 'Club'], ['community', 'Community']].concat(cohorts.map(function (c) { return ['cohort:' + c, cohortLabel(c)]; })) : [['all', 'Everyone'], [state.me.tier, TIER_LABEL[state.me.tier]]];
    return page('<p class="back"><a class="link" href="board">Back to the board</a></p><h1>' + (id ? 'Edit the post' : 'Post something') + '</h1>' +
      '<form class="form-grid form-narrow mt-3" id="postForm" novalidate>' +
      '<div class="form-row"><label>What is it<select name="kind">' + kinds.map(function (k) { return '<option value="' + k + '" ' + (p.kind === k ? 'selected' : '') + '>' + esc(Core.POST_KINDS[k]) + '</option>'; }).join('') + '</select></label>' +
      '<label>Who it\'s for<select name="audience">' + audiences.map(function (a) { return '<option value="' + esc(a[0]) + '" ' + (p.audience === a[0] ? 'selected' : '') + '>' + esc(a[1]) + '</option>'; }).join('') + '</select></label></div>' +
      '<label>Title<input type="text" name="title" value="' + v('title') + '" maxlength="120" required dir="auto"><span class="field-error" data-err="title"></span></label>' +
      '<div class="form-row"><label>Company <span class="hint">Optional</span><input type="text" name="company" value="' + v('company') + '" maxlength="60" dir="auto"><span class="field-error" data-err="company"></span></label>' +
      '<label>Where <span class="hint">Optional</span><input type="text" name="location" value="' + v('location') + '" maxlength="60" dir="auto"><span class="field-error" data-err="location"></span></label></div>' +
      '<label>Details<textarea name="body" rows="5" maxlength="2000" dir="auto">' + v('body') + '</textarea><span class="field-error" data-err="body"></span></label>' +
      '<label>Link <span class="hint">Optional</span><input type="url" name="link" value="' + v('link') + '" placeholder="https://..."><span class="field-error" data-err="link"></span></label>' +
      '<label>How to reach you <span class="hint">Optional. People can always find you through your profile</span><input type="text" name="contact" value="' + v('contact') + '" maxlength="120" dir="auto" placeholder="WhatsApp me for an intro"><span class="field-error" data-err="contact"></span></label>' +
      '<p class="muted small">Posts stay up for ' + Core.POST_DAYS + ' days. You can close one earlier, or bring it back.</p>' +
      '<div class="row-actions"><button class="btn gold" type="submit">Post it</button></div></form>');
  }

  function wireEdit(params) {
    var f = $('#postForm');
    if (!f) return;
    f.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      clearErrors(f);
      var input = {};
      new FormData(f).forEach(function (val, k) { input[k] = val; });
      if (params.get('p')) input.id = params.get('p');
      var check = Core.validatePost(input);
      if (!check.ok) return showErrors(f, { message: 'Some fields need fixing', fields: check.errors });
      var btn = $('button[type=submit]', f);
      setBusy(btn, true, 'Posting…');
      try {
        var r = await Api.call('postSave', { post: input });
        Analytics.track(input.id ? 'post updated' : 'post created', { post_id: r.post.id, kind: r.post.kind, audience: r.post.audience });
        App.replaceItem('posts', r.post);
        state.board.q = '';
        state.board.kind = '';
        toast('Posted');
        go('board');
      } catch (err) { setBusy(btn, false); showErrors(f, err); }
    });
  }

  // Leaders only for now, through the portal-board flag in PostHog: there are no job boards yet.
  App.route('board', { page: pageBoard, wire: wireBoard, member: true, onData: drawBoard, flag: 'portal-board' });
  App.route('post-edit', { page: pageEdit, wire: wireEdit, member: true, flag: 'portal-board' });
})();
;
// js/pages/admin.js
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
  var listing = false;

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

    // Everyone who left an email on Join while applications were closed, newest first, behind a
    // button beside Add people in Members (F144).
    var interested = data.interested || [];
    var interestHtml =
      '<section class="admin-section tool-drawer" id="s-interest"' + (listing ? '' : ' hidden') + '><h2>The list for the next cohort</h2>' +
      '<p class="muted measure">Everyone who left their email on Join while applications were closed. When the next cohort opens, send them the application link.</p>' +
      (interested.length ? '<div class="row-actions mt-2"><button class="btn quiet small" id="copyInterested">Copy the emails</button></div><div class="mt-2">' + interested.map(function (r) {
        return '<div class="request"><div><span class="ph-sensitive">' + esc(r.email) + '</span> <span class="muted small">' + esc(App.longDate(r.added_on)) + '</span></div></div>';
      }).join('') + '</div>' : '<p class="muted mt-2">Nobody yet.</p>') + '</section>';

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
      '<button class="btn quiet small" type="button" id="listToggle" aria-expanded="' + listing + '" aria-controls="s-interest">Next cohort list' + (interested.length ? ' <span class="badge">' + interested.length + '</span>' : '') + '</button>' +
      '<button class="btn gold small" type="button" id="addToggle" aria-expanded="' + adding + '" aria-controls="s-add">Add people</button></div>' +
      interestHtml +

      '<section class="admin-section tool-drawer" id="s-add"' + (adding ? '' : ' hidden') + '><h2>Add people</h2><div class="form-grid form-narrow">' +
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
    var ci = $('#copyInterested');
    if (ci) ci.addEventListener('click', function () { Analytics.track('next cohort list copied', { count: interested.length }); App.copyText(interested.map(function (r) { return r.email; }).join(', ')); });
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
    $('#listToggle').addEventListener('click', function (e) {
      listing = !listing;
      $('#s-interest').hidden = !listing;
      e.currentTarget.setAttribute('aria-expanded', String(listing));
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
;
// js/main.js
// Starts the site once every page has added itself.
App.start();
;
