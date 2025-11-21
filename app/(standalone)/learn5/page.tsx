'use client';

import { useState, useRef } from 'react';

export default function Learn5() {
  const [currentLetter] = useState('a');
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleVideo = () => {
    setShowVideo(!showVideo);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(/images/background.jpg)` }} />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: `url(/images/background-wide.jpg)` }} />

      <div className="relative z-10 flex flex-col items-center justify-between h-full py-12">
        <div className="text-white text-5xl font-black tracking-tight drop-shadow-lg animate-pulse">
          Wunderkind
        </div>

        <div
          className="text-[260px] leading-none font-black text-white drop-shadow-2xl hover:scale-110 transition-transform cursor-pointer rotate-[-5deg]"
          onClick={toggleVideo}
        >
          {currentLetter}
        </div>

        <button
          onClick={toggleVideo}
          className="px-24 py-9 text-4xl font-black text-white rounded-full bg-gradient-to-br from-yellow-300 via-pink-300 to-purple-300 shadow-2xl hover:rotate-3 hover:scale-110 active:scale-90 transition-all uppercase border-4 border-white/50"
        >
          🎵 Learn
        </button>
      </div>

      {/* Video Modal */}
      {showVideo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative bg-black rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full mx-4">
            <video
              ref={videoRef}
              className="w-full"
              onEnded={() => setIsPlaying(false)}
            >
              <source src="/videos/Bear.mp4" type="video/mp4" />
            </video>

            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button
                onClick={togglePlayPause}
                className="px-8 py-3 text-xl font-bold text-white rounded-full bg-gradient-to-r from-pink-400 to-purple-400 hover:scale-105 transition-all"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={toggleVideo}
                className="px-8 py-3 text-xl font-bold text-white rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 transition-all"
              >
                ✕ Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
