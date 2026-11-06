import type { Metadata } from 'next';
import { Prompt, Sarabun } from 'next/font/google';
import './globals.css';

const display = Prompt({
  subsets: ['latin', 'thai'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Sarabun({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Seven Nights of Wishes · Loy Krathong',
  description:
    'One krathong. Seven destinations. A river of wishes. Float a krathong for Loy Krathong, Tuesday 24 November 2026, Bangkok — and see everyone’s wishes on the shared river.',
  openGraph: {
    title: 'Seven Nights of Wishes · Loy Krathong',
    description: 'Float a krathong and watch it join a river of wishes from everyone.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
