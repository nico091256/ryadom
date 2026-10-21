import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/Toast';

// Same typeface as the mobile app (bundled, no runtime font fetch).
const manrope = localFont({
  src: './fonts/Manrope-Variable.ttf',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Ryadom Do'kon",
  description: "Ryadom — do'konchilar uchun buyurtmalar, mahsulotlar va do'kon sozlamalarini boshqarish paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={manrope.variable}>
      <body className="font-sans">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
