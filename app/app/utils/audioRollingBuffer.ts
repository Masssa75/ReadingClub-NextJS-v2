// Audio rolling buffer for capturing sound onset (300ms before peak)
// Maintains a circular buffer of raw audio samples

export interface AudioBufferCapture {
  startBuffering: () => void;
  stopBuffering: () => void;
  captureOnPeak: () => Promise<Blob | null>;
  isBuffering: boolean;
}

const SAMPLE_RATE = 44100; // Standard sample rate
const BUFFER_DURATION_MS = 300; // Keep last 300ms
const POST_PEAK_DURATION_MS = 700; // Record 700ms after peak
const BUFFER_SIZE = Math.floor((SAMPLE_RATE * BUFFER_DURATION_MS) / 1000);

/**
 * Create an audio rolling buffer that continuously captures the last 300ms
 * When triggered, it returns: buffer (300ms before peak) + new recording (700ms after peak)
 */
export function createAudioRollingBuffer(stream: MediaStream): AudioBufferCapture {
  let audioContext: AudioContext | null = null;
  let sourceNode: MediaStreamAudioSourceNode | null = null;
  let processorNode: ScriptProcessorNode | null = null;
  const circularBuffer: Float32Array = new Float32Array(BUFFER_SIZE);
  let writeIndex = 0;
  let isActive = false;
  let isCapturing = false;
  let captureData: Float32Array[] = [];
  let captureStartTime = 0;

  const startBuffering = () => {
    if (isActive) return;

    // Create audio context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    sourceNode = audioContext.createMediaStreamSource(stream);

    // Create processor node (buffer size 4096 gives us ~93ms chunks at 44.1kHz)
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // If we're capturing post-peak audio, collect it
      if (isCapturing) {
        captureData.push(new Float32Array(inputData));

        // Check if we've captured enough (700ms)
        const capturedDuration = (captureData.reduce((sum, arr) => sum + arr.length, 0) / SAMPLE_RATE) * 1000;
        if (capturedDuration >= POST_PEAK_DURATION_MS) {
          isCapturing = false;
        }
        return;
      }

      // Otherwise, update circular buffer (keep last 300ms)
      for (let i = 0; i < inputData.length; i++) {
        circularBuffer[writeIndex] = inputData[i];
        writeIndex = (writeIndex + 1) % BUFFER_SIZE;
      }
    };

    // Connect nodes
    sourceNode.connect(processorNode);
    processorNode.connect(audioContext.destination);
    isActive = true;
  };

  const stopBuffering = () => {
    if (processorNode) {
      processorNode.disconnect();
      processorNode = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    isActive = false;
    isCapturing = false;
  };

  const captureOnPeak = async (): Promise<Blob | null> => {
    if (!isActive || isCapturing) {
      console.warn('Cannot capture: buffer not active or already capturing');
      return null;
    }

    // Start capturing post-peak audio
    isCapturing = true;
    captureData = [];
    captureStartTime = Date.now();

    // Wait for 700ms of post-peak audio to be captured
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!isCapturing || Date.now() - captureStartTime > POST_PEAK_DURATION_MS + 200) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);
    });

    // Combine circular buffer (onset) + captured data (post-peak)
    const onsetBuffer = extractCircularBuffer();
    const postPeakSamples = captureData.reduce((sum, arr) => sum + arr.length, 0);
    const totalSamples = BUFFER_SIZE + postPeakSamples;
    const combinedData = new Float32Array(totalSamples);

    // Copy onset (300ms from circular buffer)
    combinedData.set(onsetBuffer, 0);

    // Copy post-peak (700ms)
    let offset = BUFFER_SIZE;
    for (const chunk of captureData) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to WAV blob
    const blob = createWavBlob(combinedData, SAMPLE_RATE);

    console.log(`🎤 Captured audio: ${BUFFER_DURATION_MS}ms onset + ${POST_PEAK_DURATION_MS}ms post-peak = ${((combinedData.length / SAMPLE_RATE) * 1000).toFixed(0)}ms total`);

    return blob;
  };

  // Extract data from circular buffer in correct order
  const extractCircularBuffer = (): Float32Array => {
    const result = new Float32Array(BUFFER_SIZE);

    // Copy from writeIndex to end
    const firstPartLength = BUFFER_SIZE - writeIndex;
    result.set(circularBuffer.subarray(writeIndex, BUFFER_SIZE), 0);

    // Copy from start to writeIndex
    result.set(circularBuffer.subarray(0, writeIndex), firstPartLength);

    return result;
  };

  return {
    startBuffering,
    stopBuffering,
    captureOnPeak,
    get isBuffering() { return isActive; }
  };
}

/**
 * Convert Float32Array audio samples to WAV blob
 */
function createWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
