// Public settings for the live site. None of these is a secret: the API URL, the Google client ID
// and PostHog's project key are visible to every visitor by design. The dev server serves its own
// version, without a PostHog key, so analytics stays off there and in the tests.
var CONFIG = {
  ENV: 'production',
  API_URL: 'https://script.google.com/macros/s/AKfycbyKf_Ke5gL88X_mHAFAokBOvxhlAa49UszOg0rtiHOI2W_FPg25e9MPsAMkMf331M5g/exec',
  GOOGLE_CLIENT_ID: '680230021841-d7mdkckgdtlh6k7a6dhihtkef8u93jej.apps.googleusercontent.com',
  DEV_SIGNIN: false,
  // The club's own PostHog project (720681, US Cloud). See docs/02-architecture.md, "Analytics".
  POSTHOG_KEY: 'phc_rvT8pQoFLGEBPBc4WC8JUz9F5jkyqQA3eVqGmJMSDsie',
  POSTHOG_HOST: 'https://us.i.posthog.com'
};
