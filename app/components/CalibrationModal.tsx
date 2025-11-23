'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2 } from 'lucide-react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, normalizePattern, calculateVolume, calculateEnergyConcentration, isNasal, isLiquid } from '@/app/utils/fftAnalysis';
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
        // Only show positive snapshots (exclude negative/rejection snapshots from manual override)
        const allSnapshots = data.pattern_data.snapshots;
        const positiveSnapshots = allSnapshots.filter((s: any) => !s.isNegative);
        const count = positiveSnapshots.length;
        setExistingSnapshotCount(count);
        setExistingSnapshots(positiveSnapshots);
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

      // Use zero smoothing for instant response in calibration modal
      if (audioState.analyser) {
        audioState.analyser.smoothingTimeConstant = 0;
        console.log('🎤 Audio smoothing set to 0 for calibration (instant response)');
      }

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
    let frameCount = 0; // For throttled logging

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

      // Debug logging (every 30 frames = ~0.5 seconds at 60fps)
      frameCount++;
      if (frameCount % 30 === 0) {
        // Letter O is a soft vowel - use half volume threshold only
        const volumeThreshold = letter === 'o' ? 6 : (isNasal(letter) ? 3 : (isLiquid(letter) ? 6 : 12));
        const maxVolume = volumeThreshold * 2;
        const volumePercent = Math.min(100, (vol / maxVolume) * 100);
        const color = vol >= volumeThreshold ? 'GREEN' : (vol >= volumeThreshold * 0.8 ? 'YELLOW' : 'RED');

        // Sample of raw frequency data (first 10 bins)
        const rawSample = Array.from(audioStateRef.current.dataArray.slice(0, 10));

        console.log(`🎤 [${letter}] Vol: ${vol.toFixed(1)} | Threshold: ${volumeThreshold} | Percent: ${volumePercent.toFixed(0)}% | Color: ${color}`);
        console.log(`📊 Raw freq data (first 10 bins): [${rawSample.join(', ')}]`);
      }

      // Draw live pattern continuously during recording (use REF not state!)
      if (isRecordingRef.current) {
        const normalized = normalizePattern(downsampled, letter);
        drawPattern(normalized);
      }

      // Listen for peak if actively recording
      if (isListeningRef.current && isRecordingRef.current) {
        // Letter O is a soft vowel - use half volume threshold only
        const volumeThreshold = letter === 'o' ? 6 : (isNasal(letter) ? 3 : (isLiquid(letter) ? 6 : 12));
        const concentrationThreshold = isNasal(letter) ? 1.2 : (isLiquid(letter) ? 1.0 : 2.0);

        const now = Date.now();
        if (vol > volumeThreshold &&
            conc > concentrationThreshold &&
            (now - lastPeakTimeRef.current) > PEAK_COOLDOWN) {

          const normalized = normalizePattern(downsampled, letter);
          capturedPatternRef.current = normalized;
          lastPeakTimeRef.current = now;

          console.log(`📸 PEAK DETECTED for ${letter}! Vol: ${vol.toFixed(1)} (>${volumeThreshold}), Conc: ${conc.toFixed(2)} (>${concentrationThreshold})`);

          // Draw final snapshot once and freeze the display
          drawPattern(normalized);

          // Stop listening and stop updating the canvas
          isListeningRef.current = false;
          isRecordingRef.current = false; // Stop canvas updates immediately
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

  const handlePlayExistingSnapshot = async (audioUrl: string) => {
    console.log('🎵 Attempting to play audio:', audioUrl);

    if (!audioUrl) {
      console.error('❌ No audio URL provided');
      setStatusMessage('❌ No audio URL found');
      return;
    }

    setStatusMessage('Fetching audio...');

    try {
      // Fetch as blob first (works around Safari CORS issues)
      // This is the same approach that works for fresh recordings
      const response = await fetch(audioUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('✅ Audio blob fetched:', {
        size: blob.size,
        type: blob.type
      });

      if (blob.size === 0) {
        throw new Error('Audio file is empty');
      }

      // Create object URL from blob (same as fresh recordings)
      const blobUrl = URL.createObjectURL(blob);
      const audio = new Audio(blobUrl);

      audio.oncanplay = () => {
        console.log('✅ Audio ready to play');
        setStatusMessage('Playing...');
      };

      audio.onended = () => {
        console.log('✅ Audio playback ended');
        setStatusMessage('');
        URL.revokeObjectURL(blobUrl);  // Clean up
      };

      audio.onerror = (e) => {
        console.error('❌ Audio playback error:', e);
        setStatusMessage('❌ Playback failed');
        URL.revokeObjectURL(blobUrl);
      };

      // Play immediately (user gesture is fresh)
      await audio.play();
      console.log('✅ Audio playback started');

    } catch (err) {
      console.error('❌ Failed to fetch/play audio:', err);
      const error = err as Error;
      setStatusMessage(`❌ ${error.message}`);
    }
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
    backdrop: 'fixed inset-0 bg-black/40 flex items-center justify-center z-[10000]',
    modal: 'bg-white/95 backdrop-blur-xl rounded-[30px] p-6 w-[90%] max-w-[600px] max-h-[90vh] overflow-hidden border-4 border-white/50 shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative flex flex-col',
    text: 'text-gray-700',
    letter: 'text-purple-500',
    letterShadow: '0 10px 30px rgba(147, 51, 234, 0.3)',
    iconFill: '#a855f7',
    captureBox: 'bg-white/50 border-pink-200',
    captureBoxReady: 'border-green-400 shadow-[0_0_15px_rgba(74,222,128,0.4)]',
    captureBoxRecording: 'border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.6)] animate-pulse',
    captureBoxCaptured: 'border-green-500 bg-green-50',
  } : {
    backdrop: 'fixed inset-0 bg-black/90 flex items-center justify-center z-[10000]',
    modal: 'bg-[rgba(30,30,30,0.98)] rounded-[30px] p-6 w-[90%] max-w-[600px] max-h-[90vh] overflow-hidden border-3 border-[#7CB342] shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative flex flex-col',
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
    <div
      className={styles.backdrop}
      onClick={(e) => {
        // Click outside modal to close
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className={styles.modal}>

        {/* Close Button - Light red background */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 bg-red-400/30 border-none text-white text-xl w-9 h-9 rounded-full cursor-pointer transition-all hover:bg-red-500/50 hover:rotate-90"
        >
          ✕
        </button>

        {/* MAIN CONTENT - Fixed height, no scroll */}
        <div className="flex-shrink-0 relative">
          {/* Instructions - Smaller */}
          <div className={`text-center ${styles.text} text-sm mb-3`}>
            Click letter to hear sound, then click microphone to record
          </div>

          {/* Main content with meters on the right */}
          <div className="flex gap-4">
            {/* Left side - Letter and capture */}
            <div className="flex-1">
              {/* Compact Letter + Listen Icon */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <div
                  onClick={playLetterSound}
                  className={`text-[100px] font-bold ${styles.letter} cursor-pointer inline-block transition-all hover:scale-110 leading-none`}
                  style={{ textShadow: styles.letterShadow }}
                >
                  {letter}
                </div>
                <div
                  onClick={playLetterSound}
                  className="cursor-pointer opacity-70 transition-all hover:opacity-100 hover:scale-110"
                >
                  <Volume2 size={40} style={{ color: styles.iconFill }} />
                </div>
              </div>

              {/* Compact Capture Box */}
              <div className="flex justify-center relative mb-3">
            {/* Green Arrow - Smaller */}
            {showArrow && recordingState === 'ready' && (
              <div className="absolute -top-[45px] animate-bounce">
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[35px] h-[35px]" style={{ filter: 'drop-shadow(0 2px 10px rgba(124, 179, 66, 0.8))' }}>
                  <path d="M12 4L12 20M12 20L5 13M12 20L19 13" stroke="#7CB342" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            )}

            <div
              onClick={recordingState === 'ready' ? handleMicClick : undefined}
              className={`w-[220px] h-[100px] border-2 rounded-[10px] transition-all relative ${styles.captureBox}
                ${recordingState === 'ready' ? `${styles.captureBoxReady} animate-pulse cursor-pointer` : ''}
                ${recordingState === 'recording' ? `${styles.captureBoxRecording} cursor-wait` : ''}
                ${recordingState === 'captured' ? `${styles.captureBoxCaptured} cursor-default` : ''}
              `}
            >
              {/* Mic Icon - Smaller */}
              {recordingState === 'ready' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 opacity-70">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ fill: styles.iconFill }}>
                    <path d="M12 2C10.9 2 10 2.9 10 4V12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12V4C14 2.9 13.1 2 12 2Z"/>
                    <path d="M17 11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11H5C5 14.53 7.61 17.43 11 17.92V21H13V17.92C16.39 17.43 19 14.53 19 11H17Z"/>
                  </svg>
                </div>
              )}

              <canvas
                ref={el => { canvasRef.current = el; }}
                width={220}
                height={100}
                className="w-full h-full"
              />
            </div>
          </div>

              {/* Status Message - Smaller */}
              <div className={`text-center ${styles.text} text-sm mb-3`}>
                {statusMessage}
              </div>

              {/* Compact Action Buttons */}
              {recordingState === 'captured' && (
                <div className="flex gap-3 justify-center mb-2">
                  {/* Playback Button */}
                  <button
                    onClick={handlePlayback}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full cursor-pointer transition-all flex items-center gap-2 shadow-lg hover:scale-105 text-sm"
                  >
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-white">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Play
                  </button>

                  {/* Try Again Button */}
                  <button
                    onClick={handleTryAgain}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full cursor-pointer transition-all shadow-lg hover:scale-105 text-sm"
                  >
                    Try Again
                  </button>

                  {/* OK Button */}
                  <button
                    onClick={handleOK}
                    className="px-4 py-2 bg-[#7CB342] hover:bg-[#8BC34A] text-white rounded-full cursor-pointer transition-all shadow-lg hover:scale-105 text-sm"
                  >
                    OK ✓
                  </button>
                </div>
              )}
            </div>

          {/* Vertical Volume and Concentration Meters on RIGHT */}
          <div className="flex flex-col gap-6 justify-center items-center min-w-[70px]">
              {(() => {
                // Calculate thresholds based on letter (same logic as peak detection)
                // Letter O is a soft vowel - use half volume threshold only
                const volumeThreshold = letter === 'o' ? 6 : (isNasal(letter) ? 3 : (isLiquid(letter) ? 6 : 12));
                const concentrationThreshold = isNasal(letter) ? 1.2 : (isLiquid(letter) ? 1.0 : 2.0);

                // Scale based on 2x threshold (same as ThresholdMeters)
                const maxVolume = volumeThreshold * 2;
                const volumePercent = Math.min(100, (volume / maxVolume) * 100);
                const volumeThresholdPercent = (volumeThreshold / maxVolume) * 100;

                const maxConcentration = concentrationThreshold * 2;
                const concentrationPercent = Math.min(100, (concentration / maxConcentration) * 100);
                const concentrationThresholdPercent = (concentrationThreshold / maxConcentration) * 100;

                // Color coding (same as ThresholdMeters)
                const getVolumeColor = () => {
                  if (volume >= volumeThreshold) return '#4CAF50'; // Green
                  if (volume >= volumeThreshold * 0.8) return '#FDD835'; // Yellow
                  return '#f44336'; // Red
                };

                const getConcentrationColor = () => {
                  if (concentration >= concentrationThreshold) return '#4CAF50'; // Green
                  if (concentration >= concentrationThreshold * 0.8) return '#FDD835'; // Yellow
                  return '#f44336'; // Red
                };

                return (
                  <>
                    {/* Volume Meter - Vertical */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`text-[11px] ${styles.text} text-center font-medium`}>Vol</div>
                      <div className="relative w-12 h-36 bg-white/20 rounded-full border border-white/30 overflow-hidden flex flex-col-reverse">
                        <div
                          className="w-full rounded-full"
                          style={{
                            height: `${volumePercent}%`,
                            background: getVolumeColor(),
                          }}
                        />
                        {/* Threshold marker */}
                        <div
                          className="absolute left-0 w-full h-0.5 bg-[#FDD835]"
                          style={{
                            bottom: `${volumeThresholdPercent}%`,
                            boxShadow: '0 0 4px #FDD835',
                          }}
                        />
                      </div>
                    </div>
                    {/* Concentration Meter - Vertical */}
                    <div className="flex flex-col items-center gap-1">
                      <div className={`text-[11px] ${styles.text} text-center font-medium`}>Conc</div>
                      <div className="relative w-12 h-36 bg-white/20 rounded-full border border-white/30 overflow-hidden flex flex-col-reverse">
                        <div
                          className="w-full rounded-full"
                          style={{
                            height: `${concentrationPercent}%`,
                            background: getConcentrationColor(),
                          }}
                        />
                        {/* Threshold marker */}
                        <div
                          className="absolute left-0 w-full h-0.5 bg-[#FDD835]"
                          style={{
                            bottom: `${concentrationThresholdPercent}%`,
                            boxShadow: '0 0 4px #FDD835',
                          }}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Existing Calibrations - Scrollable section at bottom */}
        {existingSnapshots.length > 0 && (
          <div className="flex-shrink-0 border-t border-white/20 pt-4 mt-4">
            <div className={`text-center ${styles.text} text-xs mb-3`}>
              Existing Calibrations ({existingSnapshots.length})
            </div>

            <div className="flex flex-wrap gap-3 justify-center max-h-[180px] overflow-y-auto px-2">
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
          </div>
        )}
      </div>
    </div>
  );
}
