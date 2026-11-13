// Analytics, all in one place: the rest of the site calls Analytics.track(), identify(), reset(),
// error() and flag(), and only this file knows it's PostHog. It's off unless CONFIG has a PostHog
// key and this is the live site or staging, so the dev server and every test send nothing. Staging
// has its own PostHog project, and stays off while its key is empty (docs/07-setup.md).
// What's tracked and how to add an event: docs/02-architecture.md, "Analytics".
var Analytics = (function () {
  var on = !!(typeof CONFIG !== 'undefined' && CONFIG.POSTHOG_KEY && (CONFIG.ENV === 'production' || CONFIG.ENV === 'staging'));
  // The flag override's key, with the environment's prefix like every stored key (F92).
  var PREFIX = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE_PREFIX) || '';
  var FLAGS_KEY = PREFIX + 'mc-flags-v1';

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

  // The settings, kept apart so the tests can read them.
  var options = {
    api_host: on ? CONFIG.POSTHOG_HOST : '',
    defaults: '2026-08-30',
    // Only signed-in members get a person profile; visitors stay anonymous.
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
    before_send: scrub
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

  /* ---------- what the site calls ---------- */

  return {
    on: on,
    options: options,
    scrub: scrub,
    maskRequest: maskRequest,

    // An event named "object verb", lowercase, past tense: "post created". Properties are ids,
    // counts, choices and yes/no only, never what someone typed.
    track: function (name, props) {
      if (ph()) posthog.capture(name, props || {});
    },

    // A signed-in member, by their stable id from the Members tab.
    identify: function (me) {
      if (!ph() || !me || !me.id) return;
      posthog.identify(me.id, { name: me.name, email: me.email, tier: me.tier, cohort: me.cohort });
    },

    // Signing out: the next person on this browser starts anonymous.
    reset: function () {
      if (ph()) posthog.reset();
    },

    // An error the site caught itself, so it still shows in error tracking.
    error: function (e, props) {
      if (ph()) posthog.captureException(e, props || {});
    },

    // A feature flag: true, false, or a variant name. Until PostHog's flags arrive it's false, so
    // a flagged thing starts hidden and never flashes in for someone it's off for. Off the live
    // site every flag is off, unless the override in localStorage (FLAGS_KEY: mc-flags-v1, or
    // stg-mc-flags-v1 on staging) turns it on for local work and the tests: {"portal-board": true}.
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
