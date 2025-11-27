'use client';

import { useState } from 'react';
import { useProfileContext } from '@/app/contexts/ProfileContext';
import ProfileInputModal from './ProfileInputModal';

interface ProfileSelectorProps {
  onProfileChange?: () => void;
}

export default function ProfileSelector({ onProfileChange }: ProfileSelectorProps) {
  const [showProfileInput, setShowProfileInput] = useState(false);
  const {
    currentProfile,
    profileNames,
    isLoading,
    switchProfile,
    createNewProfile,
    loadProfileNames
  } = useProfileContext();

  const handleProfileChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProfile = e.target.value;
    await switchProfile(newProfile);
    if (onProfileChange) {
      onProfileChange();
    }
  };

  const handleCreateNewProfile = async (name: string) => {
    const success = await createNewProfile(name);
    if (success) {
      loadProfileNames();
      if (onProfileChange) {
        onProfileChange();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-4 bg-black/20 rounded-lg">
        <span className="text-gray-400">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="text-center p-4 bg-black/20 rounded-lg">
      <label className="text-gray-400 mr-2.5">👤 Profile:</label>
      <select
        value={currentProfile}
        onChange={handleProfileChange}
        className="py-2 px-4 text-base rounded bg-[#2a2a2a] text-white border border-[#555] cursor-pointer"
      >
        {profileNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <button
        onClick={() => setShowProfileInput(true)}
        className="ml-2.5 py-2 px-4 bg-[#7CB342] text-white border-none rounded cursor-pointer hover:bg-[#8BC34A] transition-colors"
      >
        ➕ New Profile
      </button>

      {/* Profile Input Modal */}
      <ProfileInputModal
        isOpen={showProfileInput}
        onClose={() => setShowProfileInput(false)}
        onSubmit={handleCreateNewProfile}
        variant="admin"
      />
    </div>
  );
}
