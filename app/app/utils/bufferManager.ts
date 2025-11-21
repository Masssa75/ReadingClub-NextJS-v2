// 30-frame sliding window pattern buffer

import { PATTERN_LENGTH } from '@/app/lib/constants';

let patternBuffer: number[][] = [];

export function updateBuffer(newFrame: number[]): number[][] {
  patternBuffer.push(newFrame);

  // Keep buffer at PATTERN_LENGTH (30 frames)
  if (patternBuffer.length > PATTERN_LENGTH) {
    patternBuffer.shift();
  }

  return patternBuffer;
}

export function getBuffer(): number[][] {
  return patternBuffer;
}

export function getBufferLength(): number {
  return patternBuffer.length;
}

export function isBufferReady(): boolean {
  return patternBuffer.length === PATTERN_LENGTH;
}

export function clearBuffer(): void {
  patternBuffer = [];
}
