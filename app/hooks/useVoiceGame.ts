'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, calculateVolume, calculateEnergyConcentration, isNasal } from '@/app/utils/fftAnalysis';
import { strategy11_simpleSnapshot, getLastMatchInfo } from '@/app/utils/patternMatching';
import { startNewScoringRound, setCalibrationDataRef, incrementSnapshotScore } from '@/app/utils/snapshotScoring';
import { supabase } from '@/app/lib/supabase';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';

export interface VoiceGameState {
  isActive: boolean;
  volume: number;
  concentration: number;
  calibrationData: Record<string, CalibrationData>;
}

export interface VoiceGameActions {
  startGame: (letter: string) => Promise<void>;
  stopGame: () => void;
  loadCalibrations: () => Promise<void>;
}

export function useVoiceGame(
  onSuccess: (letter: string, matchedSnapshot: any, similarity: number) => void
) {
  const [isActive, setIsActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [concentration, setConcentration] = useState(0);
  const [calibrationData, setCalibrationData] = useState<Record<string, CalibrationData>>({});

  const audioStateRef = useRef<AudioEngineState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isActiveRef = useRef(false);
  const currentLetterRef = useRef<string | null>(null);
  const patternBufferRef = useRef<number[][]>([]);

  // Load calibration data
  const loadCalibrations = useCallback(async () => {
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
    } catch (error) {
      console.error('Error loading calibrations:', error);
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

          const result = strategy11_simpleSnapshot(patternBufferRef.current, targetLetter, calibrationData);
          const matchInfo = getLastMatchInfo();

          console.log(`📊 Match check - predicted: ${result.predictedLetter}, target: ${targetLetter}, score: ${result.score}, matchType: ${matchInfo?.matchType}`);

          // Check if predicted letter matches target and score is above threshold (case-insensitive)
          if (matchInfo && matchInfo.matchType === 'accepted' && result.predictedLetter.toLowerCase() === targetLetter.toLowerCase() && result.score > 60) {
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
      audioStateRef.current = await setupAudio();
      setIsActive(true);
      isActiveRef.current = true;
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
    },
    actions: {
      startGame,
      stopGame,
      loadCalibrations,
    },
  };
}
