'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { useSession } from '@/app/hooks/useSession';
import { useProficiency } from '@/app/hooks/useProficiency';
import { selectNextLetter } from '@/app/utils/adaptiveSelection';
import ParentsMenu from '@/app/components/ParentsMenu';
import SuccessCelebration from '@/app/components/SuccessCelebration';
import CalibrationModal from '@/app/components/CalibrationModal';
import { ProfileProvider } from '@/app/contexts/ProfileContext';

// Audio URLs for letter sounds (from SoundCity Reading)
const LETTER_AUDIO_URLS: Record<string, string> = {
  'a': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-a.mp3',
  'b': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-b.mp3',
  'c': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-c.mp3',
  'd': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-d.mp3',
  'e': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-e.mp3',
  'f': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-f.mp3',
  'g': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-g.mp3',
  'h': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-h.mp3',
  'i': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-i.mp3',
  'j': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-j.mp3',
  'k': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-k.mp3',
  'l': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-l.mp3',
  'm': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-m.mp3',
  'n': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-n.mp3',
  'o': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-o-sh.mp3',
  'p': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-p-2.mp3',
  'q': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-q.mp3',
  'r': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-r.mp3',
  's': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-z.mp3',
  't': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-t.mp3',
  'u': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-u-sh.mp3',
  'v': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-v.mp3',
  'w': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-w.mp3',
  'x': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-x.mp3',
  'y': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/btalpha-i-long.mp3',
  'z': 'https://www.soundcityreading.net/uploads/3/7/6/1/37611941/alphasounds-z.mp3',
};

