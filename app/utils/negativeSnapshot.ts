import type { CalibrationData } from '@/app/lib/types';
import { debounceSaveScores, saveSnapshotScoresImmediately } from './snapshotScoring';

/**
 * Add a negative snapshot to a letter's calibration data
 * Used to mark patterns that should NOT match this letter
 */
export async function addNegativePattern(
  letter: string,
  currentPattern: number[],
  profileId: string,
  calibrationData: Record<string, CalibrationData>,
  audioUrl?: string,
  immediate?: boolean
): Promise<{ success: boolean; message: string }> {
  // Normalize letter to lowercase for consistent key access
  const normalizedLetter = letter.toLowerCase();

  if (!currentPattern || currentPattern.length === 0) {
    console.error('Cannot add negative pattern: no current pattern');
    return { success: false, message: 'No current pattern to save' };
  }

  if (!calibrationData[normalizedLetter]) {
    console.error('Cannot add negative pattern: no calibration for letter', normalizedLetter);
    return { success: false, message: `No calibration found for letter ${normalizedLetter}` };
  }

  // CRITICAL FIX: Normalize pattern to 0-1 range (same as pattern matching does)
  const maxValue = Math.max(...currentPattern);
  const normalizedPattern = maxValue > 0
    ? currentPattern.map(v => v / maxValue)
    : currentPattern;

  console.log(`🔧 Normalizing negative snapshot: max=${maxValue.toFixed(2)} → normalized to 0-1 range`);

  // Create negative snapshot
  const newSnapshot = {
    data: normalizedPattern,
    score: 0,
    isNegative: true,
    profileId: profileId,
    createdAt: new Date().toISOString(),
    ...(audioUrl && { audio_url: audioUrl }) // Add audio URL if provided
  };

  // Add to calibrationData
  if (!calibrationData[normalizedLetter].snapshots) {
    calibrationData[normalizedLetter].snapshots = [];
  }
  calibrationData[normalizedLetter].snapshots.push(newSnapshot);

  const negativeCount = calibrationData[normalizedLetter].snapshots.filter(s => s.isNegative).length;
  console.log(`✗ Added negative pattern to ${normalizedLetter} (total: ${negativeCount})`);
  console.log(`  Pattern preview:`, currentPattern.slice(0, 5));

  // Save to Supabase (immediate or debounced)
  if (immediate) {
    await saveSnapshotScoresImmediately(normalizedLetter, profileId, calibrationData);
    console.log(`💾 Immediately saved snapshot to Supabase`);
  } else {
    debounceSaveScores(normalizedLetter, profileId);
  }

  return {
    success: true,
    message: `Added negative example for '${normalizedLetter}' (${negativeCount} total)`
  };
}
