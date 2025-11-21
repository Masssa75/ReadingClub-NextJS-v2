'use client';

import type { Phoneme } from '@/app/lib/constants';

interface LetterCardProps {
  phoneme: Phoneme;
  isCalibrated: boolean;
  isRecording: boolean;
  onClick: () => void;
}

export default function LetterCard({ phoneme, isCalibrated, isRecording, onClick }: LetterCardProps) {
  const cardClass = `
    bg-white/10 rounded-2xl p-5 text-center cursor-pointer
    border-3 transition-all duration-300
    hover:bg-white/15
    ${isRecording ? 'border-red-500 bg-red-500/20 animate-pulse' : 'border-transparent'}
    ${isCalibrated ? 'border-green-600 bg-green-600/20' : ''}
  `;

  const letterStyle = isCalibrated
    ? 'bg-gradient-to-br from-yellow-400 to-orange-500 bg-clip-text text-transparent font-bold'
    : '';

  return (
    <div className={cardClass} onClick={onClick}>
      <div className={`text-5xl font-bold mb-2 ${letterStyle}`}>
        {phoneme.letter}
      </div>
      <div className="text-sm text-gray-400 mb-1">
        {phoneme.hint}
      </div>
      <div className="text-xs mt-2">
        {isCalibrated ? '✓ Calibrated' : 'Click to record'}
      </div>
    </div>
  );
}
