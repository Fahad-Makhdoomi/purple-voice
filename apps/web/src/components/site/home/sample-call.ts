/**
 * The sample call on the home page: one recording (public/audio/sample-call)
 * and the transcript timed against it. The audio was voiced with ElevenLabs
 * and passed through a phone line (8 kHz μ-law, band-limited, line hiss), so
 * it sounds the way a recording in the Calls tab does. If you re-record it,
 * update the times here: each line's start and end are seconds into the file.
 */
export const SAMPLE_CALL = {
  src: '/audio/sample-call/ava-dana.mp3',
  duration: 50.33,
  /** The callee picks up here; before it, the line is ringing. */
  answeredAt: 5.58,
  agent: { name: 'Ava', company: 'Northwind Solar' },
  lead: { name: 'Dana R.', phone: '+1 (415) ••• 0142' },
  lines: [
    {
      who: 'ai',
      start: 6.13,
      end: 14.15,
      text: 'Hi, is this Dana? … Hi Dana, it’s Ava from Northwind Solar. You asked us for a quote on your roof yesterday — have you got a quick minute?',
    },
    {
      who: 'lead',
      start: 14.6,
      end: 19.45,
      text: 'Oh — yeah, sure, quickly. What would it actually cost for a four-bedroom house?',
    },
    {
      who: 'ai',
      start: 20.05,
      end: 31.43,
      text: 'Good question. Most homes your size land somewhere between $14k and $19k after the tax credit. For an exact number, one of our energy advisors needs about twenty minutes with you.',
    },
    { who: 'lead', start: 31.93, end: 35.01, text: 'Hmm, okay. Can we do Tuesday morning?' },
    {
      who: 'ai',
      start: 35.56,
      end: 39.92,
      text: 'Tuesday at 10:30 is open. Shall I book that and email you the invite?',
    },
    { who: 'lead', start: 40.32, end: 41.64, text: 'Yeah, yes please.' },
    {
      who: 'ai',
      start: 42.14,
      end: 46.49,
      text: 'Done — you’ll have the invite in a minute. Thanks, Dana, have a great day!',
    },
    { who: 'lead', start: 46.84, end: 48.65, text: 'Thanks, you too. Bye.' },
  ] as Array<{ who: 'ai' | 'lead'; start: number; end: number; text: string }>,
  /** Loudness of the recording in 120 equal slices (0–1), for the waveform. */
  peaks: [
    0.181, 0.362, 0.363, 0.36, 0.358, 0.247, 0.0, 0.0, 0.0, 0.295, 0.362, 0.363, 0.28, 0.084, 0.165,
    0.654, 0.625, 0.524, 0.034, 0.624, 0.762, 0.619, 0.836, 0.381, 0.515, 0.111, 0.637, 0.443,
    0.639, 0.361, 0.391, 0.326, 0.56, 0.366, 0.282, 0.5, 0.661, 0.64, 0.522, 0.025, 0.5, 0.396,
    0.488, 0.678, 0.649, 0.343, 0.048, 0.103, 0.575, 0.345, 0.163, 0.627, 0.527, 0.615, 0.21, 0.367,
    0.329, 0.289, 0.411, 0.47, 0.51, 0.376, 0.265, 0.281, 0.024, 0.735, 0.638, 0.502, 0.716, 0.502,
    0.549, 0.449, 0.328, 0.221, 0.152, 0.016, 0.126, 0.076, 0.144, 0.051, 0.342, 0.287, 0.653,
    0.183, 0.034, 1.0, 0.446, 0.896, 0.416, 0.055, 0.919, 0.837, 0.571, 0.66, 0.57, 0.102, 0.623,
    0.503, 0.556, 0.049, 0.657, 0.326, 0.808, 0.664, 0.708, 0.393, 0.752, 0.806, 0.609, 0.646,
    0.648, 0.328, 0.327, 0.565, 0.331, 0.684, 0.118, 0.168, 0.149, 0.126,
  ],
  outcome: {
    title: 'Meeting booked',
    detail: 'Tue 10:30 with an energy advisor · invite emailed · lead scored Hot',
  },
};

/** Fired on window to start the sample call from anywhere on the page (the hero). */
export const PLAY_SAMPLE_EVENT = 'pv:play-sample-call';
