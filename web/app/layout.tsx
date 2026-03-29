import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sana Health — AI Health Co-Pilot',
  description: 'Personalized, evidence-based health guidance grounded in peer-reviewed research.',
};

/**
 * Root Next.js layout wrapping all pages.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
