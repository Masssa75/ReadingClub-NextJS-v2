'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { useSession } from '@/app/hooks/useSession';
import { useProficiency } from '@/app/hooks/useProficiency';
import { selectNextLetter } from '@/app/utils/adaptiveSelection';
import ParentsMenu from '@/app/components/ParentsMenu';

export default function Learn1() {
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentLetterRef = useRef<string | null>(null);
  const listenClickedThisRound = useRef(false);

  // Profile, session, and proficiency tracking (same as /play)
  const { currentProfileId, isLoading: profileLoading } = useProfileContext();
  const { currentSession, recordAttempt, getSession } = useSession(currentProfileId);
  const { proficiencies } = useProficiency(currentProfileId);

  // Use the shared voice game hook
  const { state, actions } = useVoiceGame(handleSuccess);

  // Load calibrations on mount (empty array to prevent infinite loop)
  useEffect(() => {
    actions.loadCalibrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVideo = () => {
    setShowVideo(true);
    setIsPlaying(true);
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

    // Play success sound (C-E-G major chord)
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // C-E-G major chord (rising)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
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
        <ParentsMenu />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-24">
        <div className="text-white text-2xl font-light tracking-[0.3em] uppercase opacity-70">Wunderkind</div>

        {/* Letter - click to watch video */}
        <div
          className={`text-[280px] leading-none font-black text-white drop-shadow-2xl cursor-pointer hover:scale-110 transition-transform ${showSuccess ? 'animate-bounce' : ''}`}
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
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all duration-100"
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
                  className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-100"
                  style={{ width: `${Math.min(100, (state.concentration / 5) * 100)}%` }}
                />
              </div>
              <div className="text-white/60 text-xs text-center mt-1">{state.concentration.toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* Learn button - starts voice recognition game */}
        {!state.isActive ? (
          <button
            onClick={() => startGame()}
            className="px-24 py-6 text-2xl font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all"
          >
            Learn
          </button>
        ) : (
          <button
            onClick={stopGame}
            className="px-24 py-6 text-2xl font-bold text-white rounded-full border-2 border-red-500/80 backdrop-blur-sm bg-red-500/70 hover:bg-red-600/80 transition-all shadow-lg"
          >
            Stop
          </button>
        )}
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full mx-4">
            <video
              ref={videoRef}
              className="w-full"
              onEnded={() => setIsPlaying(false)}
            >
              <source src="/videos/Bear.mp4" type="video/mp4" />
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
          </div>
        </div>
      )}
    </div>
  );
}
