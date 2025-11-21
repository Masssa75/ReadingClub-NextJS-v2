'use client';

import { ReactNode } from 'react';
import Tabs from './Tabs';
import ProfileSelector from './ProfileSelector';
import { ProfileProvider } from '@/app/contexts/ProfileContext';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const handleProfileChange = () => {
    // Trigger page reload to refresh calibrations
    window.location.reload();
  };

  return (
    <ProfileProvider>
      <ProfileSelector onProfileChange={handleProfileChange} />
      <Tabs />
      {children}
    </ProfileProvider>
  );
}
