import './globals.css';
import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: "Ryadom Do'kon",
  description: "Ryadom — do'konchilar uchun buyurtmalar, mahsulotlar va do'kon sozlamalarini boshqarish paneli",
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
