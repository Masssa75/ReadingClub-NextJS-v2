'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import { useProficiency } from '@/app/hooks/useProficiency';
import { LetterProficiency } from '@/app/lib/types';
import SuccessCelebration from '@/app/components/SuccessCelebration';
import CalibrationModal from '@/app/components/CalibrationModal';
import ParentsMenu from '@/app/components/ParentsMenu';
import MicrophonePermission from '@/app/components/MicrophonePermission';
import { supabase } from '@/app/lib/supabase';
import { addNegativePattern } from '@/app/utils/negativeSnapshot';
import { uploadSnapshotAudio } from '@/app/utils/snapshotAudioUpload';

// Audio delay based on proficiency level (in ms)
const PROFICIENCY_AUDIO_DELAYS: Record<number, number> = {
  [LetterProficiency.UNKNOWN]: 0,      // Immediate - learning
  [LetterProficiency.SOMETIMES]: 1000, // 1 second - building confidence
  [LetterProficiency.KNOWN]: 2000,     // 2 seconds - testing recall
  [LetterProficiency.MASTERED]: 3000,  // 3 seconds - independent mastery
};

// Letter sequences
const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Available reward videos (pick randomly from this pool)
const REWARD_VIDEOS = [
  '/Videos/a-Apple2.mp4',
  '/Videos/Bear.mp4',
  '/Videos/e.mp4',
  '/Videos/Funny_F_Sound_Video_Generation.mp4',
];

// Video reward settings
const MIN_LETTERS_BEFORE_VIDEO = 5; // At least 5 letters must pass before a video can play
const VIDEO_CHANCE_BEAT_CLOCK = 0.5; // 50% chance when they beat the audio
const VIDEO_CHANCE_REGULAR = 0.1; // 10% chance on regular success
const VIDEO_LOAD_TIMEOUT = 5000; // 5 seconds timeout for video to start playing

// Record cycle completion to Supabase
async function recordCycleCompletion(
  profileId: string,
  level: number,
  durationSeconds: number,
  lettersSkipped: number
) {
  try {
    // First, try to get existing progress for this profile/level
    const { data: existing, error: fetchError } = await supabase
      .from('level_progress')
      .select('*')
      .eq('profile_id', profileId)
      .eq('level', level)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine for first cycle
      console.error('Error fetching level progress:', fetchError);
      return;
    }

    if (existing) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('level_progress')
        .update({
          cycles_completed: existing.cycles_completed + 1,
          last_cycle_at: new Date().toISOString(),
          total_time_seconds: existing.total_time_seconds + durationSeconds,
          letters_skipped: existing.letters_skipped + lettersSkipped,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating level progress:', updateError);
      } else {
        console.log(`📊 Cycle ${existing.cycles_completed + 1} recorded for level ${level}`);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('level_progress')
        .insert({
          profile_id: profileId,
          level,
          cycles_completed: 1,
          last_cycle_at: new Date().toISOString(),
          total_time_seconds: durationSeconds,
          letters_skipped: lettersSkipped,
        });

      if (insertError) {
        console.error('Error inserting level progress:', insertError);
      } else {
        console.log(`📊 First cycle recorded for level ${level}`);
      }
    }
  } catch (err) {
    console.error('Error recording cycle:', err);
  }
}

