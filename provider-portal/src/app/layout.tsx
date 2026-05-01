import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'MedTracker — Clinician Portal',
  description: 'Monitor patient medication adherence and effectiveness',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-sans antialiased bg-[#FDFBED] text-[#0C1618]`}>
        {children}
      </body>
    </html>
  );
}
