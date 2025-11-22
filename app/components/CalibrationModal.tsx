'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, normalizePattern, calculateVolume, calculateEnergyConcentration, isNasal } from '@/app/utils/fftAnalysis';
import { supabase } from '@/app/lib/supabase';
import { PHONEMES } from '@/app/lib/constants';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { createSimpleAudioCapture, type SimpleAudioCapture } from '@/app/utils/simpleAudioCapture';
import { uploadSnapshotAudio } from '@/app/utils/snapshotAudioUpload';

interface CalibrationModalProps {
  letter: string;
  onClose: () => void;
  onSuccess: (letter: string) => void;
  variant?: 'admin' | 'kid';
}

type RecordingState = 'idle' | 'ready' | 'recording' | 'captured';

// Snapshot Card Component
function SnapshotCard({
  snapshot,
  index,
  onPlay,
  onDelete,
  styles
}: {
  snapshot: any;
  index: number;
  onPlay: (url: string) => void;
  onDelete: (index: number) => void;
  styles: any;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Log snapshot data for debugging
    console.log(`Snapshot #${index + 1}:`, {
      hasData: !!snapshot.data,
      hasAudioUrl: !!snapshot.audio_url,
      audioUrl: snapshot.audio_url,
      dataLength: snapshot.data?.length
    });

    // Draw waveform pattern
    if (canvasRef.current && snapshot.data) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / snapshot.data.length;
      for (let j = 0; j < snapshot.data.length; j++) {
        const barHeight = snapshot.data[j] * canvas.height;
        const x = j * barWidth;
        const y = canvas.height - barHeight;

        ctx.fillStyle = '#7CB342';
        ctx.fillRect(x, y, barWidth - 1, barHeight);
      }
    }
  }, [snapshot.data, snapshot.audio_url, index]);

  return (
    <div className="relative">
      {/* Waveform Box */}
      <div className={`w-[140px] h-[100px] border-2 rounded-[10px] ${styles.captureBox} ${styles.captureBoxCaptured} relative overflow-hidden`}>
        <canvas
          ref={canvasRef}
          width={140}
          height={100}
          className="w-full h-full"
        />

        {/* Play Button - Always visible if audio exists, or show "No Audio" badge */}
        {snapshot.audio_url ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('🎵 Playing snapshot audio:', snapshot.audio_url);
              onPlay(snapshot.audio_url);
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95 z-10"
            style={{ touchAction: 'manipulation' }}
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 fill-white ml-1">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        ) : (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 bg-gray-500/80 text-white text-xs rounded-full shadow-lg">
            No Audio
          </div>
        )}
      </div>

      {/* Delete Button - Top Right Corner */}
      <button
        onClick={() => onDelete(index)}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg transition-all hover:scale-110"
      >
        ✕
      </button>

      {/* Label */}
      <div className={`text-center ${styles.text} text-xs mt-1`}>
        #{index + 1}
      </div>
    </div>
  );
}

