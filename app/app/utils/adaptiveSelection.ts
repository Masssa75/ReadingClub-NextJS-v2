import type { SessionData, LetterStats } from '@/app/lib/types';
import { LetterProficiency } from '@/app/lib/types';
import { SESSION_CONFIG, PHONEMES } from '@/app/lib/constants';

/**
 * Phase 5: Adaptive Letter Selection Algorithm
 *
 * Selects the next letter based on:
 * - Current proficiency levels
 * - Session progress (warmup, rapid reps, mixed practice)
 * - Recent history (avoid repetition)
 * - Graduation limits (max 3 new UNKNOWN letters per session)
 */

interface LetterPools {
  mastered: string[];
  known: string[];
  sometimes: string[];
  unknown: string[];
}

/**
 * Group calibrated letters by proficiency level
 */
export function groupLettersByProficiency(
  proficiencies: Record<string, number>,
  calibratedLetters: string[]
): LetterPools {
  const pools: LetterPools = {
    mastered: [],
    known: [],
    sometimes: [],
    unknown: [],
  };

  calibratedLetters.forEach((letter) => {
    const proficiency = proficiencies[letter] ?? LetterProficiency.UNKNOWN;

    switch (proficiency) {
      case LetterProficiency.MASTERED:
        pools.mastered.push(letter);
        break;
      case LetterProficiency.KNOWN:
        pools.known.push(letter);
        break;
      case LetterProficiency.SOMETIMES:
        pools.sometimes.push(letter);
        break;
      default:
        pools.unknown.push(letter);
    }
  });

  return pools;
}

/**
 * Select random letter from pool, avoiding recent history
 */
