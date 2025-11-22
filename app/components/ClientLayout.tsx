'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Tabs from './Tabs';
import ProfileSelector from './ProfileSelector';
import { ProfileProvider } from '@/app/contexts/ProfileContext';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith('/admin');

  const handleProfileChange = () => {
    // Trigger page reload to refresh calibrations
    window.location.reload();
  };

  // For non-admin pages, just render children without navigation chrome
  if (!isAdminPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-5 bg-gradient-to-br from-[#667eea] to-[#764ba2]">
      <h1 className="text-5xl font-bold my-5 text-white text-center drop-shadow-[0_0_20px_rgba(124,179,66,0.8)]">
        ReadingClub
      </h1>
      <p className="text-base text-gray-200 mb-5">
        Learn phonics with your voice
      </p>

      <div className="bg-black/70 rounded-[30px] w-[900px] max-w-[95vw] shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
        <div className="p-10 relative">
          <ProfileProvider>
            <ProfileSelector onProfileChange={handleProfileChange} />
            <Tabs />
            {children}
          </ProfileProvider>
        </div>
      </div>
    </div>
  );
}