function FlashcardPage() {
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isButtonPressed, setIsButtonPressed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [negativeRejections, setNegativeRejections] = useState<Array<{
    id: number;
    negativeScore: number;
    positiveScore: number;
    snapshot: any;
    timestamp: number;
  }>>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [lastMatchedLetter, setLastMatchedLetter] = useState<string | null>(null);
  const [lastMatchedSnapshot, setLastMatchedSnapshot] = useState<any | null>(null);
  const [lastMatchedPattern, setLastMatchedPattern] = useState<number[] | null>(null); // Pattern that triggered the match
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [vowelsOnly, setVowelsOnly] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [marginOfVictory, setMarginOfVictory] = useState(0.5); // 0-1% range, 0.1% steps

  // Video reward system state
  const [lettersSinceVideo, setLettersSinceVideo] = useState(0);
  const [showVideoReward, setShowVideoReward] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoNeedsTap, setVideoNeedsTap] = useState(false); // For autoplay failure fallback
  const [videosPreloaded, setVideosPreloaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadedVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const rejectionIdRef = useRef(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Cycle tracking refs
  const cycleStartTimeRef = useRef<number | null>(null);
  const skipsInCycleRef = useRef(0);

  const { currentProfileId, isLoading: profileLoading } = useProfileContext();

  // Proficiency tracking for audio delay progression (Leitner system)
  const { proficiencies, getProficiency, updateProficiency } = useProficiency(currentProfileId);

  // Track if audio has played for current letter (for "beat the audio" detection)
  const [audioPlayedForLetter, setAudioPlayedForLetter] = useState(false);
  const audioPlayedRef = useRef(false); // Ref for accurate checking in callbacks
  const [beatTheAudio, setBeatTheAudio] = useState(false);
  const audioDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [audioDelay, setAudioDelay] = useState(0); // Current delay for countdown display
  const [countdownProgress, setCountdownProgress] = useState(0); // 0-100 for visual countdown

  // Handle negative rejection (show visual feedback with snapshot details)
  const handleNegativeRejection = (negativeScore: number, positiveScore: number, negativeSnapshot?: any) => {
    console.log(`🚫 Negative rejection: negative=${negativeScore}, positive=${positiveScore}`, negativeSnapshot);

    if (negativeSnapshot) {
      // Deduplicate: check if this snapshot is already showing
      setNegativeRejections(prev => {
        const alreadyExists = prev.some(r => r.snapshot.id === negativeSnapshot.id);
        if (alreadyExists) {
          console.log('⏭️ Skipping duplicate rejection for snapshot:', negativeSnapshot.id);
          return prev; // Don't add duplicate
        }

        const rejectionId = rejectionIdRef.current++;
        const newRejection = {
          id: rejectionId,
          negativeScore,
          positiveScore,
          snapshot: negativeSnapshot,
          timestamp: Date.now(),
        };

        // Auto-remove after 3 seconds
        setTimeout(() => {
          setNegativeRejections(current => current.filter(r => r.id !== rejectionId));
        }, 3000);

        return [...prev, newRejection];
      });
    }
  };

  const { state, actions } = useVoiceGame(handleSuccess, handleNegativeRejection, marginOfVictory);

  // Load calibrations on mount
  useEffect(() => {
    actions.loadCalibrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload reward videos on mount for instant playback
  useEffect(() => {
    console.log('🎬 Preloading reward videos...');
    let loadedCount = 0;

    REWARD_VIDEOS.forEach((videoUrl) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true; // Muted to allow autoload on mobile
      video.playsInline = true;
      video.src = videoUrl;

      video.addEventListener('canplaythrough', () => {
        loadedCount++;
        console.log(`🎬 Video preloaded (${loadedCount}/${REWARD_VIDEOS.length}): ${videoUrl}`);
        preloadedVideosRef.current.set(videoUrl, video);

        if (loadedCount === REWARD_VIDEOS.length) {
          setVideosPreloaded(true);
          console.log('🎬 All videos preloaded!');
        }
      }, { once: true });

      video.addEventListener('error', () => {
        console.error(`🎬 Failed to preload video: ${videoUrl}`);
      });

      // Trigger load
      video.load();
    });

    return () => {
      // Cleanup preloaded videos
      preloadedVideosRef.current.forEach((video) => {
        video.src = '';
      });
      preloadedVideosRef.current.clear();
    };
  }, []);

  // Check microphone permission on mount
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          if (result.state === 'granted') {
            setMicPermissionGranted(true);
          }
          // Listen for permission changes
          result.addEventListener('change', () => {
            setMicPermissionGranted(result.state === 'granted');
          });
        }
      } catch (err) {
        // Permission query not supported, will check when user tries to use mic
        console.log('Permission query not supported');
      }
    };
    checkMicPermission();
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedVowels = localStorage.getItem('flashcard_vowelsOnly');
    if (savedVowels === 'true') setVowelsOnly(true);
    const savedAdvanced = localStorage.getItem('flashcard_advancedMode');
    if (savedAdvanced === 'true') setAdvancedMode(true);
  }, []);

  // Load margin of victory per-profile from localStorage
  useEffect(() => {
    if (currentProfileId) {
      const savedMargin = localStorage.getItem(`marginOfVictory_${currentProfileId}`);
      if (savedMargin) {
        const parsed = parseInt(savedMargin, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
          setMarginOfVictory(parsed);
          console.log(`🎚️ Loaded margin of victory for profile ${currentProfileId.substring(0, 8)}...: ${parsed}%`);
        }
      }
    }
  }, [currentProfileId]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('flashcard_vowelsOnly', vowelsOnly.toString());
  }, [vowelsOnly]);

  useEffect(() => {
    localStorage.setItem('flashcard_advancedMode', advancedMode.toString());
  }, [advancedMode]);

  // Save margin of victory per-profile to localStorage
  useEffect(() => {
    if (currentProfileId) {
      localStorage.setItem(`marginOfVictory_${currentProfileId}`, marginOfVictory.toString());
      console.log(`🎚️ Saved margin of victory for profile ${currentProfileId.substring(0, 8)}...: ${marginOfVictory}%`);
    }
  }, [marginOfVictory, currentProfileId]);

  // Reset index and cycle tracking when mode changes
  useEffect(() => {
    setCurrentIndex(0);
    cycleStartTimeRef.current = null;
    skipsInCycleRef.current = 0;
  }, [vowelsOnly]);

  // Auto-play letter sound when letter changes (with proficiency-based delay)
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout | null = null;

    if (currentLetter && !state.isActive) {
      // Clear any pending audio timeout
      if (audioDelayTimeoutRef.current) {
        clearTimeout(audioDelayTimeoutRef.current);
        audioDelayTimeoutRef.current = null;
      }

      // Reset audio tracking for new letter
      setAudioPlayedForLetter(false);
      audioPlayedRef.current = false;
      setBeatTheAudio(false);
      setCountdownProgress(0);

      // Get proficiency-based delay
      const proficiency = getProficiency(currentLetter);
      const delay = PROFICIENCY_AUDIO_DELAYS[proficiency] ?? 0;
      setAudioDelay(delay);

      console.log(`🔊 Letter "${currentLetter}" proficiency: ${proficiency} → delay: ${delay}ms`);

      if (delay === 0) {
        // No delay - play immediately
        playLetterSound();
        setAudioPlayedForLetter(true);
        audioPlayedRef.current = true;
      } else {
        // Start countdown animation
        const startTime = Date.now();
        countdownInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(100, (elapsed / delay) * 100);
          setCountdownProgress(progress);

          if (progress >= 100) {
            if (countdownInterval) clearInterval(countdownInterval);
          }
        }, 50); // Update every 50ms for smooth animation

        // Schedule delayed audio
        audioDelayTimeoutRef.current = setTimeout(() => {
          // Only play if we haven't already succeeded (beat the audio)
          if (!audioPlayedRef.current) {
            playLetterSound();
            setAudioPlayedForLetter(true);
            audioPlayedRef.current = true;
            console.log(`🔊 Delayed audio played after ${delay}ms`);
          }
        }, delay);
      }
    }

    // Cleanup on unmount or letter change
    return () => {
      if (audioDelayTimeoutRef.current) {
        clearTimeout(audioDelayTimeoutRef.current);
        audioDelayTimeoutRef.current = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
    // Only run when letter changes, NOT when proficiencies update (to avoid re-triggering after success)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLetter]);

  // Get the current letter sequence based on mode
  const getLetterSequence = () => {
    const sequence = vowelsOnly ? VOWELS : ALPHABET;
    const calibratedLetters = Object.keys(state.calibrationData);
    // Filter to only calibrated letters
    return sequence.filter(letter => calibratedLetters.includes(letter));
  };

  // Pick next letter in sequence (A-Z loop or vowels loop)
  const pickNextLetter = () => {
    const sequence = getLetterSequence();
    if (sequence.length === 0) {
      const modeText = vowelsOnly ? 'vowels (A, E, I, O, U)' : 'letters';
      setGameMessage(`No calibrated ${modeText}. Please calibrate first.`);
      return null;
    }

    // Check if we're completing a cycle (wrapping around)
    const nextIndex = currentIndex % sequence.length;

    // If nextIndex is 0 and we've gone through letters (currentIndex > 0), cycle completed
    if (nextIndex === 0 && currentIndex > 0 && cycleStartTimeRef.current && currentProfileId) {
      const durationSeconds = Math.round((Date.now() - cycleStartTimeRef.current) / 1000);
      const skips = skipsInCycleRef.current;

      // Record the completed cycle (level 1 = flashcard mode)
      recordCycleCompletion(currentProfileId, 1, durationSeconds, skips);

      // Reset for next cycle
      cycleStartTimeRef.current = Date.now();
      skipsInCycleRef.current = 0;
    }

    // Start tracking if this is the first letter
    if (cycleStartTimeRef.current === null) {
      cycleStartTimeRef.current = Date.now();
      skipsInCycleRef.current = 0;
    }

    const nextLetter = sequence[nextIndex];
    setCurrentIndex(nextIndex + 1);
    return nextLetter;
  };

  // Start with first letter
  const startGame = async () => {
    // Unlock iOS audio by playing silent file on the SAME audio element we'll reuse
    // This is critical - iOS requires the first play() to be from a user gesture
    if (audioRef.current && !audioUnlocked) {
      audioRef.current.src = '/audio/silent.mp3';
      try {
        await audioRef.current.play();
        setAudioUnlocked(true);
        console.log('🔊 iOS audio unlocked');
      } catch (err) {
        console.log('Audio unlock failed (may already be unlocked):', err);
      }
    }

    const firstLetter = pickNextLetter();
    if (firstLetter) {
      setCurrentLetter(firstLetter);
      setGameMessage('Tap the button and say the letter!');
    }
  };

  // Play letter sound using single audio element (iOS-friendly)
  const playLetterSound = () => {
    if (!currentLetter || !audioRef.current) return;

    // Use local audio file
    const audioUrl = `/audio/letters/${currentLetter.toLowerCase()}.mp3`;

    // Stop current audio if playing, then play new letter
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.src = audioUrl;
    audioRef.current.play().catch(err => {
      console.error('Audio playback failed:', err);
    });
  };

  // Handle button press - activate microphone
  const handleButtonPress = async () => {
    if (!currentLetter || state.isActive) return;

    // Check if we have microphone permission
    if (!micPermissionGranted) {
      // Show permission modal first
      setShowPermissionModal(true);
      return;
    }

    // Cancel pending audio - they're trying to beat it!
    if (audioDelayTimeoutRef.current) {
      clearTimeout(audioDelayTimeoutRef.current);
      audioDelayTimeoutRef.current = null;
      console.log('🎯 Audio cancelled - trying to beat the timer!');
    }

    // Visual feedback
    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 600);

    // Brief delay to let click sound dissipate before listening
    setGameMessage('Get ready...');
    await new Promise(resolve => setTimeout(resolve, 250));

    // Start voice detection
    try {
      await actions.startGame(currentLetter);
      setGameMessage('Listening...');
    } catch (err: any) {
      // If permission was revoked, show the modal again
      if (err.message?.includes('denied') || err.message?.includes('Settings')) {
        setMicPermissionGranted(false);
        setShowPermissionModal(true);
      } else {
        setGameMessage(err.message || 'Microphone access denied');
      }
    }
  };

  // Called when permission is successfully granted
  const handlePermissionGranted = () => {
    setMicPermissionGranted(true);
    setShowPermissionModal(false);
    setGameMessage('Tap the button and say the letter!');
  };

  // Stop listening
  const handleStop = () => {
    actions.stopGame();
    setGameMessage('Tap the button and say the letter!');
  };

  // Skip to next letter - Leitner system: move back one box on skip
  const handleSkip = async () => {
    if (!currentLetter) return;

    // Track skip for analytics
    skipsInCycleRef.current++;

    // Leitner system: Move back one box (decrement proficiency) on skip
    const currentProf = getProficiency(currentLetter);
    if (currentProf > LetterProficiency.UNKNOWN) {
      const newProf = currentProf - 1;
      console.log(`📉 Leitner: ${currentLetter.toUpperCase()} moves down (skip): ${currentProf} → ${newProf}`);
      await updateProficiency(currentLetter, newProf);
    }

    // Stop current game if active
    if (state.isActive) {
      actions.stopGame();
    }

    // Pick next letter
    const nextLetter = pickNextLetter();
    if (nextLetter) {
      setCurrentLetter(nextLetter);
      setGameMessage('Tap the button and say the letter!');
      setNegativeRejections([]); // Clear rejection indicators
    }
  };

  // Listen button - replay audio (Leitner: counts as needing help, move back one box)
  const handleListen = async () => {
    if (!currentLetter) return;

    // Play the letter sound
    playLetterSound();

    // Leitner system: Clicking Listen = needed help = move back one box
    const currentProf = getProficiency(currentLetter);
    if (currentProf > LetterProficiency.UNKNOWN) {
      const newProf = currentProf - 1;
      console.log(`📉 Leitner: ${currentLetter.toUpperCase()} moves down (listen): ${currentProf} → ${newProf}`);
      await updateProficiency(currentLetter, newProf);
    }
  };

  // Replay current letter sound
  const handleReplay = () => {
    playLetterSound();
  };

  // Handle video reward ending (called on end, skip, close, or timeout)
  const handleVideoEnd = () => {
    console.log('🎬 Video reward ended');

    // Clear any pending timeout
    if (videoTimeoutRef.current) {
      clearTimeout(videoTimeoutRef.current);
      videoTimeoutRef.current = null;
    }

    // Ensure game is stopped so audio will play for next letter
    if (state.isActive) {
      actions.stopGame();
    }

    setShowVideoReward(false);
    setCurrentVideoUrl(null);
    setVideoLoading(true); // Reset for next video
    setShowSuccess(false);
    setBeatTheAudio(false);
    setVideoNeedsTap(false);

    // Advance to next letter
    const nextLetter = pickNextLetter();
    if (nextLetter) {
      setCurrentLetter(nextLetter);
      setGameMessage('Tap the button and say the letter!');
    }
  };

  // Handle video starting to play (clear loading state and timeout)
  const handleVideoCanPlay = () => {
    console.log('🎬 Video can play - attempting to play...');

    // Explicitly call play() to handle autoplay policy
    if (videoRef.current) {
      const playPromise = videoRef.current.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log('🎬 Video playing successfully');
            setVideoLoading(false);
            setVideoNeedsTap(false);

            // Clear timeout since video is playing
            if (videoTimeoutRef.current) {
              clearTimeout(videoTimeoutRef.current);
              videoTimeoutRef.current = null;
            }
          })
          .catch((error) => {
            console.log('🎬 Autoplay blocked, showing tap-to-play:', error.message);
            setVideoLoading(false);
            setVideoNeedsTap(true); // Show tap to play button
          });
      }
    }
  };

  // Handle tap to play (for when autoplay is blocked)
  const handleTapToPlay = () => {
    console.log('🎬 User tapped to play');
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => {
          setVideoNeedsTap(false);
          // Clear timeout
          if (videoTimeoutRef.current) {
            clearTimeout(videoTimeoutRef.current);
            videoTimeoutRef.current = null;
          }
        })
        .catch((err) => {
          console.error('🎬 Play failed even after tap:', err);
          handleVideoEnd(); // Give up and skip
        });
    }
  };

  // Start video with timeout - if doesn't load in 5 seconds, skip
  const startVideoWithTimeout = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setShowVideoReward(true);
    setVideoLoading(true);
    setVideoNeedsTap(false); // Reset tap state

    // Set timeout to skip if video doesn't load
    videoTimeoutRef.current = setTimeout(() => {
      console.log('🎬 Video load timeout - skipping');
      handleVideoEnd();
    }, VIDEO_LOAD_TIMEOUT);
  };

  // Handle skipping/closing video
  const handleCloseVideo = () => {
    console.log('🎬 Video closed by user');
    handleVideoEnd();
  };

  // Handle successful match - Leitner system: move up one box on success
  async function handleSuccess(letter: string, matchedSnapshot?: any, score?: number) {
    // Check if they beat the audio (responded before audio played) - use ref for accuracy
    const didBeatAudio = !audioPlayedRef.current && audioDelay > 0;

    // Cancel any pending audio if they beat it
    if (audioDelayTimeoutRef.current) {
      clearTimeout(audioDelayTimeoutRef.current);
      audioDelayTimeoutRef.current = null;
    }

    // Mark audio as "played" to prevent it from playing after success
    audioPlayedRef.current = true;
    setAudioPlayedForLetter(true);

    if (didBeatAudio) {
      console.log('🚀 BEAT THE AUDIO! Independent recall for:', letter);
      setBeatTheAudio(true);
    } else {
      console.log('🎉 Success! Matched letter:', letter);
    }

    // Leitner system: Move up one box (increment proficiency)
    const currentProf = getProficiency(letter);
    if (currentProf < LetterProficiency.MASTERED) {
      const newProf = currentProf + 1;
      console.log(`📈 Leitner: ${letter.toUpperCase()} moves up: ${currentProf} → ${newProf}`);
      await updateProficiency(letter, newProf);
    } else {
      console.log(`⭐ ${letter.toUpperCase()} already MASTERED`);
    }

    setShowSuccess(true);
    setGameMessage('');
    setLastMatchedLetter(letter);
    setLastMatchedSnapshot(matchedSnapshot || null);
    setLastMatchedPattern(state.currentPattern ? [...state.currentPattern] : null); // Store pattern at match time

    // Increment letters since last video
    const newLetterCount = lettersSinceVideo + 1;
    setLettersSinceVideo(newLetterCount);

    // Check if we should play a video reward
    const hasEnoughLetters = newLetterCount >= MIN_LETTERS_BEFORE_VIDEO;
    const videoChance = didBeatAudio ? VIDEO_CHANCE_BEAT_CLOCK : VIDEO_CHANCE_REGULAR;
    const roll = Math.random();
    const rollsVideo = roll < videoChance;

    console.log(`🎬 Video check: letterCount=${newLetterCount}/${MIN_LETTERS_BEFORE_VIDEO}, beatAudio=${didBeatAudio}, chance=${(videoChance * 100).toFixed(0)}%, roll=${(roll * 100).toFixed(0)}%, plays=${rollsVideo && hasEnoughLetters}`);

    // Play video if: enough letters passed + random roll succeeds
    if (hasEnoughLetters && rollsVideo) {
      // Pick a random video from the pool
      const randomVideo = REWARD_VIDEOS[Math.floor(Math.random() * REWARD_VIDEOS.length)];
      console.log(`🎬 Playing random video reward: ${randomVideo}`);
      startVideoWithTimeout(randomVideo);
      setLettersSinceVideo(0); // Reset counter

      // Video will handle advancing to next letter when it ends
      // Timeout will auto-skip if video doesn't load
    } else {
      // Show celebration briefly, then auto-advance to next letter
      const celebrationTime = didBeatAudio ? 1200 : 800;
      setTimeout(() => {
        setShowSuccess(false);
        setBeatTheAudio(false);
        const nextLetter = pickNextLetter();
        if (nextLetter) {
          setCurrentLetter(nextLetter);
          setGameMessage('Tap the button and say the letter!');
        }
      }, celebrationTime);
    }

    // Clear the "Not X" button after 5 seconds
    setTimeout(() => {
      setLastMatchedLetter(null);
      setLastMatchedSnapshot(null);
      setLastMatchedPattern(null);
    }, 5000);
  }

  // Mark last match as wrong (false positive) - CREATE a new negative snapshot
  const handleNotX = async () => {
    if (!lastMatchedLetter || !currentProfileId) {
      console.log('❌ No matched letter or profile to create negative snapshot');
      return;
    }

    // Need either the stored pattern or the matched snapshot's pattern
    const patternToUse = lastMatchedPattern || lastMatchedSnapshot?.data;
    if (!patternToUse) {
      console.log('❌ No pattern available to create negative snapshot');
      return;
    }

    console.log(`🚫 Creating NEW negative snapshot for ${lastMatchedLetter.toUpperCase()}`);
    console.log(`   Pattern source: ${lastMatchedPattern ? 'stored match pattern' : 'matched snapshot data'}`);

    // Undo the proficiency increase (move back down)
    const currentProf = getProficiency(lastMatchedLetter);
    if (currentProf > LetterProficiency.UNKNOWN) {
      const newProf = currentProf - 1;
      console.log(`📉 Leitner: ${lastMatchedLetter.toUpperCase()} moves down (NOT X): ${currentProf} → ${newProf}`);
      await updateProficiency(lastMatchedLetter, newProf);
    }

    try {
      // Upload audio if the matched snapshot has audio we can reuse
      let audioUrl: string | undefined;
      if (lastMatchedSnapshot?.audio_url) {
        // Reuse the audio URL from the matched snapshot
        audioUrl = lastMatchedSnapshot.audio_url;
        console.log(`   Reusing audio URL: ${audioUrl}`);
      }

      // Create a NEW negative snapshot using the stored pattern
      const result = await addNegativePattern(
        lastMatchedLetter,
        patternToUse,
        currentProfileId,
        state.calibrationData,
        audioUrl,
        true // immediate save
      );

      if (result.success) {
        console.log('✅ Negative snapshot created successfully');
        setGameMessage('✓ Marked as incorrect');
        setTimeout(() => setGameMessage(''), 1500);

        // Reload calibrations to pick up the change
        await actions.loadCalibrations();
      } else {
        console.error('❌ Failed to create negative snapshot:', result.message);
        setGameMessage('Failed to save');
        setTimeout(() => setGameMessage(''), 1500);
      }

      // Clear the "Not X" button
      setLastMatchedLetter(null);
      setLastMatchedSnapshot(null);
      setLastMatchedPattern(null);

    } catch (error) {
      console.error('❌ Error creating negative snapshot:', error);
      setGameMessage('Error saving');
      setTimeout(() => setGameMessage(''), 1500);
    }
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!currentProfileId) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">No profile selected</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/images/background.jpg)` }} />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: `url(/images/background-wide.jpg)` }} />

      {/* "Not X" button - Top Left, shows for 5 seconds after a match */}
      {lastMatchedLetter && !showCalibrationModal && (
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-30">
          <button
            onClick={handleNotX}
            className="px-4 py-2 md:px-5 md:py-3 text-sm md:text-base font-bold text-white rounded-full border-2 border-red-400/60 bg-red-500/50 hover:bg-red-500/70 transition-all shadow-lg flex items-center gap-2"
          >
            ✗ Not {lastMatchedLetter.toUpperCase()}
          </button>
        </div>
      )}

      {/* Parents Menu - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-30">
        <ParentsMenu
          advancedMode={advancedMode}
          onAdvancedModeChange={setAdvancedMode}
          vowelsOnly={vowelsOnly}
          onVowelsOnlyChange={setVowelsOnly}
          marginOfVictory={marginOfVictory}
          onMarginOfVictoryChange={setMarginOfVictory}
        />
      </div>

      {/* Negative Rejection Indicators - Top Left (Stacked) - only in advanced mode */}
      {advancedMode && negativeRejections.map((rejection, index) => (
        <div
          key={rejection.id}
          className="absolute left-4 md:left-6 z-20 animate-pulse cursor-pointer hover:scale-110 transition-all"
          style={{ top: `${24 + index * 80}px` }}
          onClick={() => setSelectedSnapshot(rejection)}
          title="Click to view/delete this negative snapshot"
        >
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-500/60 backdrop-blur-md border-4 border-red-400/80 shadow-lg shadow-red-500/50 flex items-center justify-center">
            <span className="text-2xl md:text-3xl">🚫</span>
          </div>
          <div className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded-full font-bold">
            {rejection.negativeScore.toFixed(0)}
          </div>
        </div>
      ))}

      {/* IS X Button - Top right, left of Parents menu */}
      {currentLetter && state.isActive && (
        <div className="absolute top-4 right-32 md:top-6 md:right-40 z-20">
          <button
            onClick={() => {
              if (!currentProfileId || !currentLetter) return;
              actions.setMuted(true);
              setShowCalibrationModal(true);
            }}
            className="px-3 py-2 md:px-5 md:py-3 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full font-bold text-sm md:text-base shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Mark current sound as correct"
          >
            ✓ IS {currentLetter.toUpperCase()}
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 md:gap-4 py-4">
        {/* Title - hidden on small screens in landscape */}
        <div className="text-white text-xl md:text-2xl font-light tracking-[0.3em] uppercase opacity-70 hidden portrait:block md:block">
          Wunderkind
        </div>

        {/* Message */}
        {gameMessage && (
          <div className="text-white text-base md:text-xl font-medium text-center px-6 py-2 md:px-8 md:py-4 bg-white/30 rounded-full">
            {gameMessage}
          </div>
        )}

        {/* Big Smash Button with Letter - responsive sizing */}
        {currentLetter ? (
          <div className="relative" style={{ width: 'min(504px, 80vw, 50vh)', height: 'min(504px, 80vw, 50vh)' }}>
            {/* Countdown Ring - shows when there's a delay and audio hasn't played yet */}
            {audioDelay > 0 && !audioPlayedForLetter && !state.isActive && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-10"
                viewBox="0 0 100 100"
              >
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="3"
                />
                {/* Progress circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="rgba(255,200,0,0.8)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${countdownProgress * 3.01} 301`}
                  className="transition-all duration-100"
                />
              </svg>
            )}

            <button
              onClick={handleButtonPress}
              disabled={state.isActive}
              className={`relative cursor-pointer select-none w-full h-full ${isButtonPressed ? 'animate-saturation-burst' : ''}`}
              style={{
                transition: 'all 0.2s ease',
              }}
            >
              {/* Button Image */}
              <img
                src="/images/Smash button.png"
                alt="Smash Button"
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* Letter Overlay - responsive font size */}
              <div
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-black pointer-events-none ${isButtonPressed ? 'letter-pop' : ''}`}
                style={{
                  fontSize: 'min(288px, 45vw, 28vh)',
                  textShadow: '0 6px 12px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease',
                }}
              >
                {currentLetter}
              </div>
            </button>
          </div>
        ) : (
          <button
            onClick={startGame}
            className="px-16 py-4 md:px-24 md:py-6 text-xl md:text-2xl font-medium text-white/90 rounded-full border-2 border-white/40 bg-white/25 hover:bg-white/35 transition-all"
          >
            Start
          </button>
        )}

        {/* Volume indicator + Stop/Skip buttons (when listening) */}
        {state.isActive && (
          <div className="flex flex-col items-center gap-2 w-64 md:w-80">
            <div className="w-full">
              <div className="text-white/70 text-xs md:text-sm mb-1 md:mb-2 text-center">Listening...</div>
              <div className="h-4 md:h-6 bg-white/30 rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                  style={{ width: `${Math.min(100, (state.volume / 30) * 100)}%` }}
                />
              </div>
            </div>
            {/* Stop + Skip Buttons */}
            <div className="flex flex-row items-center gap-4">
              <button
                onClick={handleStop}
                className="px-6 py-2 md:px-8 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-red-400/50 bg-red-500/50 hover:bg-red-500/60 transition-all"
              >
                Stop
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-2 md:px-8 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-gray-400/50 bg-gray-500/40 hover:bg-gray-500/60 transition-all flex items-center gap-2"
              >
                ⏭️ Skip
              </button>
            </div>
          </div>
        )}

        {/* Listen + Skip buttons (when NOT listening) */}
        {currentLetter && !state.isActive && !showSuccess && (
          <div className="flex flex-row items-center gap-4">
            {/* Listen Button - replays audio */}
            <button
              onClick={handleListen}
              className="px-6 py-2 md:px-8 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-blue-400/50 bg-blue-500/40 hover:bg-blue-500/60 transition-all flex items-center gap-2"
            >
              🔊 Listen
            </button>
            {/* Skip Button */}
            <button
              onClick={handleSkip}
              className="px-6 py-2 md:px-8 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-gray-400/50 bg-gray-500/40 hover:bg-gray-500/60 transition-all flex items-center gap-2"
            >
              ⏭️ Skip
            </button>
          </div>
        )}

      </div>

      {/* Success Celebration - Confetti */}
      {showSuccess && currentLetter && (
        <SuccessCelebration letter={currentLetter} />
      )}

      {/* "You Knew It!" Celebration - appears when they beat the audio */}
      {beatTheAudio && showSuccess && !showVideoReward && (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <div className="animate-bounce-in text-center">
            <div className="text-6xl md:text-8xl mb-4">🚀</div>
            <div className="text-3xl md:text-5xl font-black text-yellow-300 drop-shadow-lg"
              style={{ textShadow: '0 0 20px rgba(255,200,0,0.8), 0 4px 8px rgba(0,0,0,0.5)' }}>
              You knew it!
            </div>
          </div>
        </div>
      )}

      {/* Video Reward Player - Full screen overlay */}
      {showVideoReward && currentVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          {/* Close (X) button - top right */}
          <button
            onClick={handleCloseVideo}
            className="absolute top-4 right-4 z-[60] w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full text-white text-2xl font-bold transition-all"
            aria-label="Close video"
          >
            ✕
          </button>

          {/* Loading spinner - shows while video is buffering */}
          {videoLoading && !videoNeedsTap && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
              <div className="text-white text-lg font-medium">Loading video...</div>
            </div>
          )}

          {/* Tap to play button - shows when autoplay is blocked */}
          {videoNeedsTap && (
            <button
              onClick={handleTapToPlay}
              className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 cursor-pointer"
            >
              <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-4 hover:bg-white/30 hover:scale-110 transition-all shadow-2xl border-2 border-white/30">
                <Play className="w-14 h-14 text-white ml-1" fill="white" />
              </div>
              <div className="text-white text-2xl font-bold drop-shadow-lg">Tap to Play</div>
            </button>
          )}

          {/* Video player */}
          <video
            ref={videoRef}
            src={currentVideoUrl}
            autoPlay
            playsInline
            onEnded={handleVideoEnd}
            onCanPlay={handleVideoCanPlay}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${videoLoading ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Celebration text overlay - only show when video is playing */}
          {!videoLoading && (
            <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
              <div className="text-2xl md:text-4xl font-black text-yellow-300 drop-shadow-lg animate-pulse"
                style={{ textShadow: '0 0 20px rgba(255,200,0,0.8), 0 4px 8px rgba(0,0,0,0.8)' }}>
                🎉 You knew it! 🎉
              </div>
            </div>
          )}
        </div>
      )}

      {/* Microphone Permission Modal */}
      {showPermissionModal && (
        <MicrophonePermission
          onPermissionGranted={handlePermissionGranted}
          onClose={() => setShowPermissionModal(false)}
        />
      )}

      {/* Calibration Modal - for "IS X" or "NOT X" override */}
      {showCalibrationModal && (currentLetter || lastMatchedLetter) && (
        <CalibrationModal
          letter={lastMatchedLetter || currentLetter!}
          variant="kid"
          onClose={async () => {
            // Reload calibrations BEFORE closing modal to ensure new snapshot is loaded
            console.log('🔄 Reloading calibrations...');
            await actions.loadCalibrations();
            console.log('✅ Calibrations reloaded');
            setShowCalibrationModal(false);
            setLastMatchedLetter(null);

            // Unmute game - it will continue on the current letter
            actions.setMuted(false);
          }}
          onSuccess={(letter) => {
            console.log(`✅ Added calibration for ${letter}`);
          }}
        />
      )}

      {/* Negative Snapshot Detail Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Negative Snapshot Details</h2>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">Negative Score:</span>
                <span className="text-red-600 font-bold text-xl">{selectedSnapshot.negativeScore.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-medium">Positive Score:</span>
                <span className="text-green-600 font-bold text-xl">{selectedSnapshot.positiveScore.toFixed(2)}</span>
              </div>

              <div className="border-t pt-4">
                <span className="text-gray-700 font-medium">Snapshot ID:</span>
                <p className="text-gray-600 text-sm mt-1 font-mono">{selectedSnapshot.snapshot.id}</p>
              </div>

              {selectedSnapshot.snapshot.audio_url && (
                <div>
                  <span className="text-gray-700 font-medium block mb-2">Audio Recording:</span>
                  <audio controls className="w-full" src={selectedSnapshot.snapshot.audio_url} />
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Why this blocked:</strong> This negative snapshot matched your voice better than any positive snapshots, indicating this sound should NOT be recognized as the target letter.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  // Delete the negative snapshot from Supabase
                  try {
                    const snapshotId = selectedSnapshot.snapshot.id;
                    console.log('🗑️ Starting snapshot deletion...');
                    console.log('   Snapshot ID:', snapshotId);
                    console.log('   Full snapshot object:', selectedSnapshot.snapshot);

                    // Get all calibrations
                    console.log('📥 Fetching all calibrations from database...');
                    const { data: calibrations, error: fetchError } = await supabase
                      .from('calibrations')
                      .select('*');

                    if (fetchError) {
                      console.error('❌ Error fetching calibrations:', fetchError);
                      throw fetchError;
                    }

                    console.log(`✅ Fetched ${calibrations?.length || 0} calibrations`);

                    // Find and update the calibration that contains this snapshot
                    let found = false;
                    for (const cal of calibrations || []) {
                      console.log(`🔍 Checking calibration ID: ${cal.id}, Letter: ${cal.letter}, Profile: ${cal.profile_id}`);

                      if (cal.pattern_data?.snapshots) {
                        const snapshots = cal.pattern_data.snapshots;
                        console.log(`   Has ${snapshots.length} snapshots`);

                        // Log first few snapshot IDs for comparison
                        if (snapshots.length > 0) {
                          console.log('   First 3 snapshot IDs:', snapshots.slice(0, 3).map((s: any) => s.id));
                        }

                        const snapshotIndex = snapshots.findIndex((s: any) => s.id === snapshotId);
                        console.log(`   findIndex result: ${snapshotIndex}`);

                        if (snapshotIndex !== -1) {
                          found = true;
                          console.log(`🎯 FOUND! Snapshot at index ${snapshotIndex}`);
                          console.log('   Before deletion:', snapshots.length, 'snapshots');

                          // Found the snapshot - remove it
                          const updatedSnapshots = snapshots.filter((s: any) => s.id !== snapshotId);
                          console.log('   After filtering:', updatedSnapshots.length, 'snapshots');

                          // Update the calibration
                          console.log('💾 Updating calibration in database...');
                          const { error: updateError } = await supabase
                            .from('calibrations')
                            .update({
                              pattern_data: {
                                ...cal.pattern_data,
                                snapshots: updatedSnapshots,
                              },
                            })
                            .eq('id', cal.id);

                          if (updateError) {
                            console.error('❌ Error updating calibration:', updateError);
                            throw updateError;
                          }

                          console.log('✅ Database updated successfully');

                          // Reload calibrations
                          console.log('🔄 Reloading calibrations...');
                          await actions.loadCalibrations();
                          console.log('✅ Calibrations reloaded');

                          // Restart the game with fresh calibrations if currently playing
                          if (state.isActive && currentLetter) {
                            console.log('🔄 Restarting game with fresh calibrations...');
                            actions.stopGame();
                            await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
                            await actions.startGame(currentLetter);
                            console.log('✅ Game restarted with updated data');
                          }

                          // Close modal
                          setSelectedSnapshot(null);

                          // Remove from rejections list
                          setNegativeRejections(prev => prev.filter(r => r.id !== selectedSnapshot.id));

                          console.log('✅ SNAPSHOT DELETION COMPLETE');

                          // Show success message
                          alert('✅ Snapshot deleted successfully!\n\nThe negative pattern has been removed from the database and the game has been restarted with fresh data.');

                          return; // Exit once we've found and deleted it
                        }
                      } else {
                        console.log('   No pattern_data or snapshots found');
                      }
                    }

                    if (!found) {
                      console.error('❌ Snapshot not found in any calibration');
                      console.error('   Searched', calibrations?.length, 'calibrations');
                      console.error('   Looking for snapshot ID:', snapshotId);
                      alert(`Snapshot not found in database. ID: ${snapshotId}`);
                    }
                  } catch (error) {
                    console.error('❌ Error deleting snapshot:', error);
                    alert('Failed to delete snapshot. Check console for details.');
                  }
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-xl transition-all hover:scale-105"
              >
                🗑️ Delete Snapshot
              </button>

              <button
                onClick={() => setSelectedSnapshot(null)}
                className="flex-1 px-6 py-3 bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl font-bold hover:shadow-xl transition-all hover:scale-105"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden audio element - iOS requires a single element to be unlocked once */}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes saturation-burst {
          0% { filter: saturate(1) brightness(1); transform: scale(1); }
          40% { filter: saturate(5) brightness(2); transform: scale(0.65); }
          100% { filter: saturate(1) brightness(1); transform: scale(1); }
        }

        .animate-saturation-burst {
          animation: saturation-burst 0.6s ease-out;
        }

        @keyframes bounce-in {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }

        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }

        .letter-pop {
          text-shadow:
            -4px -4px 0 rgba(0,0,0,0.8),
            4px -4px 0 rgba(0,0,0,0.8),
            -4px 4px 0 rgba(0,0,0,0.8),
            4px 4px 0 rgba(0,0,0,0.8),
            -6px 0 0 rgba(0,0,0,0.8),
            6px 0 0 rgba(0,0,0,0.8),
            0 -6px 0 rgba(0,0,0,0.8),
            0 6px 0 rgba(0,0,0,0.8),
            0 0 30px rgba(0,0,0,0.9),
            0 0 50px rgba(0,0,0,0.7),
            0 10px 20px rgba(0,0,0,0.6);
          transform: translate(-50%, -50%) scale(1.1);
        }
      `}</style>
    </div>
  );
}

export default function FlashcardWithProvider() {
  return (
    <ProfileProvider>
      <FlashcardPage />
    </ProfileProvider>
  );
}
