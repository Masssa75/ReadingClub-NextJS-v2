'use client';

import { useState, useRef, useEffect } from 'react';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import { useAuth } from '@/app/hooks/useAuth';
import Link from 'next/link';
import { User } from 'lucide-react';
import ProfileInputModal from './ProfileInputModal';

interface ParentsMenuProps {
  advancedMode?: boolean;
  onAdvancedModeChange?: (enabled: boolean) => void;
  vowelsOnly?: boolean;
  onVowelsOnlyChange?: (enabled: boolean) => void;
  marginOfVictory?: number;
  onMarginOfVictoryChange?: (value: number) => void;
}

export default function ParentsMenu({ advancedMode = false, onAdvancedModeChange, vowelsOnly = false, onVowelsOnlyChange, marginOfVictory = 1, onMarginOfVictoryChange }: ParentsMenuProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showProfileInput, setShowProfileInput] = useState(false);
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { currentProfile, profileNames, switchProfile, createNewProfile, loadProfileNames } = useProfileContext();
  const { user, loading, sendMagicLink, signOut } = useAuth();

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

  const handleCreateProfile = async (name: string) => {
    const success = await createNewProfile(name);
    if (success) {
      loadProfileNames();
      // Reload the page to use new profile
      window.location.reload();
    }
  };

  const handleSendMagicLink = async () => {
    setEmailStatus(null);
    const result = await sendMagicLink(email);

    if (result.success) {
      setEmailStatus({
        type: 'success',
        message: `✅ Magic link sent to ${email}! Check your inbox.`
      });
      setEmail('');
      setTimeout(() => {
        setShowEmailInput(false);
        setEmailStatus(null);
      }, 3000);
    } else {
      setEmailStatus({
        type: 'error',
        message: result.error || 'Failed to send magic link'
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Parents Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-6 py-3 text-lg font-medium text-white/90 rounded-full border-2 border-white/40 bg-white/25 hover:bg-white/35 transition-all flex items-center gap-2"
      >
        <User className="w-5 h-5 text-white" strokeWidth={2} />
        <span>Parents</span>
      </button>

      {/* Dropdown Menu - Bubble Fun Style */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 max-h-[80vh] bg-gradient-to-br from-white/95 to-white/90 backdrop-blur-3xl rounded-[40px] shadow-2xl overflow-y-auto border-4 border-white/80 z-50">
          {/* Top Section with Bouncing Emoji */}
          <div className="text-center pt-8 pb-4 px-8">
            <div className="text-6xl mb-3 animate-[bounce_2s_ease-in-out_infinite]">🌈</div>
            <div className="text-4xl font-black bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              {currentProfile.startsWith('Guest_') ? 'Guest' : currentProfile}
            </div>
          </div>


          {/* Profile Grid - Bubble Cards */}
          <div className="px-8 pb-6">
            <div className="grid grid-cols-2 gap-3 mb-5">
              {profileNames.filter(name => !name.startsWith('Guest_')).map((name) => (
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
                onClick={() => setShowProfileInput(true)}
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
                href="/calibrate"
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

              {/* Vowels Only Toggle (only show if callback provided) */}
              {onVowelsOnlyChange && (
                <button
                  onClick={() => onVowelsOnlyChange(!vowelsOnly)}
                  className={`w-full py-[18px] px-6 rounded-[22px] font-black text-[17px] text-white
                    shadow-lg hover:shadow-xl transition-all duration-300
                    hover:scale-105 flex items-center justify-center gap-3
                    ${vowelsOnly
                      ? 'bg-gradient-to-r from-pink-400 to-purple-400'
                      : 'bg-gradient-to-r from-gray-400 to-gray-500'
                    }`}
                  style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
                >
                  <span>{vowelsOnly ? '📖' : '📚'}</span>
                  <span>Vowels Only: {vowelsOnly ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {/* Margin of Victory Slider (only show if callback provided) */}
              {onMarginOfVictoryChange && (
                <div className="w-full py-4 px-6 rounded-[22px] bg-gradient-to-r from-indigo-100 to-purple-100 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-indigo-800">🎯 Margin Required</span>
                    <span className="text-lg font-black text-indigo-600">{marginOfVictory}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={marginOfVictory}
                    onChange={(e) => onMarginOfVictoryChange(Number(e.target.value))}
                    className="w-full h-3 bg-gradient-to-r from-green-300 via-yellow-300 to-red-300 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-400
                      [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2
                      [&::-moz-range-thumb]:border-indigo-400"
                  />
                  <div className="flex justify-between text-[10px] font-medium text-indigo-600 mt-1">
                    <span>Strict (0%)</span>
                    <span>Forgiving (10%)</span>
                  </div>
                  <div className="text-[10px] text-indigo-600 mt-2 text-center">
                    Other letters must beat target by this margin to win
                  </div>
                </div>
              )}
            </div>

            {/* Auth Section - Divider */}
            <div className="my-5 border-t-4 border-white/30"></div>

            {/* Auth Section */}
            {!loading && (
              <div className="space-y-3">
                {user ? (
                  // Logged In State
                  <div className="space-y-3">
                    <div className="text-center py-3 px-4 rounded-[20px] bg-gradient-to-r from-green-100 to-green-200">
                      <div className="text-sm font-bold text-green-800 mb-1">💾 Synced</div>
                      <div className="text-xs font-medium text-green-700">{user.email}</div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full py-3 px-6 rounded-[20px] font-bold text-sm text-gray-700
                        bg-gradient-to-r from-gray-200 to-gray-300
                        shadow-md hover:shadow-lg transition-all duration-300
                        hover:scale-105"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  // Not Logged In State
                  <>
                    {!showEmailInput ? (
                      <button
                        onClick={() => setShowEmailInput(true)}
                        className="w-full py-[18px] px-6 rounded-[22px] font-black text-[17px] text-white
                          bg-gradient-to-r from-green-400 to-teal-400
                          shadow-lg hover:shadow-xl transition-all duration-300
                          hover:scale-105 flex items-center justify-center gap-3"
                        style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }}
                      >
                        <span>🔄</span>
                        <span>Login / Sync</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-center text-sm font-bold text-purple-600 mb-2">
                          Get a magic link to sync across devices
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMagicLink()}
                          placeholder="your@email.com"
                          className="w-full px-4 py-3 rounded-[18px] border-3 border-purple-300
                            text-gray-800 font-medium text-center
                            focus:outline-none focus:border-purple-500 transition-all"
                        />
                        {emailStatus && (
                          <div className={`text-xs font-medium text-center p-2 rounded-[12px] ${
                            emailStatus.type === 'success'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {emailStatus.message}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSendMagicLink}
                            disabled={!email}
                            className="flex-1 py-3 px-4 rounded-[18px] font-bold text-sm text-white
                              bg-gradient-to-r from-green-400 to-teal-400
                              shadow-md hover:shadow-lg transition-all duration-300
                              hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send Link
                          </button>
                          <button
                            onClick={() => {
                              setShowEmailInput(false);
                              setEmail('');
                              setEmailStatus(null);
                            }}
                            className="px-4 py-3 rounded-[18px] font-bold text-sm text-gray-600
                              bg-gray-200 hover:bg-gray-300 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Input Modal */}
      <ProfileInputModal
        isOpen={showProfileInput}
        onClose={() => setShowProfileInput(false)}
        onSubmit={handleCreateProfile}
        variant="kid"
      />
    </div>
  );
}
