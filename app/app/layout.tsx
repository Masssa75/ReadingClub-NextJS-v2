import type { Metadata } from 'next';
import { Andika } from 'next/font/google';
import './globals.css';
import ClientLayout from './components/ClientLayout';

const andika = Andika({
  subsets: ['latin'],
  weight: ['400', '700'],
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
      <body className={`${andika.className} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
