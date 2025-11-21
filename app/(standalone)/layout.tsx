import '../globals.css';
import { ProfileProvider } from '@/app/contexts/ProfileContext';

export default function StandaloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="m-0 p-0 overflow-hidden">
        <ProfileProvider>
          {children}
        </ProfileProvider>
      </body>
    </html>
  );
}
