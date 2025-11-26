'use client';

import type { Phoneme } from '@/app/lib/constants';
import { LetterProficiency } from '@/app/lib/types';

interface LetterCardProps {
  phoneme: Phoneme;
  isCalibrated: boolean;
  proficiency?: number;
  isRecording: boolean;
  onClick: () => void;
}

// Brand color proficiency borders (Ultra Minimal)
const PROFICIENCY_COLORS = {
  [LetterProficiency.UNKNOWN]: '#999999',      // Gray (Skip button)
  [LetterProficiency.SOMETIMES]: '#E5C5A8',    // Warm Peach (pastel palette)
  [LetterProficiency.KNOWN]: '#7CB342',        // Green (Start/Play button)
  [LetterProficiency.MASTERED]: '#FDD835',     // Yellow (Big letter display)
};

export default function LetterCard({ phoneme, isCalibrated, proficiency, isRecording, onClick }: LetterCardProps) {
  // Get proficiency border color
  const proficiencyColor = proficiency !== undefined && isCalibrated
    ? PROFICIENCY_COLORS[proficiency as LetterProficiency]
    : null;

  // Build card classes
  let cardClass = 'bg-white/10 rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 hover:bg-white/15';

  if (isRecording) {
    cardClass += ' border-red-500 bg-red-500/20 animate-pulse';
  } else if (proficiencyColor) {
    // Ultra minimal: thick colored border based on proficiency
    cardClass += ' border-[5px]';
  } else if (isCalibrated) {
    cardClass += ' border-[3px] border-green-600 bg-green-600/20';
  } else {
    cardClass += ' border-[3px] border-transparent';
  }

  const letterStyle = isCalibrated
    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 bg-clip-text text-transparent font-bold'
    : '';

  return (
    <div
      className={cardClass}
      onClick={onClick}
      style={proficiencyColor ? {
        borderColor: proficiencyColor,
        boxShadow: proficiency === LetterProficiency.MASTERED
          ? `0 0 30px ${proficiencyColor}66` // Add glow for mastered
          : undefined
      } : undefined}
    >
      <div
        className={`text-5xl font-bold mb-2 ${letterStyle}`}
        style={!isCalibrated ? {
          color: '#6B4423',
          textShadow: '0 2px 4px rgba(255,255,255,0.5)'
        } : undefined}
      >
        {phoneme.letter}
      </div>

      <div
        className="text-xs mt-2"
        style={{
          color: '#6B4423',
          fontWeight: 700,
          textShadow: '0 1px 2px rgba(255,255,255,0.5)'
        }}
      >
        {isCalibrated ? '✓ Calibrated' : 'Click to record'}
      </div>
    </div>
  );
}
