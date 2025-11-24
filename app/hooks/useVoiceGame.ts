'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, calculateVolume, calculateEnergyConcentration, isNasal, isLiquid } from '@/app/utils/fftAnalysis';
import { strategy11_simpleSnapshot, getLastMatchInfo } from '@/app/utils/patternMatching';
import { startNewScoringRound, setCalibrationDataRef, incrementSnapshotScore, flushAllPendingScores } from '@/app/utils/snapshotScoring';
import { addPositivePattern } from '@/app/utils/positiveSnapshot';
import { addNegativePattern } from '@/app/utils/negativeSnapshot';
import { uploadSnapshotAudio } from '@/app/utils/snapshotAudioUpload';
import { createSimpleAudioCapture, type SimpleAudioCapture } from '@/app/utils/simpleAudioCapture';
import { supabase } from '@/app/lib/supabase';
import { MATCH_THRESHOLD } from '@/app/lib/constants';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';

export interface VoiceGameState {
  isActive: boolean;
  isMuted: boolean;
  volume: number;
  concentration: number;
  calibrationData: Record<string, CalibrationData>;
  currentPattern: number[] | null;
  currentLetter: string | null;
}

export interface VoiceGameActions {
  startGame: (letter: string) => Promise<void>;
  stopGame: () => void;
  setMuted: (muted: boolean) => void;
  loadCalibrations: () => Promise<Record<string, CalibrationData>>;
  handleManualCorrect: (profileId: string) => Promise<{ success: boolean; message: string }>;
  handleManualIncorrect: (profileId: string) => Promise<{ success: boolean; message: string }>;
}

