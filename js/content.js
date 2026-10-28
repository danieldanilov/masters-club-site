// Everything a leader might want to change on the public pages lives here.
// Edit the text between the quotes, commit, and the site updates on its own.
var CONTENT = {
  tagline: 'An invite-only community of Reichman graduate students and alumni. For people who do, not just talk.',
  established: 'Reichman University · Est. 2025',

  stats: [
    { value: '2', label: 'cohorts a year' },
    { value: '50', label: 'members per cohort, at most' },
    { value: 'For life', label: 'in the community after your cohort' }
  ],

  nextMeeting: {
    title: 'Meeting 1 · 24 November · hosted by Playtika',
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
    { name: 'Playtika', note: 'Hosts meetings 1 and 3 of Cohort 2026-27', initial: 'P', color: '#7b2cbf' }
  ],

  // Placeholder tiers to discuss with the leaders.
  partnerTiers: [
    { name: 'Partner', price: '₪10,000', detail: 'Logo on the site and event materials, a session with the cohort' },
    { name: 'Gold partner', price: '₪20,000', detail: 'Everything in Partner, plus hosting a meeting and a members spotlight' },
    { name: 'Diamond partner', price: '₪35,000+', detail: 'Everything in Gold, for three years, plus a recruiting session' }
  ],

  // Add an invite link to show a button; leave it empty to show "ask a leader".
  whatsappGroups: [
    { name: '📣 Announcements', url: '' },
    { name: '💼 Jobs & opportunities', url: '' },
    { name: '🍷 Community lounge', url: '' }
  ]
};
