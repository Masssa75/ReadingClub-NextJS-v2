'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, normalizePattern, calculateVolume, calculateEnergyConcentration, isNasal } from '@/app/utils/fftAnalysis';
import { supabase } from '@/app/lib/supabase';
import { SNAPSHOTS_NEEDED, PHONEMES } from '@/app/lib/constants';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';
import { useProfileContext } from '@/app/contexts/ProfileContext';

interface CalibrationModalProps {
  letter: string;
  onClose: () => void;
  onSuccess: (letter: string) => void;
  variant?: 'admin' | 'kid';
}

export default function CalibrationModal({ letter, onClose, onSuccess, variant = 'admin' }: CalibrationModalProps) {
  const { currentProfileId } = useProfileContext();
  const [statusMessage, setStatusMessage] = useState('Click letter to hear sound, then click box 1');
  const [showArrow, setShowArrow] = useState(true);
  const [showNextButton, setShowNextButton] = useState(false);
  const [boxStates, setBoxStates] = useState<('empty' | 'ready' | 'recording' | 'captured')[]>(
    ['ready', 'empty', 'empty', 'empty', 'empty']
  );

  const audioStateRef = useRef<AudioEngineState | null>(null);
  const capturedSnapshotsRef = useRef<number[][]>([]);
  const isListeningRef = useRef<boolean>(false);
  const listeningForIndexRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const lastPeakTimeRef = useRef<number>(0);

  useEffect(() => {
    initAudio();

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

      // Listen for peak if actively recording
      if (isListeningRef.current && listeningForIndexRef.current >= 0) {
        const volume = calculateVolume(audioStateRef.current.dataArray);
        const downsampled = downsampleTo64Bins(audioStateRef.current.dataArray);
        const concentration = calculateEnergyConcentration(downsampled);

        const volumeThreshold = isNasal(letter) ? 3 : 12;
        const concentrationThreshold = isNasal(letter) ? 1.2 : 2.0;

        const now = Date.now();
        if (volume > volumeThreshold &&
            concentration > concentrationThreshold &&
            (now - lastPeakTimeRef.current) > PEAK_COOLDOWN) {

          const normalized = normalizePattern(downsampled, letter);
          capturedSnapshotsRef.current.push(normalized);
          lastPeakTimeRef.current = now;

          const index = listeningForIndexRef.current;
          console.log(`📸 Captured snapshot ${capturedSnapshotsRef.current.length}/5`);

          // Draw snapshot in box
          drawSnapshotInBox(index, normalized);

          // Update box state
          const newBoxStates = [...boxStates];
          newBoxStates[index] = 'captured';
          if (index + 1 < 5) {
            newBoxStates[index + 1] = 'ready';
          }
          setBoxStates(newBoxStates);

          // Stop listening
          isListeningRef.current = false;
          listeningForIndexRef.current = -1;

          const capturedTotal = capturedSnapshotsRef.current.length;

          if (capturedTotal < 5) {
            setStatusMessage(`✓ Captured ${capturedTotal}/5. Click box ${capturedTotal + 1}`);
          } else {
            setStatusMessage('✓ All 5 captured! Saving...');
            setTimeout(() => {
              finishCalibration();
            }, 500);
          }
        }
      }
    };
    visualize();
  };

  const drawSnapshotInBox = (index: number, snapshot: number[]) => {
    const canvas = canvasRefs.current[index];
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = canvas.width / snapshot.length;
    for (let j = 0; j < snapshot.length; j++) {
      const barHeight = snapshot[j] * canvas.height;
      const x = j * barWidth;
      const y = canvas.height - barHeight;

      ctx.fillStyle = '#7CB342';
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  };

  const handleBoxClick = (index: number) => {
    // Only allow capturing the next uncaptured box
    if (index !== capturedSnapshotsRef.current.length) {
      return;
    }

    // Already listening
    if (isListeningRef.current) return;

    // Hide arrow once user starts
    setShowArrow(false);

    listeningForIndexRef.current = index;

    // Update box state to recording
    const newBoxStates = [...boxStates];
    newBoxStates[index] = 'recording';
    setBoxStates(newBoxStates);

    setStatusMessage(`Recording ${index + 1}/5... Get ready...`);

    // Wait 400ms to avoid click sound, THEN start listening
    setTimeout(() => {
      isListeningRef.current = true;
      setStatusMessage(`Recording ${index + 1}/5... Say "${letter}" NOW!`);
    }, 400);
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

  const finishCalibration = async () => {
    cleanup();

    if (capturedSnapshotsRef.current.length < 3) {
      setStatusMessage('Not enough snapshots. Please retry.');
      return;
    }

    const clusterResult = findBestCluster(capturedSnapshotsRef.current);
    const baseline = averageSnapshots(clusterResult.cluster);

    if (!currentProfileId) {
      setStatusMessage('❌ No profile selected');
      return;
    }

    const success = await saveCalibrationToSupabase(letter, baseline, currentProfileId);

    if (success) {
      console.log(`Calibrated ${letter}: Used ${clusterResult.cluster.length}/${capturedSnapshotsRef.current.length} snapshots`);
      setStatusMessage('✅ Calibration complete! Click Next to continue.');
      setShowNextButton(true);

      // Mark letter as calibrated (golden) immediately, but don't auto-advance yet
      // Auto-advance only happens when Next button is clicked
      onSuccess(letter);
    }
  };

  const findBestCluster = (snapshots: number[][]): { cluster: number[][], indices: number[] } => {
    if (snapshots.length <= 3) {
      return {
        cluster: snapshots,
        indices: snapshots.map((_, i) => i)
      };
    }

    const distances: { i: number, j: number, dist: number }[] = [];
    for (let i = 0; i < snapshots.length; i++) {
      for (let j = i + 1; j < snapshots.length; j++) {
        const dist = calculateSnapshotDistance(snapshots[i], snapshots[j]);
        distances.push({ i, j, dist });
      }
    }

    distances.sort((a, b) => a.dist - b.dist);

    const pair = distances[0];
    const candidates = [pair.i, pair.j];

    let bestThird: number | null = null;
    let bestAvgDist = Infinity;

    for (let k = 0; k < snapshots.length; k++) {
      if (candidates.includes(k)) continue;

      const dist1 = calculateSnapshotDistance(snapshots[k], snapshots[candidates[0]]);
      const dist2 = calculateSnapshotDistance(snapshots[k], snapshots[candidates[1]]);
      const avgDist = (dist1 + dist2) / 2;

      if (avgDist < bestAvgDist) {
        bestAvgDist = avgDist;
        bestThird = k;
      }
    }

    if (bestThird !== null) {
      candidates.push(bestThird);
    }

    return {
      cluster: candidates.map(i => snapshots[i]),
      indices: candidates
    };
  };

  const calculateSnapshotDistance = (a: number[], b: number[]): number => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.abs(a[i] - b[i]);
    }
    return sum;
  };

  const averageSnapshots = (snapshots: number[][]): number[] => {
    const numBins = snapshots[0].length;
    const averaged = new Array(numBins).fill(0);

    for (const snapshot of snapshots) {
      for (let i = 0; i < numBins; i++) {
        averaged[i] += snapshot[i];
      }
    }

    return averaged.map(v => v / snapshots.length);
  };

  const saveCalibrationToSupabase = async (letter: string, baseline: number[], profileId: string): Promise<boolean> => {
    try {
      const patternData: CalibrationData = {
        snapshots: [{
          data: baseline,
          profileId: profileId,
          isNegative: false,
          score: 0
        }]
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

      console.log(`✅ Saved calibration for letter ${letter}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving calibration:', error);
      setStatusMessage(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleNextClick = () => {
    // Trigger success callback (marks letter golden + auto-advances)
    onSuccess(letter);
    // Close modal - parent will handle opening next letter via onSuccess
    handleClose();
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
          Click the letter to hear its sound. Click each box below to record 5 sounds.
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

        {/* 5 Capture Boxes */}
        <div className="flex gap-2.5 justify-center mt-8 relative">
          {/* Green Arrow */}
          {showArrow && (
            <div className="absolute bottom-[90px] left-[50px] animate-[arrowHover_2s_ease-in-out_infinite,arrowPulse_1.5s_ease-in-out_infinite]">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-[50px] h-[50px]" style={{ filter: 'drop-shadow(0 2px 10px rgba(124, 179, 66, 0.8))' }}>
                <path d="M12 4L12 20M12 20L5 13M12 20L19 13" stroke="#7CB342" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          )}

          {Array.from({ length: SNAPSHOTS_NEEDED }).map((_, i) => {
            let boxClass = `w-[100px] h-[80px] border-2 rounded-[10px] transition-all relative ${styles.captureBox}`;
            if (boxStates[i] === 'ready') {
              boxClass += ` ${styles.captureBoxReady} animate-pulse cursor-pointer`;
            } else if (boxStates[i] === 'recording') {
              boxClass += ` ${styles.captureBoxRecording} cursor-wait`;
            } else if (boxStates[i] === 'captured') {
              boxClass += ` ${styles.captureBoxCaptured} cursor-default`;
            } else {
              boxClass += ' opacity-50 cursor-not-allowed';
            }

            return (
            <div
              key={i}
              onClick={() => handleBoxClick(i)}
              className={boxClass}
            >
              {/* Mic Icon */}
              {boxStates[i] === 'ready' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 opacity-70">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" style={{ fill: styles.iconFill }}>
                    <path d="M12 2C10.9 2 10 2.9 10 4V12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12V4C14 2.9 13.1 2 12 2Z"/>
                    <path d="M17 11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11H5C5 14.53 7.61 17.43 11 17.92V21H13V17.92C16.39 17.43 19 14.53 19 11H17Z"/>
                  </svg>
                </div>
              )}

              <canvas
                ref={el => { canvasRefs.current[i] = el; }}
                width={100}
                height={80}
                className="w-full h-full"
              />
            </div>
          );
          })}
        </div>

        {/* Status Message */}
        <div className={`text-center ${styles.text} text-lg mt-5`}>
          {statusMessage}
        </div>

        {/* Next Button */}
        {showNextButton && (
          <div
            onClick={handleNextClick}
            className="w-20 h-20 bg-[#7CB342] rounded-full cursor-pointer transition-all mx-auto mt-8 flex items-center justify-center shadow-[0_4px_15px_rgba(124,179,66,0.5)] animate-[nextButtonPulse_1.5s_ease-in-out_infinite] hover:scale-110 hover:bg-[#8BC34A] hover:shadow-[0_6px_20px_rgba(124,179,66,0.7)]"
          >
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 fill-white">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
            </svg>
          </div>
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
