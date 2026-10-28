// Everything a leader might want to change on the public pages lives here.
// Edit the text between the quotes, commit, and the site updates on its own.
var CONTENT = {
  tagline: 'An invite-only community of Reichman graduate students and alumni, for people who do, not just talk.',

  club: 'A hand-picked cohort each semester, up to 50 people, meeting for curated sessions with founders, operators and investors.',
  community: 'Everyone who has been through a cohort, for life: dinners, low-key meetups, and a directory of who can help with what.',
  giveFirst: 'Give first.',
  giveFirstRest: 'Intros, advice, jobs. You get out of the club what you put in.',

  nextMeeting: {
    day: '24',
    month: 'November',
    title: 'Meeting 1, hosted by Playtika',
    note: 'Members RSVP in the WhatsApp event.'
  },

  applyUrl: 'https://forms.gle/umgLKBHcCzH7N6uS8',

  // Leave empty to hide the "Talk to us" button on the Partners page.
  partnerEmail: '',

  leaders: [
    { name: 'Michael Kishon', role: 'Founder, club lead' },
    { name: 'Noy', role: 'Club lead' },
    { name: 'Dor Bitton', role: 'Club lead' },
    { name: 'Maor Kaufman', role: 'Community lead' },
    { name: 'Omri Bitan', role: 'Community lead' },
    { name: 'Daniel Danilov', role: 'Community lead' }
  ],

  partners: [
    { name: 'Playtika', note: 'Hosts meetings 1 and 3 of Cohort 2', initial: 'P' }
  ],

  // Draft tiers, still to be agreed by the leaders.
  partnerTiersNote: 'Draft tiers, open for discussion.',
  partnerTiers: [
    { name: 'Partner', price: '₪10,000', detail: 'Logo on the site and event materials, and a session with the cohort.' },
    { name: 'Gold partner', price: '₪20,000', detail: 'Everything in Partner, plus hosting a meeting and a members spotlight.' },
    { name: 'Diamond partner', price: '₪35,000+', detail: 'Everything in Gold for three years, plus a recruiting session.' }
  ],

  // Add an invite link to show a button; leave it empty to show "ask a leader".
  whatsappGroups: [
    { name: 'Announcements', url: '' },
    { name: 'Jobs and opportunities', url: '' },
    { name: 'Community lounge', url: '' }
  ]
};
