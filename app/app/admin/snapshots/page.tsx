'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import type { CalibrationData, AudioEngineState } from '@/app/lib/types';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, calculateVolume, calculateEnergyConcentration, isNasal, isLiquid } from '@/app/utils/fftAnalysis';
import { strategy11_simpleSnapshot, getLastMatchInfo, getLastWinningSnapshot } from '@/app/utils/patternMatching';
import CalibrationModal from '@/app/components/CalibrationModal';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

type FilterType = 'all' | 'positive' | 'negative' | 'global';

interface AttemptLogEntry {
  id: number;
  timestamp: Date;
  type: 'match' | 'reject_negative' | 'reject_other_letter' | 'no_match';
  targetLetter: string;
  targetScore: number;
  winningLetter?: string;
  winningScore?: number;
  culpritSnapshot?: any;
  matchedSnapshot?: any;
  liveAudioUrl?: string; // URL of what user said during this attempt
}

export default function AdminSnapshotsPage() {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<CalibrationData['snapshots']>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotCounts, setSnapshotCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<FilterType>('all');

  // Live testing state
  const [isTesting, setIsTesting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [liveWaveform, setLiveWaveform] = useState<number[]>([]);
  const [attemptLog, setAttemptLog] = useState<AttemptLogEntry[]>([]);
  const [calibrationData, setCalibrationData] = useState<Record<string, CalibrationData>>({});
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [marginOfVictory, setMarginOfVictory] = useState(3);
  const isPausedRef = useRef(false);
  const marginOfVictoryRef = useRef(3);
  const liveWaveformRef = useRef<HTMLCanvasElement>(null);
  const attemptIdRef = useRef(0);
  const audioStateRef = useRef<AudioEngineState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isTestingRef = useRef(false);
  const patternBufferRef = useRef<number[][]>([]);
  const calibrationDataRef = useRef<Record<string, CalibrationData>>({});
  const lastAttemptTimeRef = useRef(0);
  const selectedLetterRef = useRef<string | null>(null); // Track selected letter for detection loop

  // Live audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<{ blob: Blob; timestamp: number }[]>([]);

  // Load snapshot counts for all letters on mount
  useEffect(() => {
    loadSnapshotCounts();
    loadAllCalibrations();
  }, []);

  // Keep calibrationDataRef in sync
  useEffect(() => {
    calibrationDataRef.current = calibrationData;
  }, [calibrationData]);

  // Keep isPausedRef in sync
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keep marginOfVictoryRef in sync
  useEffect(() => {
    marginOfVictoryRef.current = marginOfVictory;
  }, [marginOfVictory]);

  // Keep selectedLetterRef in sync (critical for live testing letter switching)
  useEffect(() => {
    selectedLetterRef.current = selectedLetter;
    console.log(`🔤 Selected letter updated: ${selectedLetter}`);
  }, [selectedLetter]);

  // Draw live waveform
  useEffect(() => {
    if (!liveWaveformRef.current || liveWaveform.length === 0) return;

    const canvas = liveWaveformRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 100;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const max = Math.max(...liveWaveform);
    if (max < 0.01) return; // Don't draw if no signal

    // Normalize and draw
    const normalized = liveWaveform.map(v => v / Math.max(max, 1));
    const barWidth = canvas.width / normalized.length;

    normalized.forEach((value, i) => {
      const barHeight = value * canvas.height;
      const hue = (i / normalized.length) * 120 + 100; // Green to cyan gradient
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    });
  }, [liveWaveform]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioStateRef.current) {
        stopAudio(audioStateRef.current);
      }
    };
  }, []);

  const loadAllCalibrations = async () => {
    try {
      const { data, error } = await supabase.from('calibrations').select('*');
      if (error) throw error;

      const calibrations: Record<string, CalibrationData> = {};
      data?.forEach((cal) => {
        const letter = cal.letter.toLowerCase();
        if (!calibrations[letter]) {
          calibrations[letter] = { snapshots: [] };
        }
        if (cal.pattern_data?.snapshots) {
          cal.pattern_data.snapshots.forEach((s: any) => {
            calibrations[letter].snapshots.push({
              ...s,
              calibrationId: cal.id,
              sourceLetter: letter // Track which letter this snapshot belongs to
            });
          });
        }
      });
      setCalibrationData(calibrations);
      console.log('✅ Loaded calibrations for testing:', Object.keys(calibrations).length, 'letters');
    } catch (error) {
      console.error('Error loading calibrations:', error);
    }
  };

  const startTesting = async () => {
    if (!selectedLetter) {
      alert('Please select a letter first');
      return;
    }

    try {
      audioStateRef.current = await setupAudio();

      // Start MediaRecorder for live audio capture
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // Keep rolling buffer of last 3 seconds (~6 chunks at 500ms each)
          audioChunksRef.current.push({ blob: e.data, timestamp: Date.now() });
          if (audioChunksRef.current.length > 6) {
            audioChunksRef.current.shift();
          }
        }
      };

      mediaRecorder.start(500); // Capture in 500ms chunks
      mediaRecorderRef.current = mediaRecorder;

      setIsTesting(true);
      isTestingRef.current = true;
      patternBufferRef.current = [];
      setAttemptLog([]);
      startVoiceDetection(); // Uses selectedLetterRef.current
    } catch (err) {
      console.error('Failed to start testing:', err);
      alert('Failed to access microphone');
    }
  };

  const stopTesting = () => {
    setIsTesting(false);
    isTestingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioStateRef.current) {
      stopAudio(audioStateRef.current);
      audioStateRef.current = null;
    }
    // Stop MediaRecorder and release stream
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    patternBufferRef.current = [];
  };

  const startVoiceDetection = useCallback(() => {
    const ATTEMPT_COOLDOWN = 1500;

    const detectVoice = () => {
      const audioState = audioStateRef.current;
      if (!isTestingRef.current || !audioState || !audioState.analyser || !audioState.dataArray) {
        return;
      }

      // Use ref for target letter so it updates when user clicks different letter
      const targetLetter = selectedLetterRef.current;
      if (!targetLetter) {
        animationFrameRef.current = requestAnimationFrame(detectVoice);
        return;
      }

      getFrequencyData(audioState.analyser, audioState.dataArray);
      const vol = calculateVolume(audioState.dataArray);
      const downsampled = downsampleTo64Bins(audioState.dataArray);
      const conc = calculateEnergyConcentration(downsampled);

      setVolume(vol);
      setLiveWaveform([...downsampled]); // Update live waveform

      // Skip detection when paused (but still show volume)
      if (isPausedRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectVoice);
        return;
      }

      patternBufferRef.current.push(downsampled);
      if (patternBufferRef.current.length > 30) {
        patternBufferRef.current.shift();
      }

      // Check for sound detection
      if (patternBufferRef.current.length >= 10) {
        const volumeThreshold = isNasal(targetLetter) ? 2 : (isLiquid(targetLetter) ? 6 : 15);
        const concentrationThreshold = isNasal(targetLetter) ? 1.2 : (isLiquid(targetLetter) ? 1.0 : 2.0);

        const timeSinceLastAttempt = Date.now() - lastAttemptTimeRef.current;
        if (timeSinceLastAttempt < ATTEMPT_COOLDOWN) {
          animationFrameRef.current = requestAnimationFrame(detectVoice);
          return;
        }

        if (vol > volumeThreshold && conc > concentrationThreshold) {
          lastAttemptTimeRef.current = Date.now();

          const result = strategy11_simpleSnapshot(patternBufferRef.current, targetLetter, calibrationDataRef.current);
          const matchInfo = getLastMatchInfo();

          console.log('🔍 Test result:', { targetLetter, result, matchInfo });

          // Create log entry based on what happened
          const entry: AttemptLogEntry = {
            id: attemptIdRef.current++,
            timestamp: new Date(),
            targetLetter,
            targetScore: result.targetScore,
            type: 'no_match',
          };

          const margin = marginOfVictoryRef.current;
          const threshold = 80; // MATCH_THRESHOLD

          if (matchInfo?.matchType === 'rejected' && matchInfo.negativeSnapshot) {
            // Rejected by negative snapshot
            entry.type = 'reject_negative';
            entry.culpritSnapshot = matchInfo.negativeSnapshot;
          } else if (result.predictedLetter !== targetLetter) {
            // Another letter scored highest - check if it beats target by required margin
            const otherLetterMargin = result.score - result.targetScore;

            if (otherLetterMargin >= margin) {
              // Other letter won by sufficient margin
              entry.type = 'reject_other_letter';
              entry.winningLetter = result.predictedLetter;
              entry.winningScore = result.score;

              // Use the actual snapshot that won (not historical best)
              const winningInfo = getLastWinningSnapshot();
              if (winningInfo?.snapshot) {
                entry.culpritSnapshot = {
                  ...winningInfo.snapshot,
                  fromLetter: winningInfo.letter,
                  sourceLetter: winningInfo.letter
                };
              }
            } else if (result.targetScore > threshold) {
              // Target wins because other letter didn't beat it by required margin
              entry.type = 'match';
              entry.matchedSnapshot = matchInfo?.positiveSnapshot;
            }
          } else if (result.predictedLetter === targetLetter && result.score > threshold) {
            // Target letter is the best match - accept if above threshold
            entry.type = 'match';
            entry.matchedSnapshot = matchInfo?.positiveSnapshot;
          }

          setAttemptLog(prev => [entry, ...prev].slice(0, 20)); // Keep last 20
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectVoice);
    };

    detectVoice();
  }, []);

  const deleteSnapshotFromLog = async (snapshot: any, letter: string, entryId?: number) => {
    if (!confirm('Delete this snapshot?')) return;

    try {
      const calibrationId = snapshot.calibrationId;
      if (!calibrationId) {
        alert('Cannot delete: missing calibration ID');
        return;
      }

      const { data: calibration, error: fetchError } = await supabase
        .from('calibrations')
        .select('*')
        .eq('id', calibrationId)
        .single();

      if (fetchError) throw fetchError;

      const updatedSnapshots = calibration.pattern_data.snapshots.filter((s: any) => {
        const isSameProfile = s.profileId === snapshot.profileId;
        const isSamePattern = s.data?.[0] === snapshot.data?.[0] &&
                             s.data?.[1] === snapshot.data?.[1] &&
                             s.data?.[2] === snapshot.data?.[2];
        return !(isSameProfile && isSamePattern);
      });

      const { error: updateError } = await supabase
        .from('calibrations')
        .update({
          pattern_data: {
            ...calibration.pattern_data,
            snapshots: updatedSnapshots
          }
        })
        .eq('id', calibrationId);

      if (updateError) throw updateError;

      // Remove the entry from the attempt log
      if (entryId !== undefined) {
        setAttemptLog(prev => prev.filter(e => e.id !== entryId));
      }

      // Reload calibrations
      await loadAllCalibrations();
      await loadSnapshotCounts();
      if (selectedLetter) {
        await loadSnapshots(selectedLetter);
      }

      console.log('✅ Snapshot deleted!');
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      alert('Failed to delete snapshot');
    }
  };

  const loadSnapshotCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('calibrations')
        .select('letter, pattern_data');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((cal) => {
        const letter = cal.letter.toLowerCase();
        // Only count positive snapshots (matching what we display)
        const positiveSnapshotCount = cal.pattern_data?.snapshots?.filter((s: any) => !s.isNegative).length || 0;
        counts[letter] = (counts[letter] || 0) + positiveSnapshotCount;
      });

      setSnapshotCounts(counts);
    } catch (error) {
      console.error('Error loading snapshot counts:', error);
    }
  };

  const loadSnapshots = async (letter: string) => {
    setLoading(true);
    setSelectedLetter(letter);

    try {
      // Load all calibrations for this letter (cross-profile, case-insensitive)
      const { data, error } = await supabase
        .from('calibrations')
        .select('*')
        .ilike('letter', letter);

      if (error) throw error;

      // Collect all snapshots with calibration metadata
      const allSnapshots: Array<CalibrationData['snapshots'][0] & { calibrationId: string }> = [];
      data?.forEach((cal) => {
        if (cal.pattern_data?.snapshots) {
          cal.pattern_data.snapshots.forEach((snapshot: CalibrationData['snapshots'][0]) => {
            allSnapshots.push({
              ...snapshot,
              calibrationId: cal.id
            });
          });
        }
      });

      // Sort by score descending
      allSnapshots.sort((a, b) => (b.score || 0) - (a.score || 0));

      setSnapshots(allSnapshots);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGlobalNegative = async (snapshot: any, index: number) => {
    if (!snapshot.isNegative) {
      alert('Only negative snapshots can be made global');
      return;
    }

    const newGlobalState = !snapshot.isGlobalNegative;
    const action = newGlobalState ? 'global negative' : 'letter-specific negative';

    if (!confirm(`Make this snapshot a ${action}?`)) {
      return;
    }

    console.log(`🌍 Toggling global negative: ${snapshot.isGlobalNegative} → ${newGlobalState}`);

    // Optimistic update - update UI immediately
    const updatedSnapshots = [...snapshots];
    updatedSnapshots[index] = { ...snapshot, isGlobalNegative: newGlobalState };
    setSnapshots(updatedSnapshots);

    try {
      // Validate calibrationId
      if (!snapshot.calibrationId) {
        throw new Error('Snapshot is missing calibrationId');
      }

      // Get the calibration record
      const { data: calibration, error: fetchError } = await supabase
        .from('calibrations')
        .select('*')
        .eq('id', snapshot.calibrationId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching calibration:', fetchError);
        throw fetchError;
      }

      // Find and update the snapshot in the array
      const updatedSnapshotList = calibration.pattern_data.snapshots.map((s: any) => {
        const isSameProfile = s.profileId === snapshot.profileId;
        const isSamePattern = s.data?.[0] === snapshot.data?.[0] &&
                             s.data?.[1] === snapshot.data?.[1] &&
                             s.data?.[2] === snapshot.data?.[2];
        const isSameAudio = s.audio_url === snapshot.audio_url;

        if (isSameProfile && isSamePattern && isSameAudio) {
          return { ...s, isGlobalNegative: newGlobalState };
        }
        return s;
      });

      // Update the calibration record
      const { error: updateError } = await supabase
        .from('calibrations')
        .update({
          pattern_data: {
            ...calibration.pattern_data,
            snapshots: updatedSnapshotList
          }
        })
        .eq('id', snapshot.calibrationId);

      if (updateError) {
        console.error('❌ Error updating calibration:', updateError);
        throw updateError;
      }

      console.log(`✅ Snapshot ${newGlobalState ? 'promoted to' : 'demoted from'} global negative`);
    } catch (error) {
      console.error('❌ Error toggling global negative:', error);
      // Restore snapshot on error
      setSnapshots(snapshots);
      alert(`Failed to update snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const deleteSnapshot = async (snapshot: any, index: number) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) {
      return;
    }

    console.log('🗑️ Deleting snapshot:', {
      calibrationId: snapshot.calibrationId,
      profileId: snapshot.profileId,
      hasAudio: !!snapshot.audio_url
    });

    // Optimistic update - remove from UI immediately
    const updatedSnapshotList = snapshots.filter((_, idx) => idx !== index);
    setSnapshots(updatedSnapshotList);

    try {
      // Validate calibrationId
      if (!snapshot.calibrationId) {
        throw new Error('Snapshot is missing calibrationId');
      }

      // Get the calibration record
      const { data: calibration, error: fetchError } = await supabase
        .from('calibrations')
        .select('*')
        .eq('id', snapshot.calibrationId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching calibration:', fetchError);
        throw fetchError;
      }

      console.log('📦 Found calibration record, current snapshot count:', calibration.pattern_data?.snapshots?.length);

      // Find and remove the snapshot from the array
      const updatedSnapshots = calibration.pattern_data.snapshots.filter((s: any) => {
        // Match by profileId and pattern data (first few values)
        const isSameProfile = s.profileId === snapshot.profileId;
        const isSamePattern = s.data?.[0] === snapshot.data?.[0] &&
                             s.data?.[1] === snapshot.data?.[1] &&
                             s.data?.[2] === snapshot.data?.[2];
        const isSameAudio = s.audio_url === snapshot.audio_url;

        // Keep all snapshots that DON'T match
        return !(isSameProfile && isSamePattern && isSameAudio);
      });

      console.log('🔄 Updated snapshot count:', updatedSnapshots.length, '(removed', calibration.pattern_data.snapshots.length - updatedSnapshots.length, ')');

      // Update the calibration record
      const { error: updateError } = await supabase
        .from('calibrations')
        .update({
          pattern_data: {
            ...calibration.pattern_data,
            snapshots: updatedSnapshots
          }
        })
        .eq('id', snapshot.calibrationId);

      if (updateError) {
        console.error('❌ Error updating calibration:', updateError);
        throw updateError;
      }

      // Delete audio file from storage if it exists
      if (snapshot.audio_url) {
        try {
          // Extract the full storage path from the URL
          const urlParts = snapshot.audio_url.split('/storage/v1/object/public/snapshots/');
          if (urlParts.length > 1) {
            const storagePath = urlParts[1];
            console.log('🗑️ Deleting audio file:', storagePath);

            const { error: storageError } = await supabase.storage
              .from('snapshots')
              .remove([storagePath]);

            if (storageError) {
              console.warn('⚠️ Failed to delete audio file (non-fatal):', storageError);
            } else {
              console.log('✅ Audio file deleted');
            }
          }
        } catch (storageError) {
          console.warn('⚠️ Failed to delete audio file (non-fatal):', storageError);
        }
      }

      // Update snapshot counts and reload calibration data for live testing
      loadSnapshotCounts();
      await loadAllCalibrations(); // Refresh data used by live testing

      console.log('✅ Snapshot deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting snapshot:', error);
      // Restore snapshot on error
      setSnapshots(snapshots);
      alert(`Failed to delete snapshot: ${error instanceof Error ? error.message : 'Unknown error'}\nCheck console for details.`);
    }
  };

  return (
    <div className="mt-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white text-center mb-6" style={{ textShadow: '0 4px 12px rgba(124,179,66,0.8)' }}>
        Snapshot Manager
      </h1>

      {/* Letter Grid */}
      <div className="bg-black/70 rounded-[30px] p-8 mb-6">
        <div className="text-[#d1d5db] text-sm mb-4 text-center">
          Select a letter to view all snapshots (showing all profiles):
        </div>
        <div className="grid grid-cols-9 gap-2 max-w-2xl mx-auto">
          {ALPHABET.map((letter) => {
            const count = snapshotCounts[letter] || 0;
            const isSelected = selectedLetter === letter;

            return (
              <button
                key={letter}
                onClick={() => loadSnapshots(letter)}
                className={`
                  relative w-14 h-14 rounded font-bold text-lg transition-all
                  ${isSelected
                    ? 'bg-[#7CB342] text-white scale-105 shadow-lg'
                    : count > 0
                      ? 'bg-white/20 text-white hover:bg-white/30'
                      : 'bg-white/5 text-gray-500'
                  }
                `}
                disabled={count === 0}
              >
                {letter.toUpperCase()}
                {count > 0 && (
                  <div className="absolute -top-1 -right-1 bg-green-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Testing Panel */}
      {selectedLetter && (
        <div className="bg-black/70 rounded-[30px] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              🎤 Live Testing: Letter &apos;{selectedLetter.toUpperCase()}&apos;
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`px-4 py-2 rounded-lg transition-colors font-bold ${
                  isPaused
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                title={isPaused ? 'Resume detection' : 'Pause detection'}
              >
                {isPaused ? '▶️' : '⏸️'}
              </button>
              <button
                onClick={() => {
                  if (isTesting) stopTesting();
                  setShowCalibrationModal(true);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold"
              >
                + Add Snapshot
              </button>
              {attemptLog.length > 0 && (
                <button
                  onClick={() => setAttemptLog([])}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-bold"
                >
                  Clear Log
                </button>
              )}
              {!isTesting ? (
                <button
                  onClick={startTesting}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold"
                >
                  Start Testing
                </button>
              ) : (
                <button
                  onClick={stopTesting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                >
                  Stop Testing
                </button>
              )}
            </div>
          </div>

          {isTesting && (
            <>
              {/* Live Waveform */}
              <div className="mb-4">
                <div className="text-[#d1d5db] text-sm mb-1">Live Waveform</div>
                <canvas
                  ref={liveWaveformRef}
                  className="w-full h-[100px] bg-black/30 rounded-lg"
                />
              </div>

              {/* Volume Meter */}
              <div className="mb-4">
                <div className="text-[#d1d5db] text-sm mb-1">Volume</div>
                <div className="h-4 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all"
                    style={{ width: `${Math.min(100, (volume / 30) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Margin of Victory Slider */}
              <div className="mb-4 p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#d1d5db] text-sm font-medium">Margin of Victory</span>
                  <span className="text-white font-bold">{marginOfVictory}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={marginOfVictory}
                  onChange={(e) => setMarginOfVictory(Number(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-400
                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2
                    [&::-moz-range-thumb]:border-gray-400"
                />
                <div className="flex justify-between text-[10px] text-[#999] mt-1">
                  <span>Forgiving (0%)</span>
                  <span>Strict (10%)</span>
                </div>
                <div className="text-[10px] text-[#666] mt-1 text-center">
                  Other letters must beat target by this margin to win
                </div>
              </div>

              {/* Attempt Log */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {attemptLog.length === 0 ? (
                  <div className="text-[#999] text-center py-4">
                    Make some sounds to see results...
                  </div>
                ) : (
                  attemptLog.map((entry) => (
                    <AttemptLogCard
                      key={entry.id}
                      entry={entry}
                      onDeleteSnapshot={(snapshot) => deleteSnapshotFromLog(snapshot, entry.culpritSnapshot?.fromLetter || selectedLetter, entry.id)}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {!isTesting && attemptLog.length > 0 && (
            <div className="text-[#999] text-sm text-center">
              {attemptLog.length} attempts recorded. Start testing to continue.
            </div>
          )}
        </div>
      )}

      {/* Snapshots Display */}
      {selectedLetter && (
        <div className="bg-black/70 rounded-[30px] p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              Letter &apos;{selectedLetter.toUpperCase()}&apos; - {snapshots.length} Snapshots
            </h2>
            <button
              onClick={() => setSelectedLetter(null)}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-white text-black font-bold'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              All ({snapshots.length})
            </button>
            <button
              onClick={() => setFilter('positive')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'positive'
                  ? 'bg-green-600 text-white font-bold'
                  : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
              }`}
            >
              ✓ Positive ({snapshots.filter(s => !s.isNegative).length})
            </button>
            <button
              onClick={() => setFilter('negative')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'negative'
                  ? 'bg-red-600 text-white font-bold'
                  : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
              }`}
            >
              ✗ Negative ({snapshots.filter(s => s.isNegative && !s.isGlobalNegative).length})
            </button>
            <button
              onClick={() => setFilter('global')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'global'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30'
              }`}
            >
              🌍 Global ({snapshots.filter(s => s.isGlobalNegative).length})
            </button>
          </div>

          {loading ? (
            <div className="text-center text-[#d1d5db] py-12">Loading snapshots...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center text-[#d1d5db] py-12">No snapshots found for this letter.</div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {snapshots
                .filter(snapshot => {
                  if (filter === 'all') return true;
                  if (filter === 'positive') return !snapshot.isNegative;
                  if (filter === 'negative') return snapshot.isNegative && !snapshot.isGlobalNegative;
                  if (filter === 'global') return snapshot.isGlobalNegative;
                  return true;
                })
                .map((snapshot, idx) => (
                  <SnapshotCard
                    key={`snapshot-${idx}`}
                    snapshot={snapshot}
                    index={idx}
                    onDelete={() => deleteSnapshot(snapshot, idx)}
                    onToggleGlobal={() => toggleGlobalNegative(snapshot, idx)}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Calibration Modal for adding snapshots */}
      {showCalibrationModal && selectedLetter && (
        <CalibrationModal
          letter={selectedLetter}
          variant="admin"
          onClose={async () => {
            setShowCalibrationModal(false);
            // Reload everything after adding snapshot
            await loadAllCalibrations();
            await loadSnapshotCounts();
            if (selectedLetter) {
              await loadSnapshots(selectedLetter);
            }
          }}
          onSuccess={(letter) => {
            console.log(`✅ Added snapshot for ${letter}`);
          }}
        />
      )}
    </div>
  );
}

// Attempt log entry card component
interface AttemptLogCardProps {
  entry: AttemptLogEntry;
  onDeleteSnapshot: (snapshot: any) => void;
}

function AttemptLogCard({ entry, onDeleteSnapshot }: AttemptLogCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const snapshot = entry.culpritSnapshot || entry.matchedSnapshot;

  // Draw waveform when expanded
  useEffect(() => {
    if (!isExpanded || !canvasRef.current || !snapshot?.data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 400;
    canvas.height = 80;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const max = Math.max(...snapshot.data);
    if (max < 1.0) return;

    const normalized = snapshot.data.map((v: number) => v / max);
    const barWidth = canvas.width / normalized.length;

    normalized.forEach((value: number, i: number) => {
      const barHeight = value * canvas.height;
      const hue = (i / normalized.length) * 120 + 100;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    });
  }, [isExpanded, snapshot?.data]);

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(true);
    audioRef.current = new Audio(url);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play().catch(() => setIsPlaying(false));
  };

  const getIcon = () => {
    switch (entry.type) {
      case 'match': return '✅';
      case 'reject_negative': return '🚫';
      case 'reject_other_letter': return '❌';
      default: return '⚪';
    }
  };

  const getBgColor = () => {
    switch (entry.type) {
      case 'match': return 'bg-green-900/30 border-green-600';
      case 'reject_negative': return 'bg-orange-900/30 border-orange-600';
      case 'reject_other_letter': return 'bg-red-900/30 border-red-600';
      default: return 'bg-gray-900/30 border-gray-600';
    }
  };

  const getMessage = () => {
    switch (entry.type) {
      case 'match':
        return `MATCHED at ${entry.targetScore.toFixed(1)}%`;
      case 'reject_negative':
        return `BLOCKED by negative snapshot`;
      case 'reject_other_letter':
        return `"${entry.winningLetter?.toUpperCase()}" won (${entry.winningScore?.toFixed(1)}% vs ${entry.targetScore.toFixed(1)}%)`;
      default:
        return `No strong match (${entry.targetScore.toFixed(1)}%)`;
    }
  };

  // Use sourceLetter (from calibration loading), then fromLetter (for winning letter case), then target
  const snapshotLetter = snapshot?.sourceLetter || entry.culpritSnapshot?.fromLetter || entry.targetLetter;

  return (
    <div className={`${getBgColor()} border-2 rounded-lg p-3 cursor-pointer transition-all hover:brightness-110`}>
      <div
        className="flex items-start justify-between"
        onClick={() => snapshot && setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{getIcon()}</span>
            <span className="text-white font-bold">{getMessage()}</span>
            {snapshot && (
              <span className="text-[#666] text-sm">{isExpanded ? '▼' : '▶'}</span>
            )}
          </div>
          <div className="text-[#999] text-xs">
            {entry.timestamp.toLocaleTimeString()}
            {snapshot && (
              <>
                <span className="ml-2">
                  • Snapshot from &quot;{snapshotLetter.toUpperCase()}&quot;
                  {snapshot.isNegative ? (snapshot.isGlobalNegative ? ' (🌍 global neg)' : ' (negative)') : ' (positive)'}
                </span>
                {snapshot.id && (
                  <span className="ml-2 font-mono">• ID: ...{snapshot.id.slice(-8)}</span>
                )}
                {snapshot.calibrationId && (
                  <span className="ml-2 font-mono text-[#666]">Cal: ...{snapshot.calibrationId.slice(-8)}</span>
                )}
              </>
            )}
          </div>
        </div>

        {snapshot && (
          <div className="flex gap-2 ml-2" onClick={(e) => e.stopPropagation()}>
            {snapshot.audio_url && (
              <button
                onClick={() => playAudio(snapshot.audio_url)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  isPlaying
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40'
                }`}
                title="Play snapshot audio"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
            )}
            <button
              onClick={() => onDeleteSnapshot(snapshot)}
              className="px-3 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors text-sm"
              title="Delete this snapshot"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Expanded waveform */}
      {isExpanded && snapshot?.data && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <canvas ref={canvasRef} className="w-full h-[80px] bg-black/30 rounded" />
          <div className="text-[#666] text-xs mt-2">
            Pattern data: {snapshot.data.length} bins •
            Profile: {snapshot.profileId?.substring(0, 12)}...
          </div>
        </div>
      )}
    </div>
  );
}

// Individual snapshot card component
interface SnapshotCardProps {
  snapshot: {
    data: number[];
    score?: number;
    profileId: string;
    audio_url?: string;
    isNegative?: boolean;
    isGlobalNegative?: boolean;
    id?: string;
    calibrationId?: string;
  };
  index: number;
  onDelete: () => void;
  onToggleGlobal: () => void;
}

function SnapshotCard({ snapshot, index, onDelete, onToggleGlobal }: SnapshotCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !snapshot.data) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth || 300;
    canvas.height = 80;

    // Clear canvas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const max = Math.max(...snapshot.data);
    if (max < 1.0) return;

    // Normalize and draw
    const normalized = snapshot.data.map(v => v / max);
    const barWidth = canvas.width / normalized.length;

    normalized.forEach((value, i) => {
      const barHeight = value * canvas.height;
      const hue = (i / normalized.length) * 120 + 100;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
    });
  }, [snapshot.data]);

  const playAudio = () => {
    if (!snapshot.audio_url) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsPlaying(true);

    // Play the snapshot audio
    audioRef.current = new Audio(snapshot.audio_url);
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.play().catch(err => {
      console.error('Error playing snapshot audio:', err);
      setIsPlaying(false);
    });
  };

  const isNegative = snapshot.isNegative || false;
  const isGlobal = snapshot.isGlobalNegative || false;
  const borderColor = isNegative ? 'border-red-600' : 'border-green-600';
  const bgColor = isNegative ? 'bg-red-900/20' : 'bg-green-900/20';
  const textColor = isNegative ? 'text-red-400' : 'text-green-400';
  const label = isNegative ? (isGlobal ? '🌍 GLOBAL NEGATIVE' : '✗ NEGATIVE') : '✓ POSITIVE';

  return (
    <div className={`${borderColor} ${bgColor} border-2 rounded-lg p-4`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className={`${textColor} text-sm font-bold`}>
            {label} #{index + 1}
          </div>
          <div className="text-[#999] text-xs mt-1">
            Score: {snapshot.score || 0} matches
          </div>
        </div>
        <div className="flex gap-2">
          {snapshot.audio_url && (
            <button
              onClick={playAudio}
              className={`px-3 py-1 rounded transition-colors ${
                isPlaying
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40'
              }`}
              title="Play audio"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          )}
          {isNegative && (
            <button
              onClick={onToggleGlobal}
              className={`px-3 py-1 rounded transition-colors ${
                isGlobal
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/40'
              }`}
              title={isGlobal ? 'Make letter-specific' : 'Make global (applies to all letters)'}
            >
              {isGlobal ? '🌍' : '⭕'}
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-3 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
            title="Delete snapshot"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Snapshot Info */}
      <div className="text-[#999] text-xs mb-3 space-y-1">
        {snapshot.id && (
          <div>ID: <span className="font-mono">...{snapshot.id.slice(-8)}</span></div>
        )}
        <div>Profile: <span className="font-mono">...{snapshot.profileId.slice(-12)}</span></div>
      </div>

      {/* Pattern Visualization */}
      <canvas ref={canvasRef} className="w-full h-[80px] bg-black/30 rounded" />
    </div>
  );
}
