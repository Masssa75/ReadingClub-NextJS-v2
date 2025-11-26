'use client';

import { useState, useEffect } from 'react';
import { PHONEMES } from '@/app/lib/constants';
import { LetterProficiency } from '@/app/lib/types';
import LetterCard from './LetterCard';
import CalibrationModal from './CalibrationModal';
import { supabase } from '@/app/lib/supabase';
import { useProfileContext } from '@/app/contexts/ProfileContext';

const GROUP_LABELS = {
  vowels: 'VOWELS',
  easy: 'EASY CONSONANTS',
  common: 'COMMON CONSONANTS',
  advanced: 'ADVANCED',
};

interface CalibrationGridProps {
  variant?: 'admin' | 'kid';
}

export default function CalibrationGrid({ variant = 'admin' }: CalibrationGridProps = {}) {
  const { currentProfileId, isLoading: profileLoading } = useProfileContext();
  console.log('🔍 CalibrationGrid render - profileLoading:', profileLoading, 'profileId:', currentProfileId);
  const [calibratedLetters, setCalibratedLetters] = useState<Set<string>>(new Set());
  const [proficiencies, setProficiencies] = useState<Record<string, number>>({});
  const [modalLetter, setModalLetter] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 useEffect triggered - currentProfileId:', currentProfileId);
    if (currentProfileId) {
      console.log('🔍 Calling loadCalibrations...');
      loadCalibrations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfileId]);

  const loadCalibrations = async () => {
    console.log('🔍 loadCalibrations called - currentProfileId:', currentProfileId);
    if (!currentProfileId) {
      console.log('🔍 No profileId, returning');
      return;
    }

    try {
      console.log('🔍 Querying calibrations for profile:', currentProfileId);
      const { data, error } = await supabase
        .from('calibrations')
        .select('letter, proficiency')
        .eq('profile_id', currentProfileId);

      if (error) throw error;

      console.log('🔍 Calibrations loaded:', data?.length || 0);
      if (data) {
        const calibrated = new Set(data.map(c => c.letter));
        setCalibratedLetters(calibrated);

        // Load proficiency levels
        const profMap: Record<string, number> = {};
        data.forEach((cal) => {
          profMap[cal.letter] = cal.proficiency ?? LetterProficiency.UNKNOWN;
        });
        setProficiencies(profMap);
        console.log('📊 Loaded proficiencies:', profMap);
      }
    } catch (error) {
      console.error('Error loading calibrations:', error);
    }
  };

  const handleLetterClick = (letter: string) => {
    console.log('Letter clicked:', letter);
    setModalLetter(letter);
  };

  const handleModalClose = () => {
    setModalLetter(null);
  };

  const handleCalibrationSuccess = (letter: string) => {
    console.log('🟢 CalibrationGrid received success for letter:', letter);
    const updatedCalibrated = new Set([...calibratedLetters, letter]);
    setCalibratedLetters(updatedCalibrated);
    console.log('🟢 Updated calibrated letters:', Array.from(updatedCalibrated));

    // Don't auto-advance or auto-close - let user close manually
    // Modal stays open on same letter so they can add more calibrations
  };

  const handleNextLetter = () => {
    if (!modalLetter) return;

    // Find current letter index in PHONEMES array
    const currentIndex = PHONEMES.findIndex(p => p.letter === modalLetter);
    if (currentIndex === -1) return;

    // Get next letter (wrap around to first if at end)
    const nextIndex = (currentIndex + 1) % PHONEMES.length;
    const nextLetter = PHONEMES[nextIndex].letter;

    console.log(`➡️ Advancing from ${modalLetter} to ${nextLetter}`);
    setModalLetter(nextLetter);
  };

  if (profileLoading) {
    return <div className="text-center text-gray-400">Loading profile...</div>;
  }

  if (!currentProfileId) {
    return <div className="text-center text-gray-400">No profile selected</div>;
  }

  // Group phonemes by group
  const groupedPhonemes = PHONEMES.reduce((acc, phoneme) => {
    if (!acc[phoneme.group]) {
      acc[phoneme.group] = [];
    }
    acc[phoneme.group].push(phoneme);
    return acc;
  }, {} as Record<string, typeof PHONEMES>);

  return (
    <div>
      {Object.entries(groupedPhonemes).map(([group, phonemes]) => (
        <div key={group} className="mb-6">
          <div
            className="pt-4 pb-2 text-base border-b-2 border-yellow-400/30 mb-4"
            style={{
              color: '#8B5A00',
              textShadow: '0 1px 2px rgba(255,255,255,0.7)',
              fontWeight: 900,
              letterSpacing: '0.5px'
            }}
          >
            {GROUP_LABELS[group as keyof typeof GROUP_LABELS]}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {phonemes.map((phoneme) => (
              <LetterCard
                key={phoneme.letter}
                phoneme={phoneme}
                isCalibrated={calibratedLetters.has(phoneme.letter)}
                proficiency={proficiencies[phoneme.letter]}
                isRecording={false}
                onClick={() => handleLetterClick(phoneme.letter)}
              />
            ))}
          </div>
        </div>
      ))}

      {modalLetter && (
        <CalibrationModal
          key={modalLetter}
          letter={modalLetter}
          onClose={handleModalClose}
          onSuccess={handleCalibrationSuccess}
          onNext={handleNextLetter}
          variant={variant}
        />
      )}
    </div>
  );
}
