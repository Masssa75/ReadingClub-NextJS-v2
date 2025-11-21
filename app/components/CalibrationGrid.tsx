'use client';

import { useState, useEffect } from 'react';
import { PHONEMES } from '@/app/lib/constants';
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

export default function CalibrationGrid() {
  const { currentProfileId, isLoading: profileLoading } = useProfileContext();
  console.log('🔍 CalibrationGrid render - profileLoading:', profileLoading, 'profileId:', currentProfileId);
  const [calibratedLetters, setCalibratedLetters] = useState<Set<string>>(new Set());
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
        .select('letter')
        .eq('profile_id', currentProfileId);

      if (error) throw error;

      console.log('🔍 Calibrations loaded:', data?.length || 0);
      if (data) {
        const calibrated = new Set(data.map(c => c.letter));
        setCalibratedLetters(calibrated);
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

    // Auto-advance to next uncalibrated letter
    const currentIndex = PHONEMES.findIndex(p => p.letter === letter);
    console.log('🟢 Current letter index:', currentIndex);
    for (let i = currentIndex + 1; i < PHONEMES.length; i++) {
      if (!updatedCalibrated.has(PHONEMES[i].letter)) {
        console.log('🟢 Auto-advancing to next letter:', PHONEMES[i].letter);
        setModalLetter(PHONEMES[i].letter);
        return;
      }
    }

    // If no more letters after current, close modal
    console.log('🟢 No more uncalibrated letters, closing modal');
    setModalLetter(null);
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
          <div className="pt-4 pb-2 text-base font-bold text-yellow-400 border-b-2 border-yellow-400/30 mb-4">
            {GROUP_LABELS[group as keyof typeof GROUP_LABELS]}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
            {phonemes.map((phoneme) => (
              <LetterCard
                key={phoneme.letter}
                phoneme={phoneme}
                isCalibrated={calibratedLetters.has(phoneme.letter)}
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
        />
      )}
    </div>
  );
}