export default function CalibrationModal({ letter, onClose, onSuccess, variant = 'admin' }: CalibrationModalProps) {
  const { currentProfileId } = useProfileContext();
  const [statusMessage, setStatusMessage] = useState('Click letter to hear sound, then click microphone');
  const [showArrow, setShowArrow] = useState(true);
  const [recordingState, setRecordingState] = useState<RecordingState>('ready');
  const [existingSnapshotCount, setExistingSnapshotCount] = useState(0);
  const [existingSnapshots, setExistingSnapshots] = useState<any[]>([]);

  const audioStateRef = useRef<AudioEngineState | null>(null);
  const audioCaptureRef = useRef<SimpleAudioCapture | null>(null);
  const capturedPatternRef = useRef<number[] | null>(null);
  const capturedAudioRef = useRef<Blob | null>(null);
  const isListeningRef = useRef<boolean>(false);
  const isRecordingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPeakTimeRef = useRef<number>(0);
  const [volume, setVolume] = useState(0);
  const [concentration, setConcentration] = useState(0);

  useEffect(() => {
    initAudio();
    checkExistingCalibration();

    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Scroll to top of page when modal opens
    window.scrollTo(0, 0);

    return () => {
      cleanup();
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkExistingCalibration = async () => {
    if (!currentProfileId) return;

    try {
      const { data } = await supabase
        .from('calibrations')
        .select('pattern_data')
        .eq('profile_id', currentProfileId)
        .eq('letter', letter)
        .single();

      if (data?.pattern_data?.snapshots) {
        const snapshots = data.pattern_data.snapshots;
        const count = snapshots.length;
        setExistingSnapshotCount(count);
        setExistingSnapshots(snapshots);
        setStatusMessage(`Adding calibration #${count + 1} for "${letter}". Click microphone to record.`);
      }
    } catch (error) {
      // No existing calibration, that's fine
      console.log('No existing calibration found (will create new)');
    }
  };

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioStateRef.current) {
      stopAudio(audioStateRef.current);
    }
  }, []);

  const initAudio = async () => {
    try {
      const audioState = await setupAudio();
      audioStateRef.current = audioState;

      // Setup audio capture
      if (audioState.stream) {
        audioCaptureRef.current = createSimpleAudioCapture(audioState.stream);
        console.log('🎤 Audio capture ready');
      }

      startVisualization();
    } catch (err) {
      console.error('Failed to setup audio:', err);
      setStatusMessage('❌ Microphone access denied');
    }
  };

  const startVisualization = () => {
    const PEAK_COOLDOWN = 500;

    const visualize = () => {
      animationFrameRef.current = requestAnimationFrame(visualize);

      if (!audioStateRef.current?.analyser || !audioStateRef.current?.dataArray) return;

      getFrequencyData(audioStateRef.current.analyser, audioStateRef.current.dataArray);

      const vol = calculateVolume(audioStateRef.current.dataArray);
      const downsampled = downsampleTo64Bins(audioStateRef.current.dataArray);
      const conc = calculateEnergyConcentration(downsampled);

      // Update volume/concentration meters
      setVolume(vol);
      setConcentration(conc);

      // Draw live pattern continuously during recording (use REF not state!)
      if (isRecordingRef.current) {
        const normalized = normalizePattern(downsampled, letter);
        drawPattern(normalized);
      }

      // Listen for peak if actively recording
      if (isListeningRef.current && isRecordingRef.current) {
        const volumeThreshold = isNasal(letter) ? 3 : 12;
        const concentrationThreshold = isNasal(letter) ? 1.2 : 2.0;

        const now = Date.now();
        if (vol > volumeThreshold &&
            conc > concentrationThreshold &&
            (now - lastPeakTimeRef.current) > PEAK_COOLDOWN) {

          const normalized = normalizePattern(downsampled, letter);
          capturedPatternRef.current = normalized;
          lastPeakTimeRef.current = now;

          console.log(`📸 Captured snapshot for ${letter}`);

          // Final snapshot already drawn above, just capture audio

          // Stop listening for more peaks immediately
          isListeningRef.current = false;
          setStatusMessage('Processing audio...');

          // Capture audio (records 1 second starting NOW)
          if (audioCaptureRef.current && !audioCaptureRef.current.isRecording) {
            audioCaptureRef.current.captureAudio().then(blob => {
              if (blob) {
                capturedAudioRef.current = blob;
                console.log('🎤 Audio captured:', blob.size, 'bytes');

                // NOW set to captured state (audio is ready!)
                isRecordingRef.current = false;
                setRecordingState('captured');
                setStatusMessage('✅ Captured! Play it back or try again');
              } else {
                // Audio capture failed
                console.error('❌ Audio capture failed');
                isRecordingRef.current = false;
                setRecordingState('ready');
                setStatusMessage('❌ Audio capture failed. Try again.');
              }
            }).catch(error => {
              // Handle any errors from captureAudio
              console.error('❌ Error capturing audio:', error);
              isRecordingRef.current = false;
              setRecordingState('ready');
              setStatusMessage('❌ Audio capture error. Try again.');
            });
          } else {
            // No audio capture available
            console.error('❌ No audio capture available');
            isRecordingRef.current = false;
            setRecordingState('ready');
            setStatusMessage('❌ No audio capture. Try again.');
          }
        }
      }
    };
    visualize();
  };

  const drawPattern = (pattern: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / pattern.length;
    for (let j = 0; j < pattern.length; j++) {
      const barHeight = pattern[j] * canvas.height;
      const x = j * barWidth;
      const y = canvas.height - barHeight;

      ctx.fillStyle = '#7CB342';
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  };

  const handleMicClick = () => {
    // Already listening
    if (isListeningRef.current) return;
    if (isRecordingRef.current) return;

    // Hide arrow once user starts
    setShowArrow(false);

    isRecordingRef.current = true;
    setRecordingState('recording');
    setStatusMessage(`Recording... Get ready...`);

    // Wait 400ms to avoid click sound, THEN start listening
    setTimeout(() => {
      isListeningRef.current = true;
      setStatusMessage(`Recording... Say "${letter}" NOW!`);
    }, 400);
  };

  const handleTryAgain = () => {
    // Clear captured data
    capturedPatternRef.current = null;
    capturedAudioRef.current = null;
    isListeningRef.current = false;
    isRecordingRef.current = false;
    setRecordingState('ready');
    setStatusMessage('Click microphone to record again');

    // Clear canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  const handlePlayback = () => {
    if (!capturedAudioRef.current) {
      console.error('No audio to play');
      return;
    }

    // Create audio from blob and play
    const audioUrl = URL.createObjectURL(capturedAudioRef.current);
    const audio = new Audio(audioUrl);
    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
    });

    // Clean up URL after playing
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
    };
  };

  const handleDeleteSnapshot = async (index: number) => {
    if (!currentProfileId) return;

    try {
      // Remove snapshot from array
      const updatedSnapshots = existingSnapshots.filter((_, i) => i !== index);
      setExistingSnapshots(updatedSnapshots);
      setExistingSnapshotCount(updatedSnapshots.length);

      // Update in database
      const patternData = {
        snapshots: updatedSnapshots
      };

      const { error } = await supabase
        .from('calibrations')
        .update({
          pattern_data: patternData,
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', currentProfileId)
        .eq('letter', letter);

      if (error) throw error;

      console.log(`✅ Deleted snapshot #${index + 1} for letter ${letter}`);
    } catch (error) {
      console.error('❌ Error deleting snapshot:', error);
    }
  };

  const handlePlayExistingSnapshot = (audioUrl: string) => {
    console.log('🎵 Attempting to play audio:', audioUrl);
    console.log('📱 User agent:', navigator.userAgent);

    if (!audioUrl) {
      console.error('❌ No audio URL provided');
      setStatusMessage('❌ No audio URL found');
      return;
    }

    // For Safari iOS: Create audio element early and set attributes before loading
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';  // Enable CORS
    audio.preload = 'auto';

    audio.onloadstart = () => {
      console.log('🎵 Audio loading started...', {
        src: audioUrl,
        srcLength: audioUrl.length
      });
      setStatusMessage('Loading audio...');
    };

    audio.onloadedmetadata = () => {
      const info = {
        duration: audio.duration,
        volume: audio.volume,
        muted: audio.muted,
        networkState: audio.networkState,
        readyState: audio.readyState
      };
      console.log('📊 Audio metadata loaded:', info);

      // Show on screen for iPad debugging
      setStatusMessage(`Duration: ${audio.duration.toFixed(2)}s, Vol: ${audio.volume}, Muted: ${audio.muted}`);
    };

    audio.oncanplay = () => {
      console.log('✅ Audio ready to play', {
        duration: audio.duration,
        volume: audio.volume,
        muted: audio.muted,
        readyState: audio.readyState
      });

      // Ensure volume is set and not muted
      audio.volume = 1.0;
      audio.muted = false;

      setStatusMessage('Playing...');
    };

    audio.onplay = () => {
      console.log('✅ Audio playback started');
    };

    audio.onended = () => {
      console.log('✅ Audio playback ended');
      setStatusMessage('');
    };

    audio.onerror = (e) => {
      const audioElement = e && typeof e === 'object' && 'target' in e ? e.target as HTMLAudioElement : audio;
      const error = audioElement.error;
      console.error('❌ Audio loading error:', {
        code: error?.code,
        message: error?.message,
        MEDIA_ERR_ABORTED: error?.code === 1,
        MEDIA_ERR_NETWORK: error?.code === 2,
        MEDIA_ERR_DECODE: error?.code === 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: error?.code === 4
      });

      let errorMsg = 'Failed to load audio';
      if (error?.code === 2) errorMsg = 'Network error - check CORS';
      if (error?.code === 4) errorMsg = 'Audio format not supported';

      setStatusMessage(`❌ ${errorMsg}`);
    };

    // Set source AFTER setting up event listeners
    audio.src = audioUrl;

    // Attempt playback with detailed error handling
    audio.play()
      .then(() => {
        console.log('✅ Audio playback promise resolved');
      })
      .catch(err => {
        console.error('❌ Audio playback failed:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });

        let userMsg = err.message;
        if (err.name === 'NotAllowedError') {
          userMsg = 'Safari blocked autoplay - try again';
        } else if (err.name === 'NotSupportedError') {
          userMsg = 'Audio format not supported';
        }

        setStatusMessage(`❌ ${userMsg}`);
      });
  };

  const playLetterSound = () => {
    // Matches HTML version behavior: play audioUrl if exists
    const phoneme = PHONEMES.find(p => p.letter === letter.toLowerCase());
    if (!phoneme || !phoneme.audioUrl) {
      console.log(`No audio file for letter: ${letter}`);
      return;
    }

    const audio = new Audio(phoneme.audioUrl);
    audio.play().catch(err => {
      console.error('Audio playback failed:', err);
    });
  };

  const handleOK = async () => {
    if (!capturedPatternRef.current || !capturedAudioRef.current) {
      setStatusMessage('❌ No recording captured');
      return;
    }

    if (!currentProfileId) {
      setStatusMessage('❌ No profile selected');
      return;
    }

    setStatusMessage('📤 Uploading...');

    try {
      // Upload audio to Supabase Storage
      const audioUrl = await uploadSnapshotAudio(
        capturedAudioRef.current,
        currentProfileId,
        letter,
        false // positive snapshot
      );

      if (!audioUrl) {
        throw new Error('Failed to upload audio');
      }

      // Save calibration to Supabase
      const success = await saveCalibrationToSupabase(
        letter,
        capturedPatternRef.current,
        currentProfileId,
        audioUrl
      );

      if (success) {
        console.log(`✅ Calibrated ${letter} with audio`);

        // Mark letter as calibrated (updates the grid)
        onSuccess(letter);

        // Reload existing calibrations to show the new one
        await checkExistingCalibration();

        // Reset to ready state for another recording
        setRecordingState('ready');
        setStatusMessage(`✅ Saved! Add another or close to finish.`);
      }
    } catch (error) {
      console.error('❌ Error saving calibration:', error);
      setStatusMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveCalibrationToSupabase = async (
    letter: string,
    pattern: number[],
    profileId: string,
    audioUrl: string
  ): Promise<boolean> => {
    try {
      // Load existing calibration to append to it
      const { data: existing } = await supabase
        .from('calibrations')
        .select('pattern_data')
        .eq('profile_id', profileId)
        .eq('letter', letter)
        .single();

      // Create new snapshot
      const newSnapshot = {
        data: pattern,
        profileId: profileId,
        isNegative: false,
        score: 0,
        audio_url: audioUrl,
        createdAt: new Date().toISOString()
      };

      // Append to existing snapshots or create new array
      const existingSnapshots = existing?.pattern_data?.snapshots || [];
      const patternData: CalibrationData = {
        snapshots: [...existingSnapshots, newSnapshot]
      };

      const { error } = await supabase
        .from('calibrations')
        .upsert({
          profile_id: profileId,
          letter: letter,
          pattern_data: patternData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'profile_id,letter'
        });

      if (error) throw error;

      const totalSnapshots = patternData.snapshots.length;
      console.log(`✅ Saved calibration for letter ${letter} (now ${totalSnapshots} snapshot${totalSnapshots > 1 ? 's' : ''})`);
      return true;
    } catch (error) {
      console.error('❌ Error saving calibration:', error);
      setStatusMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleClose = () => {
    cleanup();
    onClose();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Conditional styling based on variant
  const styles = variant === 'kid' ? {
    backdrop: 'fixed inset-0 bg-black/40 flex items-start justify-center pt-8 z-[10000] overflow-y-auto',
    modal: 'bg-white/95 backdrop-blur-xl rounded-[30px] p-10 w-[90%] max-w-[700px] max-h-[85vh] overflow-y-auto border-4 border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative',
    text: 'text-gray-700',
    letter: 'text-purple-500',
    letterShadow: '0 10px 30px rgba(147, 51, 234, 0.3)',
    iconFill: '#a855f7',
    captureBox: 'bg-white/50 border-pink-200',
    captureBoxReady: 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.4)]',
    captureBoxRecording: 'border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.6)] animate-pulse',
    captureBoxCaptured: 'border-green-500 bg-green-50',
  } : {
    backdrop: 'fixed inset-0 bg-black/90 flex items-start justify-center pt-8 z-[10000] overflow-y-auto',
    modal: 'bg-[rgba(30,30,30,0.98)] rounded-[30px] p-10 w-[90%] max-w-[700px] max-h-[85vh] overflow-y-auto border-3 border-[#7CB342] shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative',
    text: 'text-[#ddd]',
    letter: 'text-[#FDD835]',
    letterShadow: '0 10px 30px rgba(253, 216, 53, 0.5)',
    iconFill: '#FDD835',
    captureBox: 'bg-[rgba(60,60,60,0.7)] border-gray-500',
    captureBoxReady: 'border-[#7CB342] shadow-[0_0_15px_rgba(124,179,66,0.6)]',
    captureBoxRecording: 'border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.8)] animate-pulse',
    captureBoxCaptured: 'border-green-500 bg-[rgba(76,175,80,0.2)]',
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 bg-white/10 border-none text-white text-2xl w-10 h-10 rounded-full cursor-pointer transition-all hover:bg-[rgba(255,67,54,0.3)] hover:rotate-90"
        >
          ✕
        </button>

        {/* Instructions */}
        <div className={`text-center ${styles.text} text-base mb-5`}>
          Click the letter to hear its sound, then click the microphone to record.
        </div>

        {/* Big Letter + Listen Icon */}
        <div className="flex items-center justify-center gap-5 my-5">
          <div
            onClick={playLetterSound}
            className={`text-[180px] font-bold ${styles.letter} cursor-pointer inline-block transition-all hover:scale-110`}
            style={{ textShadow: styles.letterShadow }}
          >
            {letter}
          </div>
          <div
            onClick={playLetterSound}
            className="w-[60px] h-[60px] cursor-pointer opacity-70 transition-all hover:opacity-100 hover:scale-115"
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ fill: styles.iconFill }}>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </div>
        </div>

        {/* Volume and Concentration Meters */}
        <div className="flex gap-4 justify-center mb-6">
          <div className="flex flex-col items-center gap-2">
            <div className={`text-sm ${styles.text}`}>Volume</div>
            <div className="w-24 h-3 bg-white/20 rounded-full border border-white/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all duration-100"
                style={{ width: `${Math.min(100, (volume / 40) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`text-sm ${styles.text}`}>Concentration</div>
            <div className="w-24 h-3 bg-white/20 rounded-full border border-white/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-100"
                style={{ width: `${Math.min(100, (concentration / 8) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Single Capture Box */}
        <div className="flex justify-center mt-8 relative">
          {/* Green Arrow */}
          {showArrow && recordingState === 'ready' && (
            <div className="absolute -top-[60px] animate-[arrowHover_2s_ease-in-out_infinite,arrowPulse_1.5s_ease-in-out_infinite]">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[50px] h-[50px]" style={{ filter: 'drop-shadow(0 2px 10px rgba(124, 179, 66, 0.8))' }}>
                <path d="M12 4L12 20M12 20L5 13M12 20L19 13" stroke="#7CB342" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          )}

          <div
            onClick={recordingState === 'ready' ? handleMicClick : undefined}
            className={`w-[300px] h-[150px] border-2 rounded-[10px] transition-all relative ${styles.captureBox}
              ${recordingState === 'ready' ? `${styles.captureBoxReady} animate-pulse cursor-pointer` : ''}
              ${recordingState === 'recording' ? `${styles.captureBoxRecording} cursor-wait` : ''}
              ${recordingState === 'captured' ? `${styles.captureBoxCaptured} cursor-default` : ''}
            `}
          >
            {/* Mic Icon */}
            {recordingState === 'ready' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 opacity-70">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ fill: styles.iconFill }}>
                  <path d="M12 2C10.9 2 10 2.9 10 4V12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12V4C14 2.9 13.1 2 12 2Z"/>
                  <path d="M17 11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11H5C5 14.53 7.61 17.43 11 17.92V21H13V17.92C16.39 17.43 19 14.53 19 11H17Z"/>
                </svg>
              </div>
            )}

            <canvas
              ref={el => { canvasRef.current = el; }}
              width={300}
              height={150}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Status Message */}
        <div className={`text-center ${styles.text} text-lg mt-5`}>
          {statusMessage}
        </div>

        {/* Action Buttons (Playback, Try Again, OK) */}
        {recordingState === 'captured' && (
          <div className="flex gap-4 justify-center mt-8">
            {/* Playback Button */}
            <button
              onClick={handlePlayback}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full cursor-pointer transition-all flex items-center gap-2 shadow-lg hover:scale-105"
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-white">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Play
            </button>

            {/* Try Again Button */}
            <button
              onClick={handleTryAgain}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-full cursor-pointer transition-all shadow-lg hover:scale-105"
            >
              Try Again
            </button>

            {/* OK Button */}
            <button
              onClick={handleOK}
              className="px-6 py-3 bg-[#7CB342] hover:bg-[#8BC34A] text-white rounded-full cursor-pointer transition-all shadow-lg hover:scale-105"
            >
              OK ✓
            </button>
          </div>
        )}

        {/* Existing Calibrations - Below everything */}
        {existingSnapshots.length > 0 && (
          <>
            {/* Horizontal Divider */}
            <div className="my-8 border-t border-white/20" />

            <div className={`text-center ${styles.text} text-sm mb-4`}>
              Existing Calibrations ({existingSnapshots.length})
            </div>

            <div className="flex flex-wrap gap-4 justify-center max-h-[250px] overflow-y-auto px-2">
              {existingSnapshots.map((snapshot, index) => (
                <SnapshotCard
                  key={index}
                  snapshot={snapshot}
                  index={index}
                  onPlay={handlePlayExistingSnapshot}
                  onDelete={handleDeleteSnapshot}
                  styles={styles}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes arrowHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes arrowPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
        @keyframes nextButtonPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
