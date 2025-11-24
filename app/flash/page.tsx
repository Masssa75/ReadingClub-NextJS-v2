'use client';

import { useState } from 'react';

export default function LetterAnimationDemo() {
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8 flex items-center justify-center">
      <style jsx global>{`
        .letter-outline {
          position: relative;
        }

        .letter-outline::before {
          content: 'b';
          position: absolute;
          font-size: 150px;
          font-weight: 900;
          color: transparent;
          -webkit-text-stroke: 4px #FF5722;
          opacity: 0;
          left: 0;
          top: 0;
        }

        @keyframes outline-stroke {
          0% {
            opacity: 0;
            -webkit-text-stroke-width: 0px;
          }
          50% {
            opacity: 1;
            -webkit-text-stroke-width: 8px;
          }
          100% {
            opacity: 0;
            -webkit-text-stroke-width: 4px;
          }
        }

        .anim-outline-stroke::before {
          animation: outline-stroke 1s ease-in-out;
        }
      `}</style>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-5xl font-bold text-white text-center mb-12 drop-shadow-lg">
          Letter Shape Reinforcement
        </h1>

        <div className="bg-white/95 rounded-3xl p-12 shadow-2xl flex flex-col items-center gap-8">
          <h2 className="text-3xl font-bold text-[#667eea] text-center">
            Outline Stroke Animation
          </h2>

          <div className="w-80 h-80 flex items-center justify-center bg-black/5 rounded-2xl">
            <div
              className={`text-[150px] font-black leading-none letter-outline ${
                isAnimating ? 'anim-outline-stroke' : ''
              }`}
              style={{ color: '#4CAF50' }}
            >
              b
            </div>
          </div>

          <button
            onClick={triggerAnimation}
            className="bg-gradient-to-r from-[#7CB342] to-[#8BC34A] text-white px-12 py-4 rounded-full text-xl font-bold shadow-lg hover:scale-105 transition-transform"
          >
            Play Animation
          </button>

          <p className="text-gray-600 text-center text-lg">
            Animated orange outline appears around the letter shape.<br />
            This will be synchronized with the voice saying the letter sound.
          </p>
        </div>
      </div>
    </div>
  );
}
