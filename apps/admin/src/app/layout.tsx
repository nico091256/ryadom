import './globals.css';
import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Ryadom Admin',
  description: "Ryadom — Toshkent bo'ylab mahalliy do'konlardan yetkazib berish platformasi boshqaruv paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="font-sans">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
