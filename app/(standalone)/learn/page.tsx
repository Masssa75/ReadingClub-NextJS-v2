'use client';

import { useState } from 'react';

export default function LearnPage() {
  const [currentLetter, setCurrentLetter] = useState('A');

  const playSound = () => {
    // Play letter audio - you can customize the audio path
    const audio = new Audio(`/audio/letters/${currentLetter.toLowerCase()}.mp3`);
    audio.play().catch(err => console.log('Audio playback failed:', err));
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col">
      {/* Background Image - Responsive */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(/images/background.jpg)`, // Portrait for mobile
        }}
      />
      {/* Wide background for iPad landscape and desktop */}
      <div
        className="absolute inset-0 bg-cover bg-center hidden md:block"
        style={{
          backgroundImage: `url(/images/background-wide.jpg)`,
        }}
      />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-8 py-12">

        {/* App Title */}
        <div className="text-center pt-4">
          <h1 className="text-white text-4xl font-bold tracking-wide drop-shadow-lg">
            Wunderkind
          </h1>
        </div>

        {/* Letter Display - Centered */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[240px] leading-none font-bold text-white drop-shadow-2xl select-none">
            {currentLetter}
          </div>
        </div>

        {/* Learn Button - Bottom */}
        <div className="pb-16">
          <button
            onClick={playSound}
            className="px-20 py-8 text-4xl font-bold text-white rounded-full
                     bg-gradient-to-r from-pink-300 via-orange-200 to-pink-300
                     shadow-2xl hover:shadow-3xl active:scale-95
                     transition-all duration-200 ease-out
                     hover:from-pink-400 hover:via-orange-300 hover:to-pink-400
                     uppercase tracking-wide"
          >
            LEARN
          </button>
        </div>
      </div>
    </div>
  );
}
