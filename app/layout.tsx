import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './components/ClientLayout';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ReadingClub - Learn Phonics with Your Voice',
  description: 'Interactive phonics learning app with voice recognition',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="min-h-screen flex flex-col items-center p-5 bg-gradient-to-br from-[#667eea] to-[#764ba2]">
          <h1 className="text-5xl font-bold my-5 text-white text-center drop-shadow-[0_0_20px_rgba(124,179,66,0.8)]">
            ReadingClub
          </h1>
          <p className="text-base text-gray-200 mb-5">
            Learn phonics with your voice
          </p>

          <div className="bg-black/70 rounded-[30px] w-[900px] max-w-[95vw] shadow-[0_20px_60px_rgba(0,0,0,0.5)] relative">
            <div className="p-10 relative">
              <ClientLayout>{children}</ClientLayout>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
