'use client';

import { useState, useRef } from 'react';

export default function Learn6() {
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

      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-32">
        <div className="flex flex-col items-center gap-8">
          <div className="text-white/60 text-base font-light tracking-[0.4em] uppercase">Wunderkind</div>
          <div
            className="text-[300px] leading-none font-light text-white drop-shadow-xl cursor-pointer hover:scale-110 transition-transform"
            onClick={toggleVideo}
          >
            {currentLetter}
          </div>
        </div>

        <button
          onClick={toggleVideo}
          className="px-20 py-6 text-xl font-medium text-white/90 rounded-full backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all border border-white/30 tracking-wider uppercase"
        >
          Learn
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
                className="px-8 py-3 text-xl font-medium text-white/90 rounded-full backdrop-blur-md bg-white/20 hover:bg-white/30 transition-all border border-white/30"
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
              <button
                onClick={toggleVideo}
                className="px-8 py-3 text-xl font-medium text-white/90 rounded-full backdrop-blur-md bg-white/20 hover:bg-white/30 transition-all border border-white/30"
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
