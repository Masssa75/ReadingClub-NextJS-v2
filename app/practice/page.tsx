'use client';

import { useState, useEffect, useRef } from 'react';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { useSession } from '@/app/hooks/useSession';
import { useProficiency } from '@/app/hooks/useProficiency';
import { setupAudio, stopAudio } from '@/app/utils/audioEngine';
import { getFrequencyData, downsampleTo64Bins, calculateVolume, calculateEnergyConcentration, isNasal } from '@/app/utils/fftAnalysis';
import { selectNextLetter } from '@/app/utils/adaptiveSelection';
import { strategy11_simpleSnapshot, getLastMatchInfo } from '@/app/utils/patternMatching';
import { incrementSnapshotScore, startNewScoringRound, setCalibrationDataRef, flushAllPendingScores } from '@/app/utils/snapshotScoring';
import { addNegativePattern } from '@/app/utils/negativeSnapshot';
import { addPositivePattern } from '@/app/utils/positiveSnapshot';
import { uploadSnapshotAudio } from '@/app/utils/snapshotAudioUpload';
import { createSimpleAudioCapture, type SimpleAudioCapture } from '@/app/utils/simpleAudioCapture';
import { supabase } from '@/app/lib/supabase';
import { PHONEMES } from '@/app/lib/constants';
import type { AudioEngineState, CalibrationData } from '@/app/lib/types';
import PatternVisualization from '@/app/components/PatternVisualization';
import ThresholdMeters from '@/app/components/ThresholdMeters';
import SuccessCelebration from '@/app/components/SuccessCelebration';

