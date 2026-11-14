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

  // Where the club is online and its contact email. They show in the footer of every page and on
  // Home.
  social: {
    instagram: 'https://www.instagram.com/the_masters_club/',
    linkedin: 'https://www.linkedin.com/company/111716473/',
    email: 'mastersclub.runi@gmail.com'
  },

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
