'use client';

import { useState } from 'react';

export default function LetterAnimationDemo() {
  const [activeAnimation, setActiveAnimation] = useState<number | null>(null);

  const triggerAnimation = (optionNum: number) => {
    setActiveAnimation(optionNum);
    setTimeout(() => setActiveAnimation(null), 1500);
  };

  const triggerAll = () => {
    triggerAnimation(4);
    setTimeout(() => triggerAnimation(7), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] p-8">
      <style jsx global>{`
        @keyframes color-pulse {
          0%, 100% { color: #4CAF50; }
          25% { color: #FF9800; }
          50% { color: #E91E63; }
          75% { color: #2196F3; }
        }

        .anim-color-pulse {
          animation: color-pulse 1s ease-in-out;
        }

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

      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-white text-center mb-8 drop-shadow-lg">
          Letter Shape Reinforcement - Animation Options
        </h1>

        <div className="flex justify-center mb-12">
          <button
            onClick={triggerAll}
            className="bg-gradient-to-r from-[#FF5722] to-[#FF9800] text-white px-10 py-4 rounded-full text-xl font-bold shadow-lg hover:scale-105 transition-transform"
          >
            🎬 Trigger All Animations
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Option 4: Color Pulse */}
          <div className="bg-white/95 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 hover:-translate-y-2 transition-transform">
            <h2 className="text-2xl font-bold text-[#667eea] text-center">
              Option 4: Color Pulse
            </h2>

            <div className="w-64 h-64 flex items-center justify-center bg-black/5 rounded-2xl">
              <div
                className={`text-[150px] font-black leading-none ${
                  activeAnimation === 4 ? 'anim-color-pulse' : ''
                }`}
                style={{ color: '#4CAF50' }}
              >
                b
              </div>
            </div>

            <button
              onClick={() => triggerAnimation(4)}
              className="bg-gradient-to-r from-[#7CB342] to-[#8BC34A] text-white px-8 py-3 rounded-full text-lg font-bold shadow-lg hover:scale-105 transition-transform"
            >
              Play Animation
            </button>

            <p className="text-gray-600 text-center text-sm">
              Letter cycles through vibrant colors (green → orange → pink → blue)
            </p>
          </div>

          {/* Option 7: Outline Stroke */}
          <div className="bg-white/95 rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-6 hover:-translate-y-2 transition-transform">
            <h2 className="text-2xl font-bold text-[#667eea] text-center">
              Option 7: Outline Stroke
            </h2>

            <div className="w-64 h-64 flex items-center justify-center bg-black/5 rounded-2xl">
              <div
                className={`text-[150px] font-black leading-none letter-outline ${
                  activeAnimation === 7 ? 'anim-outline-stroke' : ''
                }`}
                style={{ color: '#4CAF50' }}
              >
                b
              </div>
            </div>

            <button
              onClick={() => triggerAnimation(7)}
              className="bg-gradient-to-r from-[#7CB342] to-[#8BC34A] text-white px-8 py-3 rounded-full text-lg font-bold shadow-lg hover:scale-105 transition-transform"
            >
              Play Animation
            </button>

            <p className="text-gray-600 text-center text-sm">
              Animated orange outline appears around the letter shape
            </p>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-white/80 text-lg">
            These animations will be synchronized with the voice saying the letter sound
          </p>
        </div>
      </div>
    </div>
  );
}
