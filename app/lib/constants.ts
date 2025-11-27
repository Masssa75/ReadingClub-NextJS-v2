// Constants for ReadingClub phonics system

export interface Phoneme {
  letter: string;
  hint: string;
  type: 'vowel' | 'plosive' | 'nasal' | 'fricative' | 'liquid';
  group: 'vowels' | 'easy' | 'common' | 'advanced';
  audioUrl?: string;
}

export const PHONEMES: Phoneme[] = [
  // Vowels
  { letter: 'a', hint: 'Say: aaa (like "apple")', type: 'vowel', group: 'vowels', audioUrl: '/audio/letters/a.mp3' },
  { letter: 'e', hint: 'Say: eee (like "egg")', type: 'vowel', group: 'vowels', audioUrl: '/audio/letters/e.mp3' },
  { letter: 'i', hint: 'Say: iii (like "igloo")', type: 'vowel', group: 'vowels', audioUrl: '/audio/letters/i.mp3' },
  { letter: 'o', hint: 'Say: ooo (like "octopus")', type: 'vowel', group: 'vowels', audioUrl: '/audio/letters/o.mp3' },
  { letter: 'u', hint: 'Say: uuu (like "umbrella")', type: 'vowel', group: 'vowels', audioUrl: '/audio/letters/u.mp3' },

  // Easy Consonants
  { letter: 'm', hint: 'Say: mmm (hum)', type: 'nasal', group: 'easy', audioUrl: '/audio/letters/m.mp3' },
  { letter: 's', hint: 'Say: sss (like "snake")', type: 'fricative', group: 'easy', audioUrl: '/audio/letters/s.mp3' },
  { letter: 't', hint: 'Repeat: tuh, tuh', type: 'plosive', group: 'easy', audioUrl: '/audio/letters/t.mp3' },
  { letter: 'b', hint: 'Repeat: buh, buh', type: 'plosive', group: 'easy', audioUrl: '/audio/letters/b.mp3' },
  { letter: 'f', hint: 'Say: fff (like "fan")', type: 'fricative', group: 'easy', audioUrl: '/audio/letters/f.mp3' },
  { letter: 'n', hint: 'Say: nnn (like "no")', type: 'nasal', group: 'easy', audioUrl: '/audio/letters/n.mp3' },

  // Common Consonants
  { letter: 'p', hint: 'Repeat: puh, puh', type: 'plosive', group: 'common', audioUrl: '/audio/letters/p.mp3' },
  { letter: 'd', hint: 'Repeat: duh, duh (like "dog")', type: 'plosive', group: 'common', audioUrl: '/audio/letters/d.mp3' },
  { letter: 'l', hint: 'Say: lll (like "lion")', type: 'liquid', group: 'common', audioUrl: '/audio/letters/l.mp3' },
  { letter: 'r', hint: 'Say: rrr (like "run")', type: 'liquid', group: 'common', audioUrl: '/audio/letters/r.mp3' },
  { letter: 'c', hint: 'Repeat: cuh, cuh (like "cat")', type: 'plosive', group: 'common', audioUrl: '/audio/letters/c.mp3' },
  { letter: 'g', hint: 'Repeat: guh, guh (like "go")', type: 'plosive', group: 'common', audioUrl: '/audio/letters/g.mp3' },
  { letter: 'h', hint: 'Say: hhh (like "hat")', type: 'fricative', group: 'common', audioUrl: '/audio/letters/h.mp3' },
  { letter: 'k', hint: 'Repeat: kuh, kuh (like "kite")', type: 'plosive', group: 'common', audioUrl: '/audio/letters/k.mp3' },
  { letter: 'w', hint: 'Say: www (like "water")', type: 'liquid', group: 'common', audioUrl: '/audio/letters/w.mp3' },

  // Advanced
  { letter: 'j', hint: 'Say: jjj (like "jump")', type: 'plosive', group: 'advanced', audioUrl: '/audio/letters/j.mp3' },
  { letter: 'v', hint: 'Say: vvv (like "van")', type: 'fricative', group: 'advanced', audioUrl: '/audio/letters/v.mp3' },
  { letter: 'y', hint: 'Say: yyy (like "yes")', type: 'liquid', group: 'advanced', audioUrl: '/audio/letters/y.mp3' },
  { letter: 'z', hint: 'Say: zzz (like "zebra")', type: 'fricative', group: 'advanced', audioUrl: '/audio/letters/z.mp3' },
  { letter: 'q', hint: 'Say: kww (like "queen")', type: 'plosive', group: 'advanced', audioUrl: '/audio/letters/q.mp3' },
  { letter: 'x', hint: 'Say: ksss (like "fox")', type: 'fricative', group: 'advanced', audioUrl: '/audio/letters/x.mp3' },
];

export const PLOSIVES = ['b', 'c', 'd', 'g', 'k', 'p', 't', 'j', 'q'];
export const NASALS = ['m', 'n'];
export const FRICATIVES = ['f', 's', 'v', 'z', 'h', 'x'];
export const LIQUIDS = ['l', 'r', 'w', 'y'];

// Audio engine constants
export const FFT_SIZE = 2048;
export const SMOOTHING = 0.5;
export const PATTERN_BINS = 64;
export const PATTERN_LENGTH = 30; // Sliding window size (frames)

// Peak detection constants
export const SNAPSHOTS_NEEDED = 5;
export const PEAK_COOLDOWN = 500; // ms

// Pattern matching constants
export const NEGATIVE_MARGIN = 3; // percent (positive wins close calls within 3%)
export const MATCH_THRESHOLD = 90; // percent (fixed for all letters)

// ========== PHASE 5: ADAPTIVE LEARNING CONSTANTS ==========

export const SESSION_CONFIG = {
  TIMEOUT_MINUTES: 30,
  GRADUATION_THRESHOLD: 10,              // 10 correct without LISTEN to graduate to KNOWN
  MAX_NEW_LETTERS_PER_SESSION: 3,
  GRADUATION_TEST_ATTEMPTS: 3,           // First 3 attempts next session
  GRADUATION_TEST_REQUIRED: 2,           // 2 of 3 must be correct for MASTERED
  MASTERED_DEMOTION_LISTEN_CLICKS: 2,
  KNOWN_DEMOTION_LISTEN_CLICKS: 1,
  RAPID_REP_COUNT: 3,                    // 3 reps after LISTEN click
  WARMUP_COUNT: 5,                       // First 5 letters are warmup
  MIX_RATIO_PRACTICING: 0.5,             // 50% practicing letters
} as const;
