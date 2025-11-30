'use client';

import CalibrationGrid from '@/app/components/CalibrationGrid';
import Link from 'next/link';
import { ProfileProvider } from '@/app/contexts/ProfileContext';

function Calibrate2Page() {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden">
      {/* Background Images (same as /play) */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/images/background.jpg)` }} />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: `url(/images/background-wide.jpg)` }} />

      {/* Back Button - Top Left */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          href="/"
          className="px-6 py-3 text-lg font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all"
        >
          ← Back
        </Link>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-20">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-white text-5xl font-bold mb-4 drop-shadow-lg">
              🎤 Calibrate Your Voice
            </h1>
            <p className="text-white/80 text-xl drop-shadow-md">
              Click each letter and say its sound 5 times
            </p>
          </div>

          {/* Calibration Grid - Styled for Kid-Friendly */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl border-2 border-white/30 p-8 shadow-2xl">
            <CalibrationGrid variant="kid" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Calibrate2PageWithProvider() {
  return (
    <ProfileProvider>
      <Calibrate2Page />
    </ProfileProvider>
  );
}
