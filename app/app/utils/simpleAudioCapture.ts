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
  let currentRecordingPromise: Promise<Blob | null> | null = null;
  let lastRecordingEndTime = 0;

  const captureAudio = (): Promise<Blob | null> => {
    if (isRecording && currentRecordingPromise) {
      console.warn('⚠️ Already recording, waiting for it to finish...');
      return currentRecordingPromise;
    }

    // Prevent starting a new recording too soon after the last one ended
    const timeSinceLastRecording = Date.now() - lastRecordingEndTime;
    if (timeSinceLastRecording < 500) {
      console.warn(`⚠️ Too soon after last recording (${timeSinceLastRecording}ms), waiting...`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(captureAudio());
        }, 500 - timeSinceLastRecording);
      });
    }

    currentRecordingPromise = new Promise((resolve) => {
      try {
        isRecording = true;
        const chunks: Blob[] = [];

        // Create MediaRecorder with supported format
        // Check formats in order of preference, with Safari iOS compatibility
        let mimeType = '';
        const formats = [
          'audio/webm;codecs=opus',  // Modern browsers + recent Safari
          'audio/webm',              // Chrome, Firefox
          'audio/mp4',               // Safari iOS preference
          'audio/aac',               // Safari fallback
          'audio/ogg;codecs=opus',   // Firefox
          'audio/ogg'                // Old Firefox
        ];

        for (const format of formats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mimeType = format;
            console.log(`📱 Using audio format: ${format}`);
            break;
          }
        }

        if (!mimeType) {
          console.warn('⚠️ No supported mime type found, using browser default');
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
            console.log(`📊 Chunk received: ${event.data.size} bytes (total: ${chunks.length} chunks)`);
          } else {
            console.warn('⚠️ Received empty data chunk');
          }
        };

        recorder.onstop = () => {
          isRecording = false;
          currentRecordingPromise = null;
          lastRecordingEndTime = Date.now();
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
          currentRecordingPromise = null;
          lastRecordingEndTime = Date.now();
          resolve(null);
        };

        // Start recording with timeslice to ensure data collection
        // Safari requires timeslice to reliably trigger ondataavailable
        recorder.start(100);  // Collect data every 100ms
        console.log(`🎤 Started recording... (${mimeType || 'browser default'})`);

        // Stop after 1 second
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 1000);

      } catch (error) {
        console.error('❌ Error creating MediaRecorder:', error);
        isRecording = false;
        currentRecordingPromise = null;
        resolve(null);
      }
    });

    return currentRecordingPromise;
  };

  return {
    captureAudio,
    get isRecording() { return isRecording; }
  };
}