export function selectRandomLetter(pool: string[], recentHistory: string[] = []): string | null {
  if (!pool || pool.length === 0) return null;

  // Filter out recently seen letters
  const available = pool.filter((l) => !recentHistory.includes(l));

  if (available.length === 0) {
    // All letters in pool were recent, pick anyway
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Select warmup letter (first 5 attempts)
 * Prefers MASTERED/KNOWN letters for confidence building
 */
export function selectWarmupLetter(
  pools: LetterPools,
  recentHistory: string[],
  calibratedLetters: string[],
  session: SessionData
): string | null {
  // Give them letters they know (MASTERED or KNOWN)
  const comfortableLetters = [...pools.mastered, ...pools.known];

  let selectedLetter: string | null;
  if (comfortableLetters.length === 0) {
    // All letters are new, pick random calibrated letter
    selectedLetter = selectRandomLetter(calibratedLetters, recentHistory);
  } else {
    // Prefer MASTERED over KNOWN (2:1 ratio)
    if (pools.mastered.length > 0 && Math.random() < 0.67) {
      selectedLetter = selectRandomLetter(pools.mastered, recentHistory);
    } else {
      selectedLetter = selectRandomLetter(comfortableLetters, recentHistory);
    }
  }

  // Add to newLettersIntroduced if not already there
  if (selectedLetter && !session.newLettersIntroduced.includes(selectedLetter)) {
    session.newLettersIntroduced.push(selectedLetter);
    console.log(`🔥 Warmup introduced: ${selectedLetter}`);
  }

  return selectedLetter;
}

/**
 * Introduce a new UNKNOWN letter
 * Max 3 UNKNOWN letters per session (graduated letters free up slots)
 */
export function introduceNewLetter(pools: LetterPools, session: SessionData): string | null {
  // Only enforce limit on UNKNOWN letters that haven't graduated yet
  const currentUnknownCount = session.unknownLettersIntroduced?.length || 0;

  if (currentUnknownCount >= SESSION_CONFIG.MAX_NEW_LETTERS_PER_SESSION) {
    console.log(`⚠️ Max UNKNOWN letters (${SESSION_CONFIG.MAX_NEW_LETTERS_PER_SESSION}) reached this session`);
    return null;
  }

  // Pick from UNKNOWN or SOMETIMES pool
  const newLetterPool = pools.unknown.length > 0 ? pools.unknown : pools.sometimes;

  if (newLetterPool.length === 0) {
    console.log('✅ No new letters available - all letters practiced!');
    return null;
  }

  // Filter out already introduced letters
  const available = newLetterPool.filter((l) => !session.newLettersIntroduced.includes(l));

  if (available.length === 0) {
    return null;
  }

  // Select first available letter following PHONEMES curriculum order (vowels → easy → common → advanced)
  const newLetter = PHONEMES.map((p) => p.letter).find((letter) => available.includes(letter)) || null;

  if (!newLetter) return null;

  session.newLettersIntroduced.push(newLetter);

  // Track as unknown letter (counts toward 3-letter limit)
  if (!session.unknownLettersIntroduced) {
    session.unknownLettersIntroduced = [];
  }
  session.unknownLettersIntroduced.push(newLetter);

  console.log(
    `🆕 Introduced new UNKNOWN letter: ${newLetter} (${currentUnknownCount + 1}/${SESSION_CONFIG.MAX_NEW_LETTERS_PER_SESSION} unknown)`
  );
  return newLetter;
}

/**
 * Select letter for mixed practice phase
 * 50% practicing letters, 50% comfortable letters
 */
export function selectMixedPracticeLetter(
  pools: LetterPools,
  session: SessionData,
  recentHistory: string[]
): string | null {
  // Get currently practicing letters (introduced but not graduated)
  const practicingLetters = session.newLettersIntroduced.filter(
    (letter) => !session.lettersGraduated.includes(letter)
  );

  if (practicingLetters.length === 0) {
    // No letters in practice, try to introduce new one
    const newLetter = introduceNewLetter(pools, session);
    if (newLetter) {
      return newLetter;
    }

    // Can't introduce new letter (max reached or none available)
    // Fall back to comfortable letters for review
    const comfortableLetters = [...pools.mastered, ...pools.known];
    if (comfortableLetters.length > 0) {
      console.log('📚 Reviewing comfortable letters (max new letters reached)');
      return selectRandomLetter(comfortableLetters, recentHistory);
    }

    // No letters available at all - should rarely happen
    console.warn('⚠️ No letters available for practice');
    return null;
  }

  // 50% chance: practicing letter
  // 50% chance: comfortable letter (known/mastered)
  const rand = Math.random();

  if (rand < SESSION_CONFIG.MIX_RATIO_PRACTICING) {
    return selectRandomLetter(practicingLetters, recentHistory);
  } else {
    const comfortableLetters = [...pools.mastered, ...pools.known];

    if (comfortableLetters.length === 0) {
      // No comfortable letters, stick with practicing
      return selectRandomLetter(practicingLetters, recentHistory);
    }

    return selectRandomLetter(comfortableLetters, recentHistory);
  }
}

/**
 * Main adaptive selection function
 * Coordinates all selection strategies based on session phase
 */
export function selectNextLetter(
  session: SessionData | null,
  proficiencies: Record<string, number>,
  calibratedLetters: string[]
): string | null {
  if (!session) {
    console.error('❌ No active session for adaptive selection');
    return null;
  }

  if (calibratedLetters.length === 0) {
    console.warn('⚠️ No calibrated letters yet');
    return null;
  }

  // Group letters by proficiency
  const pools = groupLettersByProficiency(proficiencies, calibratedLetters);

  console.log('📊 Pools:', {
    mastered: pools.mastered.length,
    known: pools.known.length,
    sometimes: pools.sometimes.length,
    unknown: pools.unknown.length,
  });

  const attemptCount = session.attempts.length;
  const recentHistory = session.recentHistory || [];

  // Phase 1: Warmup (first 5 attempts)
  if (attemptCount < SESSION_CONFIG.WARMUP_COUNT) {
    console.log(`🔥 Warmup phase (${attemptCount + 1}/${SESSION_CONFIG.WARMUP_COUNT})`);
    return selectWarmupLetter(pools, recentHistory, calibratedLetters, session);
  }

  // Phase 2: Check if we need rapid reinforcement (letter with remaining rapid reps)
  if (session.attempts.length > 0) {
    // Check all letters to see if any are in rapid reinforcement mode
    for (const [letter, stats] of session.letterStats) {
      if (stats.rapid_reps_remaining > 0) {
        const repsCompleted = SESSION_CONFIG.RAPID_REP_COUNT - stats.rapid_reps_remaining + 1;
        console.log(`🔁 Rapid reinforcement: ${letter} (${repsCompleted}/${SESSION_CONFIG.RAPID_REP_COUNT})`);
        return letter;
      }
    }
  }

  // Phase 3: Mixed practice or introduce new letter
  const selected = selectMixedPracticeLetter(pools, session, recentHistory);

  return selected;
}