export default function PlayPage() {
  const { currentProfileId, isLoading: profileLoading } = useProfileContext();
  const { currentSession, recordAttempt, getSession } = useSession(currentProfileId);
  const { proficiencies } = useProficiency(currentProfileId);

  // Game state
  const [isRunning, setIsRunning] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Click Start to begin');
  const [showCelebration, setShowCelebration] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [waitingForNext, setWaitingForNext] = useState(false); // Waiting for "Next Letter" click

  // Voice detection state
  const [volume, setVolume] = useState(0);
  const [concentration, setConcentration] = useState(0);
  const [currentPattern, setCurrentPattern] = useState<number[] | null>(null);

  // Negative snapshot button state
  const [showNotXButton, setShowNotXButton] = useState(false);
  const [notXLetter, setNotXLetter] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Calibration data
  const [calibrationData, setCalibrationData] = useState<Record<string, CalibrationData>>({});

  // Audio state
  const audioStateRef = useRef<AudioEngineState | null>(null);
  const audioCaptureRef = useRef<SimpleAudioCapture | null>(null);
  const lastCapturedAudioRef = useRef<Blob | null>(null);
  const patternBufferRef = useRef<number[][]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const listenClickedThisRound = useRef(false);
  const notXButtonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(false); // Ref for voice detection loop (avoids closure bug)
  const currentLetterRef = useRef<string | null>(null); // Ref for current letter (avoids state timing issues)

  // Load calibrations on mount (matches /play behavior)
  useEffect(() => {
    loadCalibrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush pending saves when page is about to unload (refresh, close tab, navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Synchronously flush all pending saves before page unloads
      // Note: This must be synchronous to work in beforeunload
      flushAllPendingScores(calibrationData);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also flush when component unmounts
      flushAllPendingScores(calibrationData);
    };
  }, [calibrationData]);

  const loadCalibrations = async (): Promise<Record<string, CalibrationData>> => {
    try {
      // Load ALL calibrations (cross-profile pooling)
      const { data, error } = await supabase
        .from('calibrations')
        .select('*');

      if (error) throw error;

      const calibrations: Record<string, CalibrationData> = {};
      data?.forEach((cal) => {
        // Normalize letter to lowercase for consistent key access
        const letter = cal.letter.toLowerCase();
        if (!calibrations[letter]) {
          calibrations[letter] = { snapshots: [] };
        }
        if (cal.pattern_data?.snapshots) {
          calibrations[letter].snapshots.push(...cal.pattern_data.snapshots);
        }
      });

      setCalibrationData(calibrations);
      setCalibrationDataRef(calibrations); // Set reference for snapshot scoring
      console.log('✅ Loaded calibrations for', Object.keys(calibrations).length, 'letters:', Object.keys(calibrations).join(', '));
      return calibrations;
    } catch (error) {
      console.error('Error loading calibrations:', error);
      return {};
    }
  };

  // Start/Stop game
  const toggleGame = async () => {
    if (waitingForNext) {
      // "Next Letter" - advance to next letter and resume (HTML version behavior)
      setWaitingForNext(false);
      setShowCelebration(false);
      setIsRunning(true);
      isRunningRef.current = true;
      patternBufferRef.current = []; // Clear old patterns from previous letter
      pickNextLetter();
      startVoiceDetection();
    } else if (isRunning) {
      // Stop game
      setIsRunning(false);
      isRunningRef.current = false;
      setStatusMessage('Stopped');
      setCurrentLetter(null);
      setWaitingForNext(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioCaptureRef.current) {
        audioCaptureRef.current = null;
      }
      if (audioStateRef.current) {
        stopAudio(audioStateRef.current);
        audioStateRef.current = null;
      }
    } else {
      // Start game
      if (Object.keys(calibrationData).length === 0) {
        alert('Please calibrate at least one letter first!');
        return;
      }

      // Setup audio
      if (!audioStateRef.current) {
        try {
          audioStateRef.current = await setupAudio();
        } catch (err) {
          console.error('Failed to setup audio:', err);
          alert('Microphone access denied');
          return;
        }
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

      setIsRunning(true);
      isRunningRef.current = true; // Set ref for voice detection loop
      await pickNextLetter();
      startVoiceDetection();
    }
  };

  // Pick next letter using adaptive selection
  const pickNextLetter = async () => {
    const calibratedLetters = Object.keys(calibrationData);
    if (calibratedLetters.length === 0) {
      setStatusMessage('No calibrated letters');
      return;
    }

    const session = getSession();
    if (!session) {
      // Fallback: random letter
      const randomLetter = calibratedLetters[Math.floor(Math.random() * calibratedLetters.length)];
      setCurrentLetter(randomLetter);
      currentLetterRef.current = randomLetter; // Set ref immediately
      await startNewScoringRound(randomLetter, calibrationData);
      setStatusMessage(`Say: ${randomLetter}`);
      listenClickedThisRound.current = false;
      return;
    }

    // Use adaptive selection (correct parameter order: session, proficiencies, calibratedLetters)
    const nextLetter = selectNextLetter(session, proficiencies, calibratedLetters);

    if (nextLetter) {
      setCurrentLetter(nextLetter);
      currentLetterRef.current = nextLetter; // Set ref immediately for voice detection
      await startNewScoringRound(nextLetter, calibrationData);
      setStatusMessage(`Say: ${nextLetter}`);
      listenClickedThisRound.current = false;
    } else {
      setStatusMessage('All letters mastered!');
      setIsRunning(false);
      isRunningRef.current = false;
    }
  };

  // Voice detection loop
  const startVoiceDetection = () => {
    let frameCount = 0; // Debug counter
    const detectVoice = () => {
      const audioState = audioStateRef.current;
      if (!isRunningRef.current || !audioState || !audioState.analyser || !audioState.dataArray) {
        console.log('⚠️ Detection loop stopped - isRunning:', isRunningRef.current, 'audioState:', !!audioState);
        return;
      }

      getFrequencyData(audioState.analyser, audioState.dataArray);

      // Calculate voice metrics
      const vol = calculateVolume(audioState.dataArray);
      const downsampled = downsampleTo64Bins(audioState.dataArray);
      const conc = calculateEnergyConcentration(downsampled);

      // Debug logging every 60 frames (~1 second)
      if (frameCount % 60 === 0) {
        console.log(`🎤 Voice detection active - Volume: ${vol.toFixed(1)}, Concentration: ${conc.toFixed(2)}`);
      }
      frameCount++;

      setVolume(vol);
      setConcentration(conc);
      setCurrentPattern(downsampled);

      // Add to pattern buffer
      patternBufferRef.current.push(downsampled);
      if (patternBufferRef.current.length > 30) {
        patternBufferRef.current.shift();
      }

      // Check for match (use ref instead of state to avoid timing issues)
      const letter = currentLetterRef.current;
      if (letter && patternBufferRef.current.length >= 10) {
        const volumeThreshold = isNasal(letter) ? 3 : 12;
        const concentrationThreshold = isNasal(letter) ? 1.2 : 2.0;

        if (vol > volumeThreshold && conc > concentrationThreshold) {
          console.log(`🎯 TRIGGERING MATCH CHECK - Letter: ${letter}, Vol: ${vol.toFixed(1)}, Conc: ${conc.toFixed(1)}, Buffer: ${patternBufferRef.current.length}`);

          // Capture audio for snapshot (records 1 second starting NOW)
          if (audioCaptureRef.current && !audioCaptureRef.current.isRecording) {
            audioCaptureRef.current.captureAudio().then(blob => {
              if (blob) {
                lastCapturedAudioRef.current = blob;
                console.log('🎤 Audio captured for snapshot:', blob.size, 'bytes');
              }
            });
          }

          checkForMatch();
        } else if (vol > volumeThreshold * 0.5 || conc > concentrationThreshold * 0.5) {
          // Debug: show why we're not matching
          if (frameCount % 60 === 0) {
            console.log(`🔍 Not matching - Letter: ${letter}, Vol: ${vol.toFixed(1)}/${volumeThreshold} (${vol > volumeThreshold ? '✓' : '✗'}), Conc: ${conc.toFixed(1)}/${concentrationThreshold} (${conc > concentrationThreshold ? '✓' : '✗'})`);
          }
        }
      } else if (frameCount % 60 === 0) {
        // Debug: show why we're not checking at all
        console.log(`⏸️ Not checking - Letter: ${letter || 'null'}, Buffer length: ${patternBufferRef.current.length}/10`);
      }

      animationFrameRef.current = requestAnimationFrame(detectVoice);
    };

    detectVoice();
  };

  // Check if pattern matches current letter
  const checkForMatch = () => {
    const letter = currentLetterRef.current; // Use ref instead of state
    if (!letter) {
      console.log('⚠️ checkForMatch called but letter is null');
      return;
    }

    const result = strategy11_simpleSnapshot(patternBufferRef.current, letter, calibrationData);
    const matchInfo = getLastMatchInfo(); // Get detailed match info

    console.log(`🔍 Match check - predicted: ${result.predictedLetter}, target: ${letter}, score: ${result.score}`);

    // Check if predicted letter matches target and score is above threshold (case-insensitive)
    if (matchInfo && matchInfo.matchType === 'accepted' && result.predictedLetter.toLowerCase() === letter.toLowerCase() && result.score > 60) {
      console.log(`✅ MATCH ACCEPTED! Calling handleSuccess`);
      handleSuccess(matchInfo.positiveSnapshot, matchInfo.positiveScore);
    } else {
      console.log(`❌ Match rejected - matchType: ${matchInfo?.matchType}, predicted: ${result.predictedLetter}, target: ${letter}, score: ${result.score}`);
    }
  };

  // Handle successful match
  const handleSuccess = async (matchedSnapshot: { data: number[]; profileId: string; score: number; isNegative: boolean } | null, similarity: number) => {
    // Use ref instead of state to avoid closure bug
    const letter = currentLetterRef.current;
    console.log('🎉 handleSuccess ENTERED - letter from ref:', letter);

    if (!letter) {
      console.log('❌ handleSuccess early return - letter is null');
      return;
    }

    console.log('🎉 handleSuccess continuing - stopping voice detection');
    setIsRunning(false);
    isRunningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Show celebration
    console.log('🎉 Setting showCelebration to TRUE');
    setShowCelebration(true);
    setStatusMessage(`✓ Correct! You said '${letter}'`);

    // Record attempt
    if (currentSession) {
      recordAttempt(letter, true, listenClickedThisRound.current);
    }

    // Increment snapshot score
    if (matchedSnapshot) {
      incrementSnapshotScore(letter, matchedSnapshot, calibrationData);
    }

    // Upload audio and create positive snapshot (audio should already be captured by now)
    if (currentPattern && currentProfileId) {
      // Try to upload audio immediately (no setTimeout to avoid fast-refresh cancellation)
      let audioUrl: string | undefined;

      if (lastCapturedAudioRef.current) {
        console.log('📦 Found captured audio, uploading now...');
        try {
          audioUrl = await uploadSnapshotAudio(
            lastCapturedAudioRef.current,
            currentProfileId,
            letter,
            false // positive snapshot
          ) || undefined;

          lastCapturedAudioRef.current = null;
        } catch (error) {
          console.error('❌ Error uploading snapshot audio:', error);
        }
      } else {
        console.log('⚠️ No captured audio available (ref is null)');
      }

      // Create positive snapshot (with or without audio) with immediate save
      await addPositivePattern(letter, currentPattern, currentProfileId, calibrationData, audioUrl, true);
      if (audioUrl) {
        console.log('✅ Positive snapshot with audio created');
      } else {
        console.log('⚠️ Positive snapshot created without audio');
      }

      // Update React state with mutated data (no need to reload from DB)
      setCalibrationData({...calibrationData});
      setCalibrationDataRef(calibrationData);
      console.log(`📥 Updated state, ${letter} now has ${calibrationData[letter]?.snapshots?.length || 0} snapshots`);

      // Restart scoring round with updated data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, calibrationData);
        console.log('✅ Scoring round restarted with new snapshot');
      }
    }

    // Show "Not X" button for 5 seconds
    showNotXButtonWithTimeout(letter);

    // Auto-next or wait
    if (autoNext) {
      setTimeout(() => {
        setShowCelebration(false);
        setIsRunning(true);
        isRunningRef.current = true;
        pickNextLetter();
        startVoiceDetection();
      }, 2000);
    } else {
      // Show "Next Letter" button (HTML version behavior)
      setWaitingForNext(true);
    }
  };

  // Show "Not X" button with 5-second timeout
  const showNotXButtonWithTimeout = (letter: string) => {
    setNotXLetter(letter);
    setShowNotXButton(true);
    setFeedbackMessage('');

    if (notXButtonTimeoutRef.current) {
      clearTimeout(notXButtonTimeoutRef.current);
    }

    notXButtonTimeoutRef.current = setTimeout(() => {
      setShowNotXButton(false);
      setNotXLetter(null);
    }, 5000);
  };

  // Handle "Not X" button click
  const handleNotXClick = async () => {
    if (!notXLetter || !currentPattern || !currentProfileId) return;

    // Upload audio if we have it
    let audioUrl: string | undefined;
    if (lastCapturedAudioRef.current) {
      try {
        audioUrl = await uploadSnapshotAudio(
          lastCapturedAudioRef.current,
          currentProfileId,
          notXLetter,
          true // negative snapshot
        ) || undefined;

        // Clear the captured audio
        lastCapturedAudioRef.current = null;
      } catch (error) {
        console.error('❌ Error uploading snapshot audio:', error);
      }
    }

    const result = await addNegativePattern(notXLetter, currentPattern, currentProfileId, calibrationData, audioUrl, true);
    setFeedbackMessage(result.message + ' ✓ Saved');
    setShowNotXButton(false);
    setNotXLetter(null);

    // Update React state with mutated data (no need to reload from DB)
    if (result.success) {
      setCalibrationData({...calibrationData});
      setCalibrationDataRef(calibrationData);
      console.log(`📥 Updated state with new negative snapshot`);

      // Restart scoring round with updated data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, calibrationData);
        console.log('✅ Scoring round restarted with new negative snapshot');
      }
    }

    if (notXButtonTimeoutRef.current) {
      clearTimeout(notXButtonTimeoutRef.current);
    }
  };

  // Skip to next letter
  const handleSkip = () => {
    if (isRunning) {
      pickNextLetter();
      patternBufferRef.current = [];
    }
  };

  // Handle "IS X" button click (manually mark current sound as correct)
  const handleIsXClick = async () => {
    console.log('🔘 IS X button clicked');

    if (!currentLetter || !currentPattern || !currentProfileId || !audioCaptureRef.current) {
      console.error('❌ IS X button - Missing required data:', {
        currentLetter,
        hasPattern: !!currentPattern,
        currentProfileId,
        hasAudioCapture: !!audioCaptureRef.current
      });
      setFeedbackMessage('❌ Missing required data');
      setTimeout(() => setFeedbackMessage(''), 2000);
      return;
    }

    console.log(`✅ User confirmed: IS ${currentLetter} - capturing audio NOW...`);
    setFeedbackMessage('Recording...');

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
          currentProfileId,
          currentLetter,
          false // positive snapshot
        ) || undefined;
        console.log(`✅ Audio uploaded:`, audioUrl || 'NO URL RETURNED');
      } catch (error) {
        console.error('❌ Error uploading snapshot audio:', error);
      }
    } else {
      console.warn('⚠️ No audio blob captured - snapshot will be saved without audio');
    }

    // Create positive snapshot with immediate save
    console.log(`💾 Creating positive snapshot for ${currentLetter}...`);
    const result = await addPositivePattern(currentLetter, currentPattern, currentProfileId, calibrationData, audioUrl, true);
    console.log(`📊 addPositivePattern result:`, result);
    setFeedbackMessage(result.message + ' ✓ Saved');

    // Update React state with mutated data (no need to reload from DB)
    if (result.success) {
      setCalibrationData({...calibrationData});
      setCalibrationDataRef(calibrationData);
      console.log(`📥 Updated state, ${currentLetter} now has ${calibrationData[currentLetter]?.snapshots?.length || 0} snapshots`);

      // Restart scoring round with updated data
      if (currentLetterRef.current) {
        await startNewScoringRound(currentLetterRef.current, calibrationData);
        console.log('✅ Scoring round restarted with new snapshot');
      }
    } else {
      console.error('❌ Failed to create positive snapshot:', result.message);
    }

    // Brief feedback
    setTimeout(() => setFeedbackMessage(''), 2000);
  };

  // Play letter audio (LISTEN button)
  const playLetterAudio = () => {
    if (!currentLetter) return;

    listenClickedThisRound.current = true;
    console.log(`🔊 LISTEN clicked for ${currentLetter}`);

    // Find phoneme audio URL
    const phoneme = PHONEMES.find(p => p.letter === currentLetter);
    if (phoneme?.audioUrl) {
      const audio = new Audio(phoneme.audioUrl);
      audio.play().catch(err => console.error('Audio playback failed:', err));
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioStateRef.current) {
        stopAudio(audioStateRef.current);
      }
      if (notXButtonTimeoutRef.current) {
        clearTimeout(notXButtonTimeoutRef.current);
      }
    };
  }, []);

  if (profileLoading) {
    return <div className="text-center text-gray-400 mt-6">Loading profile...</div>;
  }

  if (!currentProfileId) {
    return <div className="text-center text-gray-400 mt-6">No profile selected</div>;
  }

  const volumeThreshold = currentLetter && isNasal(currentLetter) ? 3 : 12;
  const concentrationThreshold = currentLetter && isNasal(currentLetter) ? 1.2 : 2.0;

  return (
    <div className="mt-6 max-w-4xl mx-auto">
      {/* Controls */}
      <div className="flex justify-center items-center gap-4 mb-5 flex-wrap">
        {/* Auto-next toggle */}
        <label className="text-[#ddd] text-sm cursor-pointer flex items-center gap-2">
          <span className="opacity-80">Auto-next:</span>
          <div className="relative w-11 h-6 bg-white/20 rounded-full transition-colors">
            <input
              type="checkbox"
              checked={autoNext}
              onChange={(e) => setAutoNext(e.target.checked)}
              className="opacity-0 w-0 h-0 absolute"
            />
            <div
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform"
              style={{ transform: autoNext ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </div>
        </label>

        {/* Start/Stop button */}
        <button
          onClick={toggleGame}
          className="px-6 py-2 bg-[#7CB342] text-white rounded-lg hover:bg-[#8BC34A] transition-colors"
        >
          {waitingForNext ? '▶ Next Letter' : isRunning ? '⏸ Stop Game' : '▶ Start Game'}
        </button>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="px-6 py-2 bg-[#999] text-white rounded-lg hover:bg-[#aaa] transition-colors"
          disabled={!isRunning}
        >
          Skip
        </button>

        {/* IS X button - manually mark current sound as correct */}
        {currentLetter && (
          <button
            onClick={handleIsXClick}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
            title="Mark current sound as correct (creates positive snapshot)"
          >
            ✓ IS {currentLetter}
          </button>
        )}

        {/* LISTEN button */}
        {currentLetter && (
          <button
            onClick={playLetterAudio}
            className="px-6 py-2 bg-[#1976D2] text-white rounded-lg hover:bg-[#2196F3] transition-colors"
          >
            🔊 LISTEN
          </button>
        )}
      </div>

      {/* "Not X" Button */}
      {showNotXButton && notXLetter && (
        <div className="text-center mb-5 p-4 bg-white/5 rounded-lg">
          <div className="text-[#ddd] text-sm mb-2">Recognition issue? Train the system:</div>
          <button
            onClick={handleNotXClick}
            className="px-6 py-2 bg-[#f44336] text-white rounded-lg hover:bg-[#ff5722] transition-colors"
          >
            ✗ Not &apos;{notXLetter}&apos;
          </button>
          {feedbackMessage && (
            <div className="text-[#f44336] text-xs mt-2">{feedbackMessage}</div>
          )}
        </div>
      )}

      {/* Big Letter Display */}
      <div className="text-center mb-5">
        <div className="text-[#ddd] text-lg mb-2">Say this sound:</div>
        <div
          className={`text-[180px] font-bold text-[#FDD835] ${showCelebration ? 'success-letter' : ''}`}
          style={{ textShadow: '0 10px 30px rgba(253, 216, 53, 0.5)' }}
        >
          {currentLetter || '?'}
        </div>
      </div>

      {/* Success Celebration */}
      {showCelebration && currentLetter && (
        <SuccessCelebration
          letter={currentLetter}
          onComplete={() => setShowCelebration(false)}
        />
      )}

      {/* Threshold Meters - Keep visible during celebration (matches HTML version) */}
      {(isRunning || showCelebration) && (
        <ThresholdMeters
          volume={volume}
          volumeThreshold={volumeThreshold}
          concentration={concentration}
          concentrationThreshold={concentrationThreshold}
        />
      )}

      {/* Pattern Visualization - Keep visible during celebration (matches HTML version) */}
      {(isRunning || showCelebration) && (
        <PatternVisualization
          currentLetter={currentLetter}
          calibrationData={calibrationData}
          currentPattern={currentPattern}
        />
      )}

      {/* Status Message */}
      <div className="text-center text-[#ddd] text-sm font-mono whitespace-pre-wrap mt-5">
        {statusMessage}
      </div>
    </div>
  );
}
