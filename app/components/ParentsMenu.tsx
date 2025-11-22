'use client';

import { useState, useRef, useEffect } from 'react';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import Link from 'next/link';
import { User } from 'lucide-react';

interface ParentsMenuProps {
  advancedMode?: boolean;
  onAdvancedModeChange?: (enabled: boolean) => void;
}

export default function ParentsMenu({ advancedMode = false, onAdvancedModeChange }: ParentsMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentProfile, profileNames, switchProfile, createNewProfile, loadProfileNames } = useProfileContext();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSwitchProfile = async (profileName: string) => {
    await switchProfile(profileName);
    setIsOpen(false);
    // Reload the page to refresh calibrations
    window.location.reload();
  };

  const handleCreateProfile = async () => {
    const name = prompt('Enter profile name (e.g., "Ophelia", "Rey", "Marc"):');
    if (!name) return;

    const success = await createNewProfile(name);
    if (success) {
      loadProfileNames();
      // Reload the page to use new profile
      window.location.reload();
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Parents Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 text-lg font-medium text-white/90 rounded-full border-2 border-white/40 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all flex items-center gap-2"
      >
        <User className="w-5 h-5 text-white" strokeWidth={2} />
        <span>Parents</span>
      </button>

      {/* Dropdown Menu - Bubble Fun Style */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-3xl rounded-[40px] shadow-2xl overflow-hidden border-4 border-white/80 z-50">
          {/* Top Section with Bouncing Emoji */}
          <div className="text-center pt-8 pb-6 px-8">
            <div className="text-6xl mb-3 animate-[bounce_2s_ease-in-out_infinite]">🌈</div>
            <div className="text-4xl font-black bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              {currentProfile}
            </div>
          </div>

          {/* Profile Grid - Bubble Cards */}
          <div className="px-8 pb-6">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {profileNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleSwitchProfile(name)}
                  className={`
                    px-4 py-4 rounded-[20px] font-extrabold text-center
                    transition-all duration-300 shadow-md
                    ${name === currentProfile
                      ? 'bg-gradient-to-br from-purple-500 to-purple-400 text-white transform rotate-2 scale-110 shadow-lg'
                      : 'bg-gradient-to-br from-yellow-200 to-yellow-300 text-yellow-900 hover:rotate-[-2deg] hover:scale-105 hover:shadow-lg'
                    }
                  `}
                >
                  {name}
                </button>
              ))}
            </div>

            {/* Action Buttons - Rainbow & Star */}
            <div className="space-y-3">
              {/* New Profile - Rainbow Button */}
              <button
                onClick={handleCreateProfile}
                className="w-full py-[18px] px-6 rounded-[22px] font-black text-[17px] text-white
                  bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300
                  shadow-lg hover:shadow-xl transition-all duration-300
                  hover:scale-105 hover:rotate-[-1deg] flex items-center justify-center gap-3"
                style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
              >
                <span>✨</span>
                <span>New Profile</span>
              </button>

              {/* Calibrate - Star Button */}
              <Link
                href="/admin/calibrate"
                onClick={() => setIsOpen(false)}
                className="w-full py-[18px] px-6 rounded-[22px] font-black text-[17px] text-white
                  bg-gradient-to-r from-blue-400 to-purple-400
                  shadow-lg hover:shadow-xl transition-all duration-300
                  hover:scale-105 hover:rotate-1 flex items-center justify-center gap-3"
                style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
              >
                <span>🎤</span>
                <span>Calibrate</span>
              </Link>

              {/* Advanced Mode Toggle (only show if callback provided) */}
              {onAdvancedModeChange && (
                <button
                  onClick={() => onAdvancedModeChange(!advancedMode)}
                  className={`w-full py-[18px] px-6 rounded-[22px] font-black text-[17px] text-white
                    shadow-lg hover:shadow-xl transition-all duration-300
                    hover:scale-105 flex items-center justify-center gap-3
                    ${advancedMode
                      ? 'bg-gradient-to-r from-orange-400 to-red-400'
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                    }`}
                  style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
                >
                  <span>{advancedMode ? '🔧' : '⚙️'}</span>
                  <span>Advanced Mode: {advancedMode ? 'ON' : 'OFF'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
