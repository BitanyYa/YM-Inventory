import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YM Inventory Precision Logistics & Repair',
  description: 'Precision inventory, repair parts tracking, and stock management system',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F1F5F9] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
