import './globals.css';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
  title: 'LocalShop Admin — Platform Management',
  description: 'Local Shop Delivery Platform Administrative Web Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
