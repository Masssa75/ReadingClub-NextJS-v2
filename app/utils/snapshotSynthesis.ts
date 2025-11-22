// Snapshot audio synthesis from frequency spectrum
// Converts 64-bin frequency data back to audible sound

import { FFT_SIZE } from '@/app/lib/constants';

/**
 * Synthesizes audio from a snapshot's frequency spectrum using additive synthesis
 * @param snapshotBins - Array of 64 normalized frequency magnitudes (0-1 range)
 * @param duration - How long to play the sound in seconds (default 1.5s)
 * @returns Promise that resolves when audio finishes playing
 */
export async function synthesizeSnapshot(
  snapshotBins: number[],
  duration: number = 1.5
): Promise<void> {
  // Create audio context
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextClass();

  const sampleRate = audioContext.sampleRate;
  const nyquistFreq = sampleRate / 2; // Maximum frequency we can represent

  // Calculate frequency spacing for our 64 bins
  // Each bin represents a range of frequencies from the original FFT
  const freqPerBin = nyquistFreq / snapshotBins.length;

  // Create master gain for overall volume control
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 0.3; // Reduce overall volume to prevent clipping
  masterGain.connect(audioContext.destination);

  // Create oscillators for each bin with significant energy
  const oscillators: OscillatorNode[] = [];
  const gains: GainNode[] = [];

  snapshotBins.forEach((magnitude, binIndex) => {
    // Skip bins with very low energy (below 5% threshold)
    if (magnitude < 0.05) return;

    // Calculate center frequency for this bin
    const centerFreq = (binIndex + 0.5) * freqPerBin;

    // Skip frequencies above human hearing range
    if (centerFreq > 20000) return;

    // Create oscillator
    const osc = audioContext.createOscillator();
    osc.type = 'sine'; // Pure sine wave for each frequency component
    osc.frequency.value = centerFreq;

    // Create gain node for this oscillator
    const gainNode = audioContext.createGain();
    gainNode.gain.value = magnitude; // Use bin magnitude as amplitude

    // Connect: oscillator → gain → master gain
    osc.connect(gainNode);
    gainNode.connect(masterGain);

    oscillators.push(osc);
    gains.push(gainNode);
  });

  console.log(`🎵 Synthesizing snapshot with ${oscillators.length} oscillators`);

  // Start all oscillators
  const startTime = audioContext.currentTime;
  oscillators.forEach(osc => osc.start(startTime));

  // Fade out at the end to prevent clicking
  const fadeOutTime = 0.05; // 50ms fade
  masterGain.gain.setValueAtTime(0.3, startTime + duration - fadeOutTime);
  masterGain.gain.linearRampToValueAtTime(0, startTime + duration);

  // Stop all oscillators after duration
  oscillators.forEach(osc => osc.stop(startTime + duration));

  // Return promise that resolves when sound finishes
  return new Promise(resolve => {
    setTimeout(() => {
      audioContext.close();
      resolve();
    }, duration * 1000 + 100); // Add 100ms buffer
  });
}

/**
 * Stop any currently playing synthesis (if needed for future control)
 */
export function stopSynthesis(audioContext: AudioContext): void {
  audioContext.close();
}
