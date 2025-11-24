'use client';

import { useState, useRef, useEffect } from 'react';
import { useVoiceGame } from '@/app/hooks/useVoiceGame';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { ProfileProvider } from '@/app/contexts/ProfileContext';
import SuccessCelebration from '@/app/components/SuccessCelebration';
import CalibrationModal from '@/app/components/CalibrationModal';
import { supabase } from '@/app/lib/supabase';

// Audio URLs for letter sounds
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

function FlashcardPage() {
  const [currentLetter, setCurrentLetter] = useState<string | null>(null);
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rejectionIdRef = useRef(0);

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

  // Pick a random calibrated letter
  const pickNextLetter = () => {
    const calibratedLetters = Object.keys(state.calibrationData);
    if (calibratedLetters.length === 0) {
      setGameMessage('No calibrated letters. Please calibrate at least one letter first.');
      return null;
    }
    const randomLetter = calibratedLetters[Math.floor(Math.random() * calibratedLetters.length)];
    return randomLetter;
  };

  // Start with first letter
  const startGame = () => {
    const firstLetter = pickNextLetter();
    if (firstLetter) {
      setCurrentLetter(firstLetter);
      setGameMessage('Tap the button and say the letter!');
    }
  };

  // Play letter sound
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

  // Handle button press - activate microphone
  const handleButtonPress = async () => {
    if (!currentLetter || state.isActive) return;

    // Visual feedback
    setIsButtonPressed(true);
    setTimeout(() => setIsButtonPressed(false), 600);

    // Play audio immediately as part of user interaction (fixes iOS)
    playLetterSound();

    // Start voice detection
    try {
      await actions.startGame(currentLetter);
      setGameMessage('Listening...');
    } catch (err: any) {
      setGameMessage(err.message || 'Microphone access denied');
    }
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

      {/* Negative Rejection Indicators - Top Right (Stacked) */}
      {negativeRejections.map((rejection, index) => (
        <div
          key={rejection.id}
          className="absolute right-6 z-20 animate-pulse cursor-pointer hover:scale-110 transition-all"
          style={{ top: `${24 + index * 80}px` }}
          onClick={() => setSelectedSnapshot(rejection)}
          title="Click to view/delete this negative snapshot"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/60 backdrop-blur-md border-4 border-red-400/80 shadow-lg shadow-red-500/50 flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
          {/* Score badge */}
          <div className="absolute -bottom-2 -right-2 px-2 py-0.5 bg-black/80 text-white text-xs rounded-full font-bold">
            {rejection.negativeScore.toFixed(0)}
          </div>
        </div>
      ))}

      {/* Manual "IS X" Button - Top Right (below red flags) */}
      {currentLetter && state.isActive && (
        <div className={`absolute top-6 right-6 z-20 transition-all flex flex-col gap-3`} style={{ marginTop: `${negativeRejections.length * 80}px` }}>
          <button
            onClick={() => {
              if (!currentProfileId || !currentLetter) return;
              // Mute the game while modal is open (don't stop - keeps same letter)
              actions.setMuted(true);
              setShowCalibrationModal(true);
            }}
            className="px-6 py-4 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Mark current sound as correct (creates calibration snapshot)"
          >
            ✓ IS {currentLetter.toUpperCase()}
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-4 bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Skip to next letter"
          >
            ⏭️ SKIP
          </button>
        </div>
      )}

      {/* Skip Button (when not active) - Top Right */}
      {currentLetter && !state.isActive && (
        <div className={`absolute top-6 right-6 z-20 transition-all`} style={{ marginTop: `${negativeRejections.length * 80}px` }}>
          <button
            onClick={handleSkip}
            className="px-6 py-4 bg-gradient-to-br from-gray-500 to-gray-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105"
            title="Skip to next letter"
          >
            ⏭️ SKIP
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
        {/* Title */}
        <div className="text-white text-2xl font-light tracking-[0.3em] uppercase opacity-70">
          Flashcard Mode
        </div>

        {/* Message */}
        {gameMessage && (
          <div className="text-white text-xl font-medium text-center px-8 py-4 bg-white/20 backdrop-blur-md rounded-full">
            {gameMessage}
          </div>
        )}

        {/* Big Smash Button with Letter */}
        {currentLetter ? (
          <button
            onClick={handleButtonPress}
            disabled={state.isActive}
            className={`relative cursor-pointer select-none ${isButtonPressed ? 'animate-saturation-burst' : ''}`}
            style={{
              width: '504px',
              height: '504px',
              transition: 'all 0.2s ease',
            }}
          >
            {/* Button Image */}
            <img
              src="/images/Smash button.png"
              alt="Smash Button"
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Letter Overlay */}
            <div
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-black pointer-events-none ${isButtonPressed ? 'letter-pop' : ''}`}
              style={{
                fontSize: '288px',
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
            className="px-24 py-6 text-2xl font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all"
          >
            Start
          </button>
        )}

        {/* Volume indicator (when listening) */}
        {state.isActive && (
          <div className="flex flex-col items-center gap-4 w-80">
            <div className="w-full">
              <div className="text-white/70 text-sm mb-2 text-center">Listening...</div>
              <div className="h-6 bg-white/20 backdrop-blur-sm rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-400"
                  style={{ width: `${Math.min(100, (state.volume / 30) * 100)}%` }}
                />
              </div>
            </div>
          </div>
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