function Learn1() {
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [showNegativeRejection, setShowNegativeRejection] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentLetterRef = useRef<string | null>(null);
  const listenClickedThisRound = useRef(false);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Profile, session, and proficiency tracking (same as /play)
  const { currentProfileId, isLoading: profileLoading } = useProfileContext();
  const { currentSession, recordAttempt, getSession, endSession } = useSession(currentProfileId);
  const { proficiencies, updateProficienciesFromSession } = useProficiency(currentProfileId);

  // Handle negative rejection (show visual feedback)
  const handleNegativeRejection = (negativeScore: number, positiveScore: number) => {
    setShowNegativeRejection(true);
    setTimeout(() => setShowNegativeRejection(false), 800); // Flash for 800ms
  };

  // Use the shared voice game hook
  const { state, actions } = useVoiceGame(handleSuccess, handleNegativeRejection);

  // Load calibrations on mount (empty array to prevent infinite loop)
  useEffect(() => {
    actions.loadCalibrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load advanced mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('advancedMode');
    if (saved === 'true') {
      setAdvancedMode(true);
    }
  }, []);

  // Save advanced mode to localStorage
  useEffect(() => {
    localStorage.setItem('advancedMode', advancedMode.toString());
  }, [advancedMode]);

  // Cleanup feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  // Save proficiency updates when leaving page or switching profiles
  useEffect(() => {
    return () => {
      // On unmount, save proficiency updates
      const sessionData = endSession();
      if (sessionData) {
        updateProficienciesFromSession(
          sessionData.letterStats,
          sessionData.lettersGraduated
        );
        console.log('💾 Saved proficiency updates on unmount');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfileId]); // Re-run when profile changes

  const openVideo = () => {
    // Check if video exists for this letter
    const videoMap: Record<string, string> = {
      'A': '/Videos/a-Apple2.mp4',
      'B': '/Videos/Bear.mp4',
      'E': '/Videos/e.mp4',
    };

    const hasVideo = currentLetter && videoMap[currentLetter.toUpperCase()];

    if (hasVideo) {
      // Open video modal if video exists
      setShowVideo(true);
      setIsPlaying(true);
    } else {
      // Just play audio if no video
      playLetterSound();
    }
  };

  const closeVideo = () => {
    setShowVideo(false);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Auto-play video when modal opens
  useEffect(() => {
    if (showVideo && videoRef.current) {
      videoRef.current.play().catch(err => {
        console.log('Auto-play failed:', err);
        setIsPlaying(false);
      });
    }
  }, [showVideo]);

  // Pick next letter using adaptive selection (same as /play)
  const pickNextLetter = async () => {
    const calibratedLetters = Object.keys(state.calibrationData);
    if (calibratedLetters.length === 0) {
      setGameMessage('No calibrated letters');
      return null;
    }

    const session = getSession();
    if (!session) {
      // Fallback: random letter
      const randomLetter = calibratedLetters[Math.floor(Math.random() * calibratedLetters.length)];
      setCurrentLetter(randomLetter);
      currentLetterRef.current = randomLetter;
      listenClickedThisRound.current = false;
      return randomLetter;
    }

    // Use adaptive selection (same as /play)
    const nextLetter = selectNextLetter(session, proficiencies, calibratedLetters);

    if (nextLetter) {
      setCurrentLetter(nextLetter);
      currentLetterRef.current = nextLetter;
      listenClickedThisRound.current = false;
      return nextLetter;
    } else {
      setGameMessage('All letters mastered!');
      return null;
    }
  };

  // Start game
  const startGame = async () => {
    if (Object.keys(state.calibrationData).length === 0) {
      setGameMessage('Please calibrate at least one letter first!');
      return;
    }

    const nextLetter = await pickNextLetter();
    if (!nextLetter) return;

    try {
      await actions.startGame(nextLetter);
      setGameMessage(`Say the letter sound: "${nextLetter}"`);
    } catch (err: any) {
      setGameMessage(err.message || 'Microphone access denied');
    }
  };

  // Stop game
  const stopGame = () => {
    actions.stopGame();
    setGameMessage('');
  };

  // Handle successful match (same as /play with auto-advance)
  function handleSuccess(letter: string, matchedSnapshot: any, similarity: number) {
    console.log('🎉 handleSuccess ENTERED for letter:', letter);
    setShowSuccess(true);
    setGameMessage('🎉 Correct! Great job!');

    // Record attempt (same as /play)
    if (currentSession) {
      recordAttempt(letter, true, listenClickedThisRound.current);
    }

    // Auto-advance to next letter (same as /play with autoNext enabled)
    setTimeout(async () => {
      setShowSuccess(false);

      // Pick next letter using adaptive selection
      const nextLetter = await pickNextLetter();
      if (!nextLetter) return;

      try {
        await actions.startGame(nextLetter);
        setGameMessage(`Say the letter sound: "${nextLetter}"`);
      } catch (err: any) {
        setGameMessage(err.message || 'Microphone access denied');
      }
    }, 3000);
  }

  // Handle manual override: IS X (correct) - Opens calibration modal
  const handleManualCorrect = () => {
    if (!currentProfileId || !currentLetter) return;
    // Stop the game before opening modal
    stopGame();
    setShowCalibrationModal(true);
  };

  // Handle manual override: NOT X (incorrect)
  const handleManualIncorrect = async () => {
    if (!currentProfileId) return;

    const result = await actions.handleManualIncorrect(currentProfileId);

    if (result.success) {
      setFeedbackMessage(result.message + ' ✓ Saved');
    } else {
      setFeedbackMessage('❌ ' + result.message);
    }

    // Clear feedback after 2 seconds
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackMessage('');
    }, 2000);
  };

  // Play letter sound audio
  const playLetterSound = () => {
    if (!currentLetter) return;

    const audioUrl = LETTER_AUDIO_URLS[currentLetter.toLowerCase()];
    if (!audioUrl) return;

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Play new audio
    audioRef.current = new Audio(audioUrl);
    audioRef.current.play().catch(err => {
      console.error('Audio playback failed:', err);
    });
  };

  // Loading state
  if (profileLoading) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">Loading profile...</div>
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
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/images/background.jpg)` }} />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: `url(/images/background-wide.jpg)` }} />

      {/* Parents Menu - Top Right */}
      <div className="absolute top-6 right-6 z-20">
        <ParentsMenu
          advancedMode={advancedMode}
          onAdvancedModeChange={setAdvancedMode}
        />
      </div>

      {/* Negative Rejection Indicator - Top Left */}
      {showNegativeRejection && (
        <div className="absolute top-6 left-6 z-20 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-red-500/60 backdrop-blur-md border-4 border-red-400/80 shadow-lg shadow-red-500/50 flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
        </div>
      )}

      {/* Manual Override Buttons - Option 5 (Compact Corner, 50% bigger) */}
      {advancedMode && state.currentLetter && (
        <div className="absolute top-24 right-6 z-20 flex flex-col gap-3">
          <button
            onClick={handleManualCorrect}
            className="px-7 py-5 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-[18px] font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Mark current sound as correct (creates positive snapshot)"
          >
            ✓ IS {state.currentLetter.toUpperCase()}
          </button>
          <button
            onClick={handleManualIncorrect}
            className="px-7 py-5 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-[18px] font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Mark current sound as incorrect (creates negative snapshot)"
          >
            ✗ NOT {state.currentLetter.toUpperCase()}
          </button>
        </div>
      )}

      {/* Feedback Message */}
      {feedbackMessage && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20 px-8 py-4 bg-black/80 backdrop-blur-md text-white rounded-full text-lg font-medium shadow-xl">
          {feedbackMessage}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
        <div className="text-white text-2xl font-light tracking-[0.3em] uppercase opacity-70">Wunderkind</div>

        {/* Letter - click to watch video */}
        <div
          className={`text-[240px] md:text-[280px] leading-none font-black text-white drop-shadow-2xl cursor-pointer hover:scale-110 transition-transform ${showSuccess ? 'animate-bounce' : ''}`}
          onClick={openVideo}
        >
          {currentLetter || '?'}
        </div>

        {/* Game message */}
        {gameMessage && (
          <div className="text-white text-xl font-medium text-center px-8 py-4 bg-white/20 backdrop-blur-md rounded-full">
            {gameMessage}
          </div>
        )}

        {/* Volume Meter - shows when game is active */}
        {state.isActive && (
          <div className="flex flex-col items-center gap-4 w-80">
            {/* Volume Bar */}
            <div className="w-full">
              <div className="text-white/70 text-sm mb-2 text-center">Microphone Volume</div>
              <div className="h-6 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                  style={{ width: `${Math.min(100, (state.volume / 30) * 100)}%` }}
                />
              </div>
              <div className="text-white/60 text-xs text-center mt-1">{state.volume.toFixed(1)}</div>
            </div>

            {/* Concentration Bar */}
            <div className="w-full">
              <div className="text-white/70 text-sm mb-2 text-center">Sound Focus</div>
              <div className="h-6 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-400"
                  style={{ width: `${Math.min(100, (state.concentration / 5) * 100)}%` }}
                />
              </div>
              <div className="text-white/60 text-xs text-center mt-1">{state.concentration.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Learn button - starts voice recognition game */}
        {!state.isActive && !showSuccess ? (
          <button
            onClick={() => startGame()}
            className="px-24 py-6 text-2xl font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all"
          >
            Learn
          </button>
        ) : (
          <button
            onClick={stopGame}
            className="px-16 py-4 text-lg font-medium text-white/90 rounded-full border-2 border-red-400/50 backdrop-blur-sm bg-red-400/40 hover:bg-red-500/50 transition-all"
          >
            Stop
          </button>
        )}
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full mx-4">
            {(() => {
              // Map letters to their video files
              const videoMap: Record<string, string> = {
                'A': '/Videos/a-Apple2.mp4',
                'B': '/Videos/Bear.mp4',
                'E': '/Videos/e.mp4',
              };

              const videoSrc = currentLetter ? videoMap[currentLetter.toUpperCase()] : null;

              if (videoSrc) {
                return (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full"
                      onEnded={() => setIsPlaying(false)}
                    >
                      <source src={videoSrc} type="video/mp4" />
                    </video>

                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                      <button
                        onClick={togglePlayPause}
                        className="px-8 py-3 text-xl font-bold text-white rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
                      >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                      </button>
                      <button
                        onClick={closeVideo}
                        className="px-8 py-3 text-xl font-bold text-white rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
                      >
                        ✕ Close
                      </button>
                    </div>
                  </>
                );
              } else {
                return (
                  <div className="flex flex-col items-center justify-center p-16 min-h-[400px]">
                    <div className="text-white text-6xl mb-8">{currentLetter}</div>
                    <div className="text-white/90 text-3xl font-bold mb-4">Coming Soon!</div>
                    <div className="text-white/70 text-xl mb-8">
                      Video for letter {currentLetter} is being created
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={playLetterSound}
                        className="px-8 py-3 text-xl font-bold text-white rounded-full bg-blue-500/80 backdrop-blur-md hover:bg-blue-600/80 transition-all"
                      >
                        🔊 Listen
                      </button>
                      <button
                        onClick={closeVideo}
                        className="px-8 py-3 text-xl font-bold text-white rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
                      >
                        ✕ Close
                      </button>
                    </div>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* Success Celebration - Sound + Confetti */}
      {showSuccess && currentLetter && (
        <SuccessCelebration letter={currentLetter} />
      )}

      {/* Calibration Modal - for "IS X" manual override */}
      {showCalibrationModal && currentLetter && (
        <CalibrationModal
          letter={currentLetter}
          variant="kid"
          onClose={async () => {
            // Reload calibrations BEFORE closing modal to ensure new snapshot is loaded
            console.log('🔄 Reloading calibrations...');
            await actions.loadCalibrations();
            console.log('✅ Calibrations reloaded');
            setShowCalibrationModal(false);

            // Don't auto-restart - let user click "Learn" when ready to test
            // The letter stays on screen, game is stopped, user controls when to try
          }}
          onSuccess={(letter) => {
            console.log(`✅ Added calibration for ${letter}`);
          }}
        />
      )}
    </div>
  );
}

export default function Learn1WithProvider() {
  return (
    <ProfileProvider>
      <Learn1 />
    </ProfileProvider>
  );
}
