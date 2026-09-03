import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ManageMe — calm productivity',
  description: 'A personal command center for habits, realistic plans, and focused execution.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
