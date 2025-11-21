import type { CalibrationData } from '@/app/lib/types';
import { debounceSaveScores } from './snapshotScoring';

/**
 * Add a positive snapshot to a letter's calibration data
 * Used when user successfully matches a letter
 */
export function addPositivePattern(
  letter: string,
  currentPattern: number[],
  profileId: string,
  calibrationData: Record<string, CalibrationData>,
  audioUrl?: string
): { success: boolean; message: string } {
  // Normalize letter to lowercase for consistent key access
  const normalizedLetter = letter.toLowerCase();

  if (!currentPattern || currentPattern.length === 0) {
    console.error('Cannot add positive pattern: no current pattern');
    return { success: false, message: 'No current pattern to save' };
  }

  if (!calibrationData[normalizedLetter]) {
    console.error('Cannot add positive pattern: no calibration for letter', normalizedLetter);
    return { success: false, message: `No calibration found for letter ${normalizedLetter}` };
  }

  // Create positive snapshot
  const newSnapshot = {
    data: currentPattern,
    score: 1, // Start with score of 1 (this match)
    isNegative: false,
    profileId: profileId,
    createdAt: new Date().toISOString(),
    ...(audioUrl && { audio_url: audioUrl }) // Add audio URL if provided
  };

  // Add to calibrationData
  if (!calibrationData[normalizedLetter].snapshots) {
    calibrationData[normalizedLetter].snapshots = [];
  }
  calibrationData[normalizedLetter].snapshots.push(newSnapshot);

  const positiveCount = calibrationData[normalizedLetter].snapshots.filter(s => !s.isNegative).length;
  console.log(`✓ Added positive pattern to ${normalizedLetter} (total: ${positiveCount})`);
  console.log(`  Pattern preview:`, currentPattern.slice(0, 5));
  if (audioUrl) {
    console.log(`  Audio URL:`, audioUrl);
  }

  // Save to Supabase (debounced)
  debounceSaveScores(normalizedLetter, profileId);

  return {
    success: true,
    message: `Added positive example for '${normalizedLetter}' (${positiveCount} total)`
  };
}
