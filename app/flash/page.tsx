'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import SuccessCelebration from '@/app/components/SuccessCelebration';
import CalibrationModal from '@/app/components/CalibrationModal';
import ParentsMenu from '@/app/components/ParentsMenu';
import { supabase } from '@/app/lib/supabase';

// Letter sequences
const ALPHABET = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

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
  const [vowelsOnly, setVowelsOnly] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const rejectionIdRef = useRef(0);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const { currentProfileId, isLoading: profileLoading } = useProfileContext();

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

  const { state, actions } = useVoiceGame(handleSuccess, handleNegativeRejection);

  // Load calibrations on mount
  useEffect(() => {
    actions.loadCalibrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load settings from localStorage
  useEffect(() => {
    const savedVowels = localStorage.getItem('flashcard_vowelsOnly');
    if (savedVowels === 'true') setVowelsOnly(true);
    const savedAdvanced = localStorage.getItem('flashcard_advancedMode');
    if (savedAdvanced === 'true') setAdvancedMode(true);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('flashcard_vowelsOnly', vowelsOnly.toString());
  }, [vowelsOnly]);

  useEffect(() => {
    localStorage.setItem('flashcard_advancedMode', advancedMode.toString());
  }, [advancedMode]);

  // Reset index when mode changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [vowelsOnly]);

  // Auto-play letter sound when letter changes
  useEffect(() => {
    if (currentLetter && !state.isActive) {
      playLetterSound();
    }
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
    // Get next letter in sequence (loop back to start)
    const nextIndex = currentIndex % sequence.length;
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

    // Visual feedback
    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 600);

    // Start voice detection
    try {
      await actions.startGame(currentLetter);
      setGameMessage('Listening...');
    } catch (err: any) {
      setGameMessage(err.message || 'Microphone access denied');
    }
  };

  // Stop listening
  const handleStop = () => {
    actions.stopGame();
    setGameMessage('Tap the button and say the letter!');
  };

  // Skip to next letter
  const handleSkip = () => {
    if (!currentLetter) return;

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

  // Replay current letter sound
  const handleReplay = () => {
    playLetterSound();
  };

  // Handle successful match
  function handleSuccess(letter: string) {
    console.log('🎉 Success! Matched letter:', letter);
    setShowSuccess(true);
    setGameMessage('');

    // Quick succession for rapid learning - advance to next letter fast
    setTimeout(() => {
      setShowSuccess(false);
      const nextLetter = pickNextLetter();
      if (nextLetter) {
        setCurrentLetter(nextLetter);
        setGameMessage('Tap the button and say the letter!');
      }
    }, 800); // Fast transition for rapid repetition
  }

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

      {/* Parents Menu - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-30">
        <ParentsMenu
          advancedMode={advancedMode}
          onAdvancedModeChange={setAdvancedMode}
          vowelsOnly={vowelsOnly}
          onVowelsOnlyChange={setVowelsOnly}
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

      {/* Advanced Mode Controls - Bottom Right */}
      {advancedMode && currentLetter && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 flex flex-col gap-2">
          <button
            onClick={() => {
              if (!currentProfileId || !currentLetter) return;
              actions.setMuted(true);
              setShowCalibrationModal(true);
            }}
            className="px-4 py-3 md:px-6 md:py-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Mark current sound as correct"
          >
            ✓ IS {currentLetter.toUpperCase()}
          </button>
          <button
            onClick={handleSkip}
            className="px-4 py-3 md:px-6 md:py-4 bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Skip to next letter"
          >
            ⏭️ SKIP
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2 md:gap-4 py-4">
        {/* Title - hidden on small screens in landscape */}
        <div className="text-white text-xl md:text-2xl font-light tracking-[0.3em] uppercase opacity-70 hidden portrait:block md:block">
          Flashcard Mode
        </div>

        {/* Message */}
        {gameMessage && (
          <div className="text-white text-base md:text-xl font-medium text-center px-6 py-2 md:px-8 md:py-4 bg-white/20 backdrop-blur-md rounded-full">
            {gameMessage}
          </div>
        )}

        {/* Big Smash Button with Letter - responsive sizing */}
        {currentLetter ? (
          <button
            onClick={handleButtonPress}
            disabled={state.isActive}
            className={`relative cursor-pointer select-none ${isButtonPressed ? 'animate-saturation-burst' : ''}`}
            style={{
              width: 'min(504px, 80vw, 50vh)',
              height: 'min(504px, 80vw, 50vh)',
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
        ) : (
          <button
            onClick={startGame}
            className="px-16 py-4 md:px-24 md:py-6 text-xl md:text-2xl font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all"
          >
            Start
          </button>
        )}

        {/* Volume indicator + Stop button (when listening) */}
        {state.isActive && (
          <div className="flex flex-col items-center gap-2 w-64 md:w-80">
            <div className="w-full">
              <div className="text-white/70 text-xs md:text-sm mb-1 md:mb-2 text-center">Listening...</div>
              <div className="h-4 md:h-6 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                  style={{ width: `${Math.min(100, (state.volume / 30) * 100)}%` }}
                />
              </div>
            </div>
            {/* Stop Button */}
            <button
              onClick={handleStop}
              className="px-8 py-2 md:px-12 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-red-400/50 backdrop-blur-sm bg-red-400/40 hover:bg-red-500/50 transition-all"
            >
              Stop
            </button>
          </div>
        )}

        {/* Replay Sound Button (when not listening and letter is shown) */}
        {currentLetter && !state.isActive && !showSuccess && (
          <button
            onClick={handleReplay}
            className="px-6 py-2 md:px-8 md:py-3 text-base md:text-lg font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
          >
            <span>🔊</span>
            <span>Listen Again</span>
          </button>
        )}
      </div>

      {/* Success Celebration - Confetti */}
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

            // Unmute game - it will continue on the same letter
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
