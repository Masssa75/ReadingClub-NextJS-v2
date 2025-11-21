// Simple audio capture using MediaRecorder
// Records 1 second of audio on demand

export interface SimpleAudioCapture {
  captureAudio: () => Promise<Blob | null>;
  isRecording: boolean;
}

/**
 * Create a simple audio capture that records 1 second on demand
 * More reliable than ScriptProcessorNode approach
 */
export function createSimpleAudioCapture(stream: MediaStream): SimpleAudioCapture {
  let isRecording = false;

  const captureAudio = (): Promise<Blob | null> => {
    if (isRecording) {
      console.warn('⚠️ Already recording, skipping');
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      try {
        isRecording = true;
        const chunks: Blob[] = [];

        // Create MediaRecorder with supported format
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg';

        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = () => {
          isRecording = false;
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: mimeType });
            console.log(`🎤 Audio captured: ${blob.size} bytes (${mimeType})`);
            resolve(blob);
          } else {
            console.warn('⚠️ No audio chunks recorded');
            resolve(null);
          }
        };

        recorder.onerror = (error) => {
          console.error('❌ MediaRecorder error:', error);
          isRecording = false;
          resolve(null);
        };

        // Start recording
        recorder.start();
        console.log('🎤 Started recording...');

        // Stop after 1 second
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 1000);

      } catch (error) {
        console.error('❌ Error creating MediaRecorder:', error);
        isRecording = false;
        resolve(null);
      }
    });
  };

  return {
    captureAudio,
    get isRecording() { return isRecording; }
  };
}
