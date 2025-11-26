'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useProfile } from '@/app/hooks/useProfile';

interface ProfileContextType {
  currentProfile: string;
  currentProfileId: string | null;
  guestProfileId: string | null;
  profileNames: string[];
  isLoading: boolean;
  switchProfile: (profileName: string) => Promise<{ id: string; name: string } | null>;
  createNewProfile: (name: string) => Promise<boolean>;
  loadProfileNames: () => string[];
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profileHook = useProfile();

  return (
    <ProfileContext.Provider value={profileHook}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfileContext() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfileContext must be used within a ProfileProvider');
  }
  return context;
}
