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

  // Photos are built from assets/leaders by tools/build-images.sh.
  leaders: [
    { name: 'Michael Kishon', role: 'Founder, club lead', photo: 'img/leaders/michael-kishon.jpg' },
    { name: 'Noy Swissa Segal', role: 'Club lead', photo: 'img/leaders/noy-swissa-segal.jpg' },
    { name: 'Dor Bitton', role: 'Club lead', photo: 'img/leaders/dor-bitton.jpg' },
    { name: 'Maor Kaufman', role: 'Community lead', photo: 'img/leaders/maor-kaufman.jpg' },
    { name: 'Omri Bitan', role: 'Community lead', photo: 'img/leaders/omri-bitan.jpg' },
    { name: 'Daniel Danilov', role: 'Community lead', photo: 'img/leaders/daniel-danilov.jpg' }
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
