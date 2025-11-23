// Volume peak detection for snapshot capture

import { PEAK_COOLDOWN, NASALS, FRICATIVES, LIQUIDS } from '@/app/lib/constants';

export { PEAK_COOLDOWN };

export function getVolumeThreshold(letter: string): number {
  if (isNasal(letter)) return 1.5;
  if (LIQUIDS.includes(letter)) return 4.5;
  return 11;
}

export function getConcentrationThreshold(letter: string): number {
  const isCurrentNasal = isNasal(letter);
  const isFricative = FRICATIVES.includes(letter);
  const isLiquid = LIQUIDS.includes(letter);

  if (isCurrentNasal) {
    return 1.2; // Lowest for nasals (m, n)
  } else if (isLiquid) {
    return 1.0; // Lower for liquids (l, r, w, y)
  } else if (isFricative) {
    return 1.8; // Lower concentration for fricatives (f, s, v, z, h)
  } else {
    return 2.0; // Default for other letters
  }
}

export function isPeakDetected(
  volume: number,
  concentration: number,
  letter: string,
  lastPeakTime: number
): boolean {
  const volumeThreshold = getVolumeThreshold(letter);
  const concentrationThreshold = getConcentrationThreshold(letter);
  const now = Date.now();

  return (
    volume > volumeThreshold &&
    concentration > concentrationThreshold &&
    (now - lastPeakTime) > PEAK_COOLDOWN
  );
}

function isNasal(letter: string): boolean {
  return NASALS.includes(letter);
}
