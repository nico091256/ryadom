'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';

/** Shop creation lives in a modal on /shops; keep this route for old links. */
export default function NewShopRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/shops?new=1');
  }, [router]);
  return (
    <div className="flex justify-center py-20">
      <Spinner />
    </div>
  );
}