export function useVoiceGame(
  onSuccess: (letter: string, matchedSnapshot: any, similarity: number) => void,
  onNegativeRejection?: (negativeScore: number, positiveScore: number) => void
) {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [concentration, setConcentration] = useState(0);
  const [calibrationData, setCalibrationData] = useState<Record<string, CalibrationData>>({});
  const [currentPattern, setCurrentPattern] = useState<number[] | null>(null);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);

  const audioStateRef = useRef<AudioEngineState | null>(null);
  const audioCaptureRef = useRef<SimpleAudioCapture | null>(null);
  const lastCapturedAudioRef = useRef<Blob | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const currentLetterRef = useRef<string | null>(null);
  const patternBufferRef = useRef<number[][]>([]);
  const calibrationDataRef = useRef<Record<string, CalibrationData>>({});

  // Keep refs in sync with state (ensures detection loop always has fresh data)
  useEffect(() => {
    calibrationDataRef.current = calibrationData;
  }, [calibrationData]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Load calibration data (cross-profile pooling for better accuracy)
  const loadCalibrations = useCallback(async (): Promise<Record<string, CalibrationData>> => {
    try {
      // Load ALL calibrations (cross-profile pooling) - same as admin/practice page
      console.log('🔍 Loading ALL calibrations (cross-profile pooling)');
      const { data, error } = await supabase.from('calibrations').select('*');
      if (error) throw error;

      const calibrations: Record<string, CalibrationData> = {};
      data?.forEach((cal) => {
        const letter = cal.letter.toLowerCase();
        if (!calibrations[letter]) {
          calibrations[letter] = { snapshots: [] };
        }
        if (cal.pattern_data?.snapshots) {
          calibrations[letter].snapshots.push(...cal.pattern_data.snapshots);
        }
      });
      setCalibrationData(calibrations);
      setCalibrationDataRef(calibrations);
      console.log('✅ Loaded calibrations for', Object.keys(calibrations).length, 'letters:', Object.keys(calibrations).join(', '));
      return calibrations;
    } catch (error) {
      console.error('Error loading calibrations:', error);
      return {};
    }
  }, []);

  // Voice detection loop
  const startVoiceDetection = useCallback((targetLetter: string) => {
    let frameCount = 0;
    let lastMatchTime = 0;
    const MATCH_COOLDOWN = 1500; // 1.5 seconds between matches

    const detectVoice = () => {
      const audioState = audioStateRef.current;
      if (!isActiveRef.current || !audioState || !audioState.analyser || !audioState.dataArray) {
        return;
      }

      getFrequencyData(audioState.analyser, audioState.dataArray);
      const vol = calculateVolume(audioState.dataArray);
      const downsampled = downsampleTo64Bins(audioState.dataArray);
      const conc = calculateEnergyConcentration(downsampled);

      // Update UI
      setVolume(vol);
      setConcentration(conc);
      setCurrentPattern(downsampled);

      // Debug logging every 60 frames (~1 second)
      if (frameCount % 60 === 0) {
        console.log(`🎤 Vol: ${vol.toFixed(1)}, Conc: ${conc.toFixed(2)}, Buffer: ${patternBufferRef.current.length}`);
      }
      frameCount++;

      patternBufferRef.current.push(downsampled);
      if (patternBufferRef.current.length > 30) {
        patternBufferRef.current.shift();
      }

      // Skip pattern matching if muted (e.g., during video playback)
      if (isMutedRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectVoice);
        return;
      }

      // Check for match - EXACT SAME LOGIC AS PLAY PAGE
      if (patternBufferRef.current.length >= 10) {
        const volumeThreshold = isNasal(targetLetter) ? 2 : (isLiquid(targetLetter) ? 6 : 15);
        const concentrationThreshold = isNasal(targetLetter) ? 1.2 : (isLiquid(targetLetter) ? 1.0 : 2.0);

        // Check cooldown to prevent rapid repeated matches of the same sustained sound
        const timeSinceLastMatch = Date.now() - lastMatchTime;
        if (timeSinceLastMatch < MATCH_COOLDOWN) {
          // Too soon after last match, skip this check
          animationFrameRef.current = requestAnimationFrame(detectVoice);
          return;
        }

        if (vol > volumeThreshold && conc > concentrationThreshold) {
          console.log(`🎯 TRIGGERING MATCH CHECK - Letter: ${targetLetter}, Vol: ${vol.toFixed(1)}, Conc: ${conc.toFixed(1)}`);

          // Capture audio for snapshot (records 1 second starting NOW)
          if (audioCaptureRef.current && !audioCaptureRef.current.isRecording) {
            audioCaptureRef.current.captureAudio().then(blob => {
              if (blob) {
                lastCapturedAudioRef.current = blob;
                console.log('🎤 Audio captured for snapshot:', blob.size, 'bytes');
              }
            });
          }

          const result = strategy11_simpleSnapshot(patternBufferRef.current, targetLetter, calibrationDataRef.current);
          const matchInfo = getLastMatchInfo();

          console.log(`📊 Match check - predicted: ${result.predictedLetter}, target: ${targetLetter}, score: ${result.score}, matchType: ${matchInfo?.matchType}`);

          // Check for negative rejection (call callback for visual feedback)
          if (matchInfo && matchInfo.matchType === 'rejected') {
            console.log(`🚫 NEGATIVE REJECTION: negative=${matchInfo.negativeScore}, positive=${matchInfo.positiveScore}`);
            if (onNegativeRejection) {
              onNegativeRejection(matchInfo.negativeScore || 0, matchInfo.positiveScore || 0);
            }
          }

          // Check if predicted letter matches target and score is above threshold (case-insensitive)
          const predictedMatch = result.predictedLetter.toLowerCase() === targetLetter.toLowerCase();
          console.log(`🔍 Match conditions - matchType: ${matchInfo?.matchType}, predictedMatch: ${predictedMatch} (${result.predictedLetter} vs ${targetLetter}), score: ${result.score} > ${MATCH_THRESHOLD}`);

          if (matchInfo && matchInfo.matchType === 'accepted' && predictedMatch && result.score > MATCH_THRESHOLD) {
            console.log(`✅ MATCH ACCEPTED!`);
            // Update match timestamp to start cooldown
            lastMatchTime = Date.now();
            // Stop detection before calling success
            setIsActive(false);
            isActiveRef.current = false;
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            // Increment snapshot score
            if (matchInfo.positiveSnapshot) {
              incrementSnapshotScore(targetLetter, matchInfo.positiveSnapshot, calibrationDataRef.current);
            }
            // Call success callback
            onSuccess(targetLetter, matchInfo.positiveSnapshot, matchInfo.positiveScore);
            return;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectVoice);
    };

    detectVoice();
  }, [calibrationData, onSuccess, onNegativeRejection]);

  // Start game
  const startGame = useCallback(async (letter: string) => {
    if (!calibrationData[letter]) {
      console.error(`No calibration data for letter "${letter}"`);
      throw new Error(`Please calibrate letter "${letter}" first!`);
    }

    try {
      // Setup audio ONLY if it doesn't exist (reuse across letters like /practice does)
      if (!audioStateRef.current) {
        audioStateRef.current = await setupAudio();
        console.log('🎤 Audio state created');
      } else {
        console.log('🎤 Reusing existing audio state');
      }

      // Setup simple audio capture for snapshot recording
      if (!audioCaptureRef.current && audioStateRef.current?.stream) {
        try {
          audioCaptureRef.current = createSimpleAudioCapture(audioStateRef.current.stream);
          console.log('🎤 Audio capture ready');
        } catch (err) {
          console.error('Failed to setup audio capture:', err);
        }
      }

      setIsActive(true);
      isActiveRef.current = true;
      setCurrentLetter(letter);
      currentLetterRef.current = letter;
      await startNewScoringRound(letter, calibrationData);
      patternBufferRef.current = [];
      startVoiceDetection(letter);
    } catch (err) {
      console.error('Failed to setup audio:', err);
      throw err;
    }
  }, [calibrationData, startVoiceDetection]);

  // Stop game
  const stopGame = useCallback(() => {
    setIsActive(false);
    isActiveRef.current = false;
    setCurrentLetter(null);
    currentLetterRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioStateRef.current) {
      stopAudio(audioStateRef.current);
      audioStateRef.current = null;
    }
    patternBufferRef.current = [];

    // Flush any pending score saves when stopping
    flushAllPendingScores(calibrationDataRef.current).catch(err => {
      console.error('Failed to flush scores on stop:', err);
    });
  }, []);

  // Manual override: Mark current sound as CORRECT (IS X button)
  const handleManualCorrect = useCallback(async (profileId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentLetterRef.current || !currentPattern || !profileId || !audioCaptureRef.current) {
      console.error('❌ Missing required data:', {
        letter: currentLetterRef.current,
        hasPattern: !!currentPattern,
        profileId,
        hasAudioCapture: !!audioCaptureRef.current
      });
      return { success: false, message: 'Missing required data for manual override' };
    }

    const letter = currentLetterRef.current;
    console.log(`✅ User confirmed: IS ${letter} - capturing audio NOW...`);

    // Capture audio RIGHT NOW (records 1 second starting from this moment)
    const audioBlob = await audioCaptureRef.current.captureAudio();
    console.log(`🎤 Audio blob captured:`, audioBlob ? `${audioBlob.size} bytes` : 'NULL');

    // Upload audio if captured
    let audioUrl: string | undefined;
    if (audioBlob) {
      try {
        console.log(`📤 Uploading audio to Supabase...`);
        audioUrl = await uploadSnapshotAudio(
          audioBlob,
          profileId,
          letter,
          false // positive snapshot
        ) || undefined;
        console.log(`✅ Audio uploaded:`, audioUrl || 'NO URL RETURNED');
      } catch (error) {
        console.error('❌ Error uploading snapshot audio:', error);
      }
    } else {
      console.warn('⚠️ No audio blob captured - snapshot will be saved without audio');
    }

    // Create positive snapshot with immediate save (reuse existing utility)
    console.log(`💾 Creating positive snapshot for ${letter}...`);
    const result = await addPositivePattern(letter, currentPattern, profileId, calibrationData, audioUrl, true);
    console.log(`📊 addPositivePattern result:`, result);

    // Update React state and restart scoring round with mutated data
    if (result.success) {
      // addPositivePattern mutates calibrationData, so we need to update React state
      // to trigger re-render and update the useCallback dependency
      const updatedData = {...calibrationData};
      setCalibrationData(updatedData);
      setCalibrationDataRef(updatedData); // Use the new object, not the old one!
      console.log(`📥 Updated state, ${letter} now has ${updatedData[letter]?.snapshots?.length || 0} snapshots`);

      // Restart scoring round with updated calibration data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, updatedData);
        console.log('✅ Scoring round restarted with new snapshot');
      }
    } else {
      console.error('❌ Failed to create positive snapshot:', result.message);
    }

    return result;
  }, [currentPattern, calibrationData, loadCalibrations]);

  // Manual override: Mark last sound as INCORRECT (NOT X button)
  const handleManualIncorrect = useCallback(async (profileId: string): Promise<{ success: boolean; message: string }> => {
    if (!currentLetterRef.current || !currentPattern || !profileId) {
      return { success: false, message: 'Missing required data for manual override' };
    }

    const letter = currentLetterRef.current;

    // Upload audio if we have it (from automatic detection)
    let audioUrl: string | undefined;
    if (lastCapturedAudioRef.current) {
      try {
        audioUrl = await uploadSnapshotAudio(
          lastCapturedAudioRef.current,
          profileId,
          letter,
          true // negative snapshot
        ) || undefined;

        // Clear the captured audio
        lastCapturedAudioRef.current = null;
      } catch (error) {
        console.error('❌ Error uploading snapshot audio:', error);
      }
    }

    // Create negative snapshot with immediate save (reuse existing utility)
    const result = await addNegativePattern(letter, currentPattern, profileId, calibrationData, audioUrl, true);

    // Update React state and restart scoring round with mutated data
    if (result.success) {
      // addNegativePattern mutates calibrationData, so we need to update React state
      const updatedData = {...calibrationData};
      setCalibrationData(updatedData);
      setCalibrationDataRef(updatedData); // Use the new object, not the old one!
      console.log(`📥 Updated state with new negative snapshot for ${letter}`);

      // Restart scoring round with updated calibration data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, updatedData);
        console.log('✅ Scoring round restarted with new negative snapshot');
      }
    }

    return result;
  }, [currentPattern, calibrationData, loadCalibrations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioStateRef.current) {
        stopAudio(audioStateRef.current);
      }
      // Flush any pending score saves before unmounting
      flushAllPendingScores(calibrationDataRef.current).catch(err => {
        console.error('Failed to flush scores on unmount:', err);
      });
    };
  }, []);

  // Mute/unmute voice detection (e.g., during video playback)
  const setMuted = useCallback((muted: boolean) => {
    console.log(`🔇 Voice detection ${muted ? 'MUTED' : 'UNMUTED'}`);
    setIsMuted(muted);
  }, []);

  return {
    state: {
      isActive,
      isMuted,
      volume,
      concentration,
      calibrationData,
      currentPattern,
      currentLetter,
    },
    actions: {
      startGame,
      stopGame,
      setMuted,
      loadCalibrations,
      handleManualCorrect,
      handleManualIncorrect,
    },
  };
}
