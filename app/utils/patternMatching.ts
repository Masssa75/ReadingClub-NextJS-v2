// S11-Snapshot pattern matching strategy

import type { Snapshot, CalibrationData, MatchInfo, MatchResult } from '@/app/lib/types';
import { NEGATIVE_MARGIN, MATCH_THRESHOLD } from '@/app/lib/constants';

let lastMatchInfo: MatchInfo | null = null;

export function getLastMatchInfo(): MatchInfo | null {
  return lastMatchInfo;
}

export function compareSnapshots(current: number[], stored: number[]): number {
  // Calculate L1 distance (sum of absolute differences)
  let totalDistance = 0;
  const minLength = Math.min(current.length, stored.length);

  for (let i = 0; i < minLength; i++) {
    totalDistance += Math.abs(current[i] - stored[i]);
  }

  // Convert distance to similarity score (0-100)
  const avgDistance = totalDistance / minLength;
  const similarity = Math.max(0, 100 - (avgDistance * 100));

  return similarity;
}

export function testPattern(
  patternBuffer: number[][],
  target: string,
  calibrationData: Record<string, CalibrationData>
): MatchResult {
  // Normalize target to lowercase for consistent key access
  const normalizedTarget = target.toLowerCase();

  if (!calibrationData[normalizedTarget]) {
    return { score: 0, predictedLetter: '?', targetScore: 0 };
  }

  // Find peak moment in buffer (highest energy frame)
  const energies = patternBuffer.map(frame => frame.reduce((a, b) => a + b, 0));
  const currentPeakIdx = energies.indexOf(Math.max(...energies));
  let currentSnapshot = patternBuffer[currentPeakIdx];

  // Normalize current snapshot to 0-1 range
  const maxCurrent = Math.max(...currentSnapshot);
  if (maxCurrent > 0) {
    currentSnapshot = currentSnapshot.map(v => v / maxCurrent);
  }

  let bestLetter: string | null = null;
  let bestScore = 0;
  let targetScore = 0;

  // Test against all calibrated letters
  Object.keys(calibrationData).forEach(letter => {
    const score = matchAgainstLetter(currentSnapshot, letter, calibrationData);
    if (score > bestScore) {
      bestScore = score;
      bestLetter = letter;
    }
    if (letter === normalizedTarget) {
      targetScore = score;
    }
  });

  return {
    score: bestScore,
    predictedLetter: bestLetter || '?',
    targetScore: targetScore
  };
}

export function matchAgainstLetter(
  currentSnapshot: number[],
  letter: string,
  calibrationData: Record<string, CalibrationData>
): number {
  if (!calibrationData[letter] || !calibrationData[letter].snapshots) {
    return 0;
  }

  const snapshots = calibrationData[letter].snapshots;
  let bestPositiveScore = 0;
  let bestPositiveSnapshot: Snapshot | null = null;
  let bestNegativeScore = 0;
  let bestNegativeSnapshot: Snapshot | null = null;

  // Test against ALL snapshots (both positive and negative)
  snapshots.forEach((snapshot) => {
    if (!snapshot || !snapshot.data) return;

    const similarity = compareSnapshots(currentSnapshot, snapshot.data);

    // Track best positive and negative separately
    if (snapshot.isNegative) {
      if (similarity > bestNegativeScore) {
        bestNegativeScore = similarity;
        bestNegativeSnapshot = snapshot;
      }
    } else {
      if (similarity > bestPositiveScore) {
        bestPositiveScore = similarity;
        bestPositiveSnapshot = snapshot;
      }
    }
  });

  // Store match info globally for highlighting and score tracking
  lastMatchInfo = {
    target: letter,
    positiveSnapshot: bestPositiveSnapshot,
    positiveScore: bestPositiveScore,
    negativeSnapshot: bestNegativeSnapshot,
    negativeScore: bestNegativeScore,
    matchType: null
  };

  // Reject if negative is SIGNIFICANTLY stronger (5% margin)
  if (bestNegativeScore > bestPositiveScore + NEGATIVE_MARGIN) {
    const diff = bestNegativeScore - bestPositiveScore;
    console.log(`❌ REJECTED: Negative (${bestNegativeScore.toFixed(1)}%) beats positive (${bestPositiveScore.toFixed(1)}%) by ${diff.toFixed(1)}%`);
    lastMatchInfo.matchType = 'rejected';

    // Note: Snapshot scoring logic will be added in Phase 3
    return 0; // Reject completely
  }

  // ACCEPTED: Positive match wins
  if (bestNegativeScore > 0) {
    const diff = bestPositiveScore - bestNegativeScore;
    console.log(`✅ ACCEPTED: Positive (${bestPositiveScore.toFixed(1)}%) beats negative (${bestNegativeScore.toFixed(1)}%) by ${diff.toFixed(1)}%`);
  } else {
    console.log(`✅ ACCEPTED: Positive match (${bestPositiveScore.toFixed(1)}%), no negatives`);
  }

  lastMatchInfo.matchType = 'accepted';
  return bestPositiveScore;
}

export function isMatchAccepted(
  score: number,
  predictedLetter: string,
  targetLetter: string
): boolean {
  return predictedLetter === targetLetter && score > MATCH_THRESHOLD;
}

// Snapshot scoring functions (will be expanded in Phase 3)
export function incrementSnapshotScore(
  letter: string,
  snapshot: Snapshot,
  calibrationData: Record<string, CalibrationData>
): void {
  if (!snapshot || !calibrationData[letter] || !calibrationData[letter].snapshots) {
    console.log('❌ incrementSnapshotScore: Missing data');
    return;
  }

  // Find snapshot in calibrationData by reference or data comparison
  let snapshotIndex = calibrationData[letter].snapshots.indexOf(snapshot);

  // Second try: Match by data content if direct reference fails
  if (snapshotIndex === -1) {
    snapshotIndex = calibrationData[letter].snapshots.findIndex(s => {
      if (!s.data || !snapshot.data) return false;
      if (s.data.length !== snapshot.data.length) return false;

      // Compare first few values to confirm it's the same pattern
      return s.data.slice(0, 10).every((val, i) => Math.abs(val - snapshot.data[i]) < 0.0001);
    });
  }

  if (snapshotIndex !== -1) {
    const foundSnapshot = calibrationData[letter].snapshots[snapshotIndex];
    foundSnapshot.score = (foundSnapshot.score || 0) + 1;
    console.log(`📊 Snapshot score incremented: ${letter} [${foundSnapshot.isNegative ? 'NEG' : 'POS'}] → ${foundSnapshot.score}`);

    // Supabase persistence will be added in Phase 3
  } else {
    console.error(`❌ Could not find matching snapshot in calibrationData for ${letter}`);
  }
}

// Export alias for backward compatibility with Phase 6 Play tab
export const strategy11_simpleSnapshot = testPattern;
