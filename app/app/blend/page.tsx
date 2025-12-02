'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Volume2, Play, Mic } from 'lucide-react';
import { ProfileProvider, useProfileContext } from '@/app/contexts/ProfileContext';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import SuccessCelebration from '@/app/components/SuccessCelebration';
import MicrophonePermission from '@/app/components/MicrophonePermission';

// Lesson 1: CV blends with 'b'
const LESSON_1_BLENDS = [
  { consonant: 'b', vowel: 'a', blend: 'ba' },
  { consonant: 'b', vowel: 'e', blend: 'be' },
  { consonant: 'b', vowel: 'i', blend: 'bi' },
  { consonant: 'b', vowel: 'o', blend: 'bo' },
  { consonant: 'b', vowel: 'u', blend: 'bu' },
];

type Mode = 'demo' | 'practice';
type HighlightState = 'none' | 'consonant' | 'vowel' | 'blend';
type PracticeStep = 'idle' | 'consonant' | 'vowel' | 'blend' | 'success';

function BlendPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<Mode>('demo');
  const [highlightState, setHighlightState] = useState<HighlightState>('none');
  const [isPlaying, setIsPlaying] = useState(false);
  const [message, setMessage] = useState('Tap Play to start the demo');

  // Practice mode state
  const [practiceStep, setPracticeStep] = useState<PracticeStep>('idle');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const practiceStepRef = useRef<PracticeStep>('idle');

  const audioRef = useRef<HTMLAudioElement>(null);
  const { isLoading: profileLoading, currentProfileId } = useProfileContext();

  // Keep ref in sync with state for callbacks
  useEffect(() => {
    practiceStepRef.current = practiceStep;
  }, [practiceStep]);

  // Voice recognition for practice mode
  const handleVoiceSuccess = (letter: string) => {
    console.log(`✅ Recognized: ${letter}, current step: ${practiceStepRef.current}`);

    if (practiceStepRef.current === 'consonant') {
      // Consonant recognized, now listen for vowel
      setHighlightState('vowel');
      setPracticeStep('vowel');
      setMessage(`Great! Now say "${currentBlend.vowel}"...`);

      // Start listening for vowel
      actions.stopGame();
      setTimeout(() => {
        actions.startGame(currentBlend.vowel).catch(console.error);
      }, 300);
    } else if (practiceStepRef.current === 'vowel') {
      // Vowel recognized, now show the full blend
      setHighlightState('blend');
      setPracticeStep('blend');
      setMessage(`Now blend them: "${currentBlend.blend}"!`);
      actions.stopGame();

      // Play the blend audio and show success
      setTimeout(async () => {
        await playSound(currentBlend.blend);
        setShowSuccess(true);
        setPracticeStep('success');
        setMessage('Excellent! You did it! 🎉');

        // Auto-advance after celebration
        setTimeout(() => {
          setShowSuccess(false);
          if (currentIndex < LESSON_1_BLENDS.length - 1) {
            setCurrentIndex(currentIndex + 1);
          }
          resetPractice();
        }, 2000);
      }, 500);
    }
  };

  const { state, actions } = useVoiceGame(handleVoiceSuccess);

  // Load calibrations on mount
  useEffect(() => {
    actions.loadCalibrations();
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
        }
      } catch (err) {
        console.log('Permission query not supported');
      }
    };
    checkMicPermission();
  }, []);

  const currentBlend = LESSON_1_BLENDS[currentIndex];

  // Play audio for a specific sound
  const playSound = async (sound: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!audioRef.current) {
        resolve();
        return;
      }

      // Use local audio files for letters, blend audio will need to be generated
      let audioUrl: string;
      if (sound.length === 1) {
        // Single letter
        audioUrl = `/audio/letters/${sound.toLowerCase()}.mp3`;
      } else {
        // Blend - for now use letter audio as placeholder
        // TODO: Generate blend audio files
        audioUrl = `/audio/blends/${sound.toLowerCase()}.mp3`;
      }

      audioRef.current.src = audioUrl;

      const handleEnded = () => {
        audioRef.current?.removeEventListener('ended', handleEnded);
        resolve();
      };

      const handleError = () => {
        console.log(`Audio not found: ${audioUrl}, skipping...`);
        audioRef.current?.removeEventListener('error', handleError);
        // Wait a short time as if audio played
        setTimeout(resolve, 500);
      };

      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError, { once: true });

      audioRef.current.play().catch(() => {
        // Audio failed to play, resolve anyway
        setTimeout(resolve, 500);
      });
    });
  };

  // Reset practice mode
  const resetPractice = () => {
    setPracticeStep('idle');
    setHighlightState('none');
    setMessage('Tap the mic button to start!');
    if (state.isActive) {
      actions.stopGame();
    }
  };

  // Start practice mode - listen for consonant first
  const startPractice = async () => {
    if (state.isActive) return;

    // Check microphone permission
    if (!micPermissionGranted) {
      setShowPermissionModal(true);
      return;
    }

    // Check if consonant is calibrated
    if (!state.calibrationData[currentBlend.consonant]) {
      setMessage(`Please calibrate "${currentBlend.consonant}" first!`);
      return;
    }

    // Check if vowel is calibrated
    if (!state.calibrationData[currentBlend.vowel]) {
      setMessage(`Please calibrate "${currentBlend.vowel}" first!`);
      return;
    }

    setHighlightState('consonant');
    setPracticeStep('consonant');
    setMessage(`Say "${currentBlend.consonant}"...`);

    try {
      await actions.startGame(currentBlend.consonant);
    } catch (err: any) {
      setMessage(err.message || 'Failed to start voice detection');
      resetPractice();
    }
  };

  // Stop practice
  const stopPractice = () => {
    actions.stopGame();
    resetPractice();
  };

  // Demo mode: Play through consonant → vowel → blend
  const runDemo = async () => {
    if (isPlaying) return;

    setIsPlaying(true);
    setMessage('Watch and listen...');

    // Step 1: Highlight and play consonant
    setHighlightState('consonant');
    await playSound(currentBlend.consonant);
    await new Promise(r => setTimeout(r, 300));

    // Step 2: Highlight and play vowel
    setHighlightState('vowel');
    await playSound(currentBlend.vowel);
    await new Promise(r => setTimeout(r, 300));

    // Step 3: Highlight entire blend and play blended sound
    setHighlightState('blend');
    await playSound(currentBlend.blend);
    await new Promise(r => setTimeout(r, 500));

    // Reset
    setHighlightState('none');
    setIsPlaying(false);
    setMessage('Tap Play to hear it again, or try Practice mode!');
  };

  // Handle permission granted
  const handlePermissionGranted = () => {
    setMicPermissionGranted(true);
    setShowPermissionModal(false);
  };

  // Navigate to previous blend
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setHighlightState('none');
      setMessage('Tap Play to start the demo');
    }
  };

  // Navigate to next blend
  const handleNext = () => {
    if (currentIndex < LESSON_1_BLENDS.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setHighlightState('none');
      setMessage('Tap Play to start the demo');
    }
  };

  // Toggle between demo and practice modes
  const toggleMode = () => {
    const newMode = mode === 'demo' ? 'practice' : 'demo';
    setMode(newMode);
    setHighlightState('none');
    setMessage(newMode === 'demo'
      ? 'Tap Play to start the demo'
      : 'Tap the button and say the sound!');
  };

  if (profileLoading) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/images/background.jpg)` }} />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: `url(/images/background-wide.jpg)` }} />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-4">
        {/* Lesson indicator */}
        <div className="text-white/70 text-sm font-medium px-4 py-2 bg-white/20 rounded-full">
          Lesson 1: B + Vowels
        </div>

        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          className={`px-4 py-2 rounded-full font-medium transition-all ${
            mode === 'demo'
              ? 'bg-blue-500/50 text-white border-2 border-blue-300/50'
              : 'bg-green-500/50 text-white border-2 border-green-300/50'
          }`}
        >
          {mode === 'demo' ? '👀 Demo' : '🎤 Practice'}
        </button>
      </div>

      {/* Progress dots */}
      <div className="relative z-10 flex justify-center gap-2 py-2">
        {LESSON_1_BLENDS.map((blend, idx) => (
          <button
            key={blend.blend}
            onClick={() => {
              setCurrentIndex(idx);
              setHighlightState('none');
            }}
            className={`w-3 h-3 rounded-full transition-all ${
              idx === currentIndex
                ? 'bg-white scale-125'
                : 'bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6">
        {/* Message */}
        {message && (
          <div className="text-white text-lg md:text-xl font-medium text-center px-6 py-3 bg-white/30 rounded-full">
            {message}
          </div>
        )}

        {/* Blend display - large letters */}
        <div className="flex items-center justify-center gap-2">
          {/* Navigation arrow left */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`p-3 rounded-full transition-all ${
              currentIndex === 0
                ? 'opacity-30 cursor-not-allowed'
                : 'bg-white/20 hover:bg-white/40'
            }`}
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>

          {/* Letters container */}
          <div
            className="flex items-center justify-center px-8 py-6 md:px-12 md:py-10 rounded-3xl transition-all duration-300"
            style={{
              background: highlightState === 'blend'
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(255,255,255,0.15)',
              boxShadow: highlightState === 'blend'
                ? '0 0 40px rgba(255,255,255,0.5)'
                : 'none',
            }}
          >
            {/* Consonant */}
            <span
              className="transition-all duration-300"
              style={{
                fontSize: 'clamp(120px, 25vw, 200px)',
                fontWeight: 900,
                color: highlightState === 'consonant' || highlightState === 'blend'
                  ? '#000'
                  : 'rgba(0,0,0,0.3)',
                textShadow: highlightState === 'consonant'
                  ? '0 0 30px rgba(0,0,0,0.5)'
                  : 'none',
                transform: highlightState === 'consonant' ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {currentBlend.consonant}
            </span>

            {/* Arrow between letters */}
            <span
              className="mx-2 md:mx-4 transition-opacity duration-300"
              style={{
                fontSize: 'clamp(40px, 8vw, 60px)',
                color: 'rgba(255,255,255,0.6)',
                opacity: highlightState === 'blend' ? 0 : 1,
              }}
            >
              →
            </span>

            {/* Vowel - in red */}
            <span
              className="transition-all duration-300"
              style={{
                fontSize: 'clamp(120px, 25vw, 200px)',
                fontWeight: 900,
                color: highlightState === 'vowel' || highlightState === 'blend'
                  ? '#DC2626'  // Red for vowels
                  : 'rgba(220,38,38,0.3)',
                textShadow: highlightState === 'vowel'
                  ? '0 0 30px rgba(220,38,38,0.5)'
                  : 'none',
                transform: highlightState === 'vowel' ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              {currentBlend.vowel}
            </span>
          </div>

          {/* Navigation arrow right */}
          <button
            onClick={handleNext}
            disabled={currentIndex === LESSON_1_BLENDS.length - 1}
            className={`p-3 rounded-full transition-all ${
              currentIndex === LESSON_1_BLENDS.length - 1
                ? 'opacity-30 cursor-not-allowed'
                : 'bg-white/20 hover:bg-white/40'
            }`}
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-4 mt-4">
          {mode === 'demo' ? (
            // Demo mode: Play button
            <button
              onClick={runDemo}
              disabled={isPlaying}
              className={`px-8 py-4 rounded-full font-bold text-lg transition-all flex items-center gap-3 ${
                isPlaying
                  ? 'bg-gray-400/50 text-white/70 cursor-not-allowed'
                  : 'bg-blue-500/60 hover:bg-blue-500/80 text-white border-2 border-blue-300/50'
              }`}
            >
              {isPlaying ? (
                <>
                  <Volume2 className="w-6 h-6 animate-pulse" />
                  Playing...
                </>
              ) : (
                <>
                  <Play className="w-6 h-6" fill="white" />
                  Play Demo
                </>
              )}
            </button>
          ) : (
            // Practice mode: Start/Stop buttons
            <>
              {state.isActive ? (
                <div className="flex flex-col items-center gap-3">
                  {/* Volume indicator */}
                  <div className="w-64 md:w-80">
                    <div className="text-white/70 text-xs md:text-sm mb-1 text-center">Listening...</div>
                    <div className="h-4 md:h-6 bg-white/30 rounded-full overflow-hidden border border-white/30">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-400 transition-all"
                        style={{ width: `${Math.min(100, (state.volume / 30) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={stopPractice}
                    className="px-8 py-4 rounded-full font-bold text-lg bg-red-500/60 hover:bg-red-500/80 text-white border-2 border-red-300/50 transition-all flex items-center gap-3"
                  >
                    Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={startPractice}
                  className="px-8 py-4 rounded-full font-bold text-lg bg-green-500/60 hover:bg-green-500/80 text-white border-2 border-green-300/50 transition-all flex items-center gap-3"
                >
                  <Mic className="w-6 h-6" />
                  Start Speaking
                </button>
              )}
            </>
          )}
        </div>

        {/* Hint text */}
        <div className="text-white/60 text-sm md:text-base text-center px-4">
          {mode === 'demo' ? (
            <>Watch the letters light up as you hear each sound!</>
          ) : (
            <>Say each sound: <strong className="text-white">{currentBlend.consonant}</strong>... <strong className="text-red-400">{currentBlend.vowel}</strong>... <strong className="text-white">{currentBlend.blend}</strong></>
          )}
        </div>
      </div>

      {/* Back to letters link */}
      <div className="relative z-10 p-4 flex justify-center">
        <a
          href="/"
          className="text-white/60 hover:text-white/90 text-sm font-medium px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all"
        >
          ← Back to Letters
        </a>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" className="hidden" />

      {/* Success Celebration */}
      {showSuccess && (
        <SuccessCelebration letter={currentBlend.blend} />
      )}

      {/* Microphone Permission Modal */}
      {showPermissionModal && (
        <MicrophonePermission
          onPermissionGranted={handlePermissionGranted}
          onClose={() => setShowPermissionModal(false)}
        />
      )}
    </div>
  );
}

export default function BlendWithProvider() {
  return (
    <ProfileProvider>
      <BlendPage />
    </ProfileProvider>
  );
}
