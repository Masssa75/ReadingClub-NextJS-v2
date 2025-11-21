// Web Audio API setup and microphone management

import type { AudioEngineState } from '@/app/lib/types';
import { FFT_SIZE, SMOOTHING } from '@/app/lib/constants';

export async function setupAudio(): Promise<AudioEngineState> {
  const setupStart = Date.now();
  console.log('🎤 Setting up audio...');

  try {
    // Create audio context
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create analyser node
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE; // 2048 → 1024 frequency bins
    analyser.smoothingTimeConstant = SMOOTHING; // 0.5

    // Create microphone source
    const microphone = audioContext.createMediaStreamSource(stream);

    // Create data array for frequency data
    const bufferLength = analyser.frequencyBinCount; // 2048 bins
    const dataArray = new Uint8Array(bufferLength);

    // Connect microphone to analyser (no output to speakers)
    microphone.connect(analyser);

    const totalTime = Date.now() - setupStart;
    console.log(`✅ Audio setup complete in ${totalTime}ms`);

    return {
      audioContext,
      analyser,
      microphone,
      dataArray,
      stream
    };
  } catch (err) {
    console.error('❌ Audio setup error:', err);
    throw new Error('Microphone access denied');
  }
}

export function stopAudio(state: AudioEngineState): void {
  console.log('🛑 Stopping audio...');

  // Stop media stream
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
  }

  // Disconnect microphone
  if (state.microphone) {
    state.microphone.disconnect();
  }

  // Close audio context (only if not already closed)
  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.close();
  }

  console.log('✅ Audio stopped');
}
