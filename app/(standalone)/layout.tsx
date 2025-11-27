import { ProfileProvider } from '@/app/contexts/ProfileContext';

export default function StandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      {children}
    </ProfileProvider>
  );
}
