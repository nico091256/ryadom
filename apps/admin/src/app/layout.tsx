import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import { I18nProvider } from '@/lib/i18n';

// Same typeface as the mobile app (bundled, no runtime font fetch).
const manrope = localFont({
  src: './fonts/Manrope-Variable.ttf',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ryadom Admin',
  description: "Ryadom — Toshkent bo'ylab mahalliy do'konlardan yetkazib berish platformasi boshqaruv paneli",
  openGraph: {
    title: 'Ryadom Admin',
    description: "Ryadom — Toshkent bo'ylab mahalliy do'konlardan yetkazib berish platformasi boshqaruv paneli",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={manrope.variable}>
      <body className="font-sans">
        <I18nProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
