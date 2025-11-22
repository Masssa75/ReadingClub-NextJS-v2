import { supabase } from '@/app/lib/supabase';
import type { CalibrationData, Snapshot } from '@/app/lib/types';

// Track which negative snapshots already got points this round (per letter display)
let currentScoringRound: {
  letter: string | null;
  negativeSnapshotsAwarded: Set<Snapshot>;
} = {
  letter: null,
  negativeSnapshotsAwarded: new Set()
};

// Debounce timers and pending saves
let saveScoreTimers: Record<string, NodeJS.Timeout> = {};
const pendingSaves = new Set<string>();
const pendingData: Record<string, Record<string, CalibrationData>> = {}; // Store data for each pending save

// Store reference to calibrationData for debounced saves
let calibrationDataRef: Record<string, CalibrationData> | null = null;

/**
 * Set the calibrationData reference (call this when calibrationData is loaded/updated)
 */
export function setCalibrationDataRef(data: Record<string, CalibrationData>): void {
  calibrationDataRef = data;
}

/**
 * Increment score for a snapshot (in memory)
 * Finds the snapshot in calibrationData and increments its score
 */
export function incrementSnapshotScore(
  letter: string,
  snapshot: Snapshot,
  calibrationData: Record<string, CalibrationData>
): void {
  // Normalize letter to lowercase for consistent key access
  const normalizedLetter = letter.toLowerCase();

  if (!snapshot || !calibrationData[normalizedLetter] || !calibrationData[normalizedLetter].snapshots) {
    console.log('❌ incrementSnapshotScore: Missing data', {
      letter,
      normalizedLetter,
      hasSnapshot: !!snapshot,
      hasCalibrationData: !!calibrationData[normalizedLetter],
      hasSnapshots: !!calibrationData[normalizedLetter]?.snapshots,
      availableLetters: Object.keys(calibrationData).join(', ')
    });
    return;
  }

  console.log('🔍 incrementSnapshotScore called:', {
    letter: normalizedLetter,
    hasSnapshotData: !!snapshot.data,
    snapshotDataLength: snapshot.data?.length,
    snapshotProfileId: snapshot.profileId?.substring(0, 8),
    totalSnapshotsInMemory: calibrationData[normalizedLetter].snapshots.length
  });

  // First try: Direct object reference lookup (fastest)
  let snapshotIndex = calibrationData[normalizedLetter].snapshots.indexOf(snapshot);

  // Second try: Match by data content if direct reference fails
  if (snapshotIndex === -1) {
    console.log('⚠️ Direct object reference failed, trying data comparison...');
    snapshotIndex = calibrationData[normalizedLetter].snapshots.findIndex(s => {
      // Match by comparing the actual pattern data
      if (!s.data || !snapshot.data) return false;
      if (s.data.length !== snapshot.data.length) return false;

      // Compare first 10 values to confirm it's the same pattern
      const matches = s.data.slice(0, 10).every((val, i) => Math.abs(val - snapshot.data[i]) < 0.0001);
      return matches;
    });
  }

  if (snapshotIndex !== -1) {
    const foundSnapshot = calibrationData[normalizedLetter].snapshots[snapshotIndex];
    foundSnapshot.score = (foundSnapshot.score || 0) + 1;
    console.log(
      `📊 Snapshot score incremented: ${normalizedLetter} [${foundSnapshot.isNegative ? 'NEG' : 'POS'}] → ${foundSnapshot.score} (profile: ${foundSnapshot.profileId?.substring(0, 8)}...)`
    );

    // Persist to Supabase (debounced to avoid too many DB calls)
    debounceSaveScores(normalizedLetter, foundSnapshot.profileId);
  } else {
    console.error(`❌ Could not find matching snapshot in calibrationData for ${normalizedLetter}`);
  }
}

/**
 * Debounce score saves to avoid hammering the database
 * Saves 2 seconds after last score change
 */
export function debounceSaveScores(letter: string, profileId: string): void {
  const key = `${letter}_${profileId}`;
  pendingSaves.add(key); // Mark as needing save

  // Capture current calibrationData reference for this save
  if (calibrationDataRef) {
    pendingData[key] = calibrationDataRef;
  }

  if (saveScoreTimers[key]) {
    clearTimeout(saveScoreTimers[key]);
  }

  saveScoreTimers[key] = setTimeout(() => {
    // Use the captured data for this specific save
    const dataToSave = pendingData[key];
    saveSnapshotScoresToSupabase(letter, profileId, dataToSave);
    pendingSaves.delete(key); // Remove from pending after save
    delete pendingData[key]; // Clean up stored data
  }, 2000); // Save 2 seconds after last score change
}

