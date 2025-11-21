// FFT data extraction and downsampling

import { PATTERN_BINS, NASALS } from '@/app/lib/constants';

export function getFrequencyData(analyser: AnalyserNode, dataArray: Uint8Array): void {
  analyser.getByteFrequencyData(dataArray as Uint8Array<ArrayBuffer>);
}

export function downsampleTo64Bins(fullData: Uint8Array): number[] {
  const pattern: number[] = [];
  const binSize = Math.floor(fullData.length / PATTERN_BINS);

  for (let i = 0; i < PATTERN_BINS; i++) {
    let sum = 0;
    const start = i * binSize;
    const end = Math.min(start + binSize, fullData.length);

    for (let j = start; j < end; j++) {
      sum += fullData[j];
    }

    pattern.push(sum / binSize);
  }

  return pattern;
}

export function normalizePattern(pattern: number[], letter: string): number[] {
  // Pre-amplify nasal sounds (m, n) before normalization
  let amplified = pattern;
  if (isNasal(letter)) {
    amplified = pattern.map(v => v * 2.0);
  }

  // Find max value
  const maxVal = Math.max(...amplified);

  // Normalize to 0-1 range
  if (maxVal > 0) {
    return amplified.map(v => v / maxVal);
  }

  return amplified;
}

export function calculateVolume(dataArray: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  return (sum / dataArray.length / 128) * 100;
}

export function calculateEnergyConcentration(pattern: number[]): number {
  const peakEnergy = Math.max(...pattern);
  const avgEnergy = pattern.reduce((a, b) => a + b, 0) / pattern.length;
  return avgEnergy > 0 ? peakEnergy / avgEnergy : 0;
}

export function isNasal(letter: string): boolean {
  return NASALS.includes(letter);
}

export function isPlosive(letter: string): boolean {
  const PLOSIVES = ['b', 'c', 'd', 'g', 'k', 'p', 't'];
  return PLOSIVES.includes(letter);
}
