'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, calculateVolume, calculateEnergyConcentration, isNasal } from '@/app/utils/fftAnalysis';
import { strategy11_simpleSnapshot, getLastMatchInfo } from '@/app/utils/patternMatching';
import { startNewScoringRound, setCalibrationDataRef, incrementSnapshotScore } from '@/app/utils/snapshotScoring';
import { addPositivePattern } from '@/app/utils/positiveSnapshot';
import { addNegativePattern } from '@/app/utils/negativeSnapshot';
import { uploadSnapshotAudio } from '@/app/utils/snapshotAudioUpload';
import { createSimpleAudioCapture, type SimpleAudioCapture } from '@/app/utils/simpleAudioCapture';
import { supabase } from '@/app/lib/supabase';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';

export interface VoiceGameState {
  isActive: boolean;
  volume: number;
  concentration: number;
  calibrationData: Record<string, CalibrationData>;
  currentPattern: number[] | null;
  currentLetter: string | null;
}

export interface VoiceGameActions {
  startGame: (letter: string) => Promise<void>;
  stopGame: () => void;
  loadCalibrations: () => Promise<Record<string, CalibrationData>>;
  handleManualCorrect: (profileId: string) => Promise<{ success: boolean; message: string }>;
  handleManualIncorrect: (profileId: string) => Promise<{ success: boolean; message: string }>;
}

export function useVoiceGame(
  onSuccess: (letter: string, matchedSnapshot: any, similarity: number) => void
) {
  const [isActive, setIsActive] = useState(false);
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
  const currentLetterRef = useRef<string | null>(null);
  const patternBufferRef = useRef<number[][]>([]);

  // Load calibration data
  const loadCalibrations = useCallback(async (): Promise<Record<string, CalibrationData>> => {
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

      // Check for match - EXACT SAME LOGIC AS PLAY PAGE
      if (patternBufferRef.current.length >= 10) {
        const volumeThreshold = isNasal(targetLetter) ? 3 : 12;
        const concentrationThreshold = isNasal(targetLetter) ? 1.2 : 2.0;

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

          const result = strategy11_simpleSnapshot(patternBufferRef.current, targetLetter, calibrationData);
          const matchInfo = getLastMatchInfo();

          console.log(`📊 Match check - predicted: ${result.predictedLetter}, target: ${targetLetter}, score: ${result.score}, matchType: ${matchInfo?.matchType}`);

          // Check if predicted letter matches target and score is above threshold (case-insensitive)
          const predictedMatch = result.predictedLetter.toLowerCase() === targetLetter.toLowerCase();
          console.log(`🔍 Match conditions - matchType: ${matchInfo?.matchType}, predictedMatch: ${predictedMatch} (${result.predictedLetter} vs ${targetLetter}), score: ${result.score} > 60`);

          if (matchInfo && matchInfo.matchType === 'accepted' && predictedMatch && result.score > 60) {
            console.log(`✅ MATCH ACCEPTED!`);
            // Stop detection before calling success
            setIsActive(false);
            isActiveRef.current = false;
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
            }
            // Increment snapshot score
            if (matchInfo.positiveSnapshot) {
              incrementSnapshotScore(targetLetter, matchInfo.positiveSnapshot, calibrationData);
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
  }, [calibrationData, onSuccess]);

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
      setCalibrationData({...calibrationData});
      setCalibrationDataRef(calibrationData);
      console.log(`📥 Updated state, ${letter} now has ${calibrationData[letter]?.snapshots?.length || 0} snapshots`);

      // Restart scoring round with updated calibration data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, calibrationData);
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
      setCalibrationData({...calibrationData});
      setCalibrationDataRef(calibrationData);
      console.log(`📥 Updated state with new negative snapshot for ${letter}`);

      // Restart scoring round with updated calibration data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, calibrationData);
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
    };
  }, []);

  return {
    state: {
      isActive,
      volume,
      concentration,
      calibrationData,
      currentPattern,
      currentLetter,
    },
    actions: {
      startGame,
      stopGame,
      loadCalibrations,
      handleManualCorrect,
      handleManualIncorrect,
    },
  };
}
