// Web Audio API setup and microphone management

import type { AudioEngineState } from '@/app/lib/types';
import { FFT_SIZE, SMOOTHING } from '@/app/lib/constants';

// Detect iOS Chrome (uses WebKit but has microphone permission issues)
function isIOSChrome(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /CriOS/.test(ua);
}

// Detect iOS Safari
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
}

export async function setupAudio(): Promise<AudioEngineState> {
  const setupStart = Date.now();
  console.log('🎤 Setting up audio...');
  console.log('📱 User Agent:', navigator.userAgent);
  console.log('📱 iOS Chrome:', isIOSChrome());
  console.log('📱 iOS Safari:', isIOSSafari());

  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone not supported on this browser. Please use Safari on iOS.');
    }

    // Create audio context
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    // Request microphone access with explicit constraints for iOS
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    };

    console.log('🎤 Requesting microphone with constraints:', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

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
  } catch (err: any) {
    console.error('❌ Audio setup error:', err);
    console.error('❌ Error name:', err?.name);
    console.error('❌ Error message:', err?.message);

    // Provide helpful error messages based on the error type and browser
    if (isIOSChrome()) {
      // Chrome on iOS has known microphone permission issues
      throw new Error('Chrome on iPhone doesn\'t support microphone well. Please open this page in Safari instead.');
    } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      // User denied permission or it was previously denied
      throw new Error('Microphone access denied. Check your browser settings to allow microphone for this site.');
    } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.');
    } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
      throw new Error('Microphone is in use by another app. Please close other apps using the microphone.');
    } else {
      throw new Error('Microphone access denied');
    }
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
