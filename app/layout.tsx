import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ContentBox — Autonomous AI Content Factory',
  description: 'Generate marketing assets instantly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