/**
 * Immediately flush all pending score saves
 * Called on letter change or page unload
 */
export async function flushAllPendingScores(
  calibrationData: Record<string, CalibrationData>
): Promise<void> {
  const saves = Array.from(pendingSaves).map(key => {
    const [letter, ...profileIdParts] = key.split('_');
    const profileId = profileIdParts.join('_'); // Handle UUIDs with underscores
    return { letter, profileId };
  });

  if (saves.length === 0) return;

  console.log(`🔄 Flushing ${saves.length} pending score save(s)...`);

  // Clear all timers
  Object.values(saveScoreTimers).forEach(timer => clearTimeout(timer));
  saveScoreTimers = {};

  // Save all immediately
  await Promise.all(
    saves.map(({ letter, profileId }) =>
      saveSnapshotScoresToSupabase(letter, profileId, calibrationData)
    )
  );

  pendingSaves.clear();
  // Clear pending data storage
  Object.keys(pendingData).forEach(key => delete pendingData[key]);
  console.log('✅ All pending scores flushed');
}

/**
 * Save snapshot scores immediately (no debounce)
 * Use this for manual snapshot additions where immediate save is required
 */
export async function saveSnapshotScoresImmediately(
  letter: string,
  profileId: string,
  calibrationData: Record<string, CalibrationData>
): Promise<void> {
  return saveSnapshotScoresToSupabase(letter, profileId, calibrationData);
}

/**
 * Save snapshot scores back to Supabase
 * Updates pattern_data for the given letter and profile
 */
async function saveSnapshotScoresToSupabase(
  letter: string,
  profileId: string,
  calibrationData?: Record<string, CalibrationData>
): Promise<void> {
  // Normalize letter to lowercase for consistent key access
  const normalizedLetter = letter.toLowerCase();

  // Use provided calibrationData or fall back to stored reference
  const data = calibrationData || calibrationDataRef;

  if (!data || !data[normalizedLetter] || !data[normalizedLetter].snapshots) {
    console.warn(`⚠️ Cannot save scores: no calibration data for ${normalizedLetter}`);
    return;
  }

  try {
    // Get all snapshots for this letter from this profile
    const profileSnapshots = data[normalizedLetter].snapshots.filter(
      s => s.profileId === profileId
    );
    if (profileSnapshots.length === 0) return;

    // Build the pattern_data object with updated scores
    const patternData = {
      snapshots: profileSnapshots
    };

    // Upsert in Supabase (create if doesn't exist, update if it does)
    const { error } = await supabase
      .from('calibrations')
      .upsert({
        profile_id: profileId,
        letter: normalizedLetter,
        pattern_data: patternData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'profile_id,letter'
      });

    if (error) {
      console.error(`❌ Error saving scores for ${normalizedLetter}:`, error);
    } else {
      console.log(`💾 Saved snapshot scores to Supabase: ${normalizedLetter} (${profileSnapshots.length} snapshots)`);
    }
  } catch (error) {
    console.error(`❌ Error in saveSnapshotScoresToSupabase:`, error);
  }
}

/**
 * Reset round tracking when letter changes
 * Flushes pending scores from previous letter
 */
export async function startNewScoringRound(
  letter: string,
  calibrationData: Record<string, CalibrationData>
): Promise<void> {
  // Flush any pending scores from previous letter
  await flushAllPendingScores(calibrationData);

  currentScoringRound = {
    letter: letter,
    negativeSnapshotsAwarded: new Set()
  };
}

/**
 * Check if negative snapshot can get a point this round
 */
export function canAwardNegativePoint(snapshot: Snapshot): boolean {
  return !currentScoringRound.negativeSnapshotsAwarded.has(snapshot);
}

/**
 * Mark negative snapshot as awarded for this round
 */
export function markNegativeSnapshotAwarded(snapshot: Snapshot): void {
  currentScoringRound.negativeSnapshotsAwarded.add(snapshot);
}
