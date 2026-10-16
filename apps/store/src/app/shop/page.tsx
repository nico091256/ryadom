'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Store } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Shop } from '@/lib/types';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, useToast } from '@/components/ui';
import { ShopStatusCard } from '@/components/shop/ShopStatusCard';
import { ShopInfoForm } from '@/components/shop/ShopInfoForm';
import { ShopMetaCard } from '@/components/shop/ShopMetaCard';

function ShopPageSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex flex-1 items-start gap-4">
            <Skeleton className="h-20 w-20 rounded-xl sm:h-24 sm:w-24" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-xl lg:w-[320px]" />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-4 p-5">
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3 p-5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const toast = useToast();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getShop();
      setShop(data ?? null);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOpen = async (isOpen: boolean) => {
    if (!shop || toggling) return;
    const prev = shop.is_open;
    setToggling(true);
    // Optimistic update
    setShop((s) => (s ? { ...s, is_open: isOpen } : s));
    try {
      const updated = await api.updateShop({ is_open: isOpen });
      setShop((s) => (s ? { ...s, ...updated } : updated));
      if (isOpen) toast.success("Do'kon ochildi", 'Mijozlar endi buyurtma bera oladi');
      else toast.success("Do'kon yopildi", 'Yangi buyurtmalar qabul qilinmaydi');
    } catch (e) {
      // Rollback
      setShop((s) => (s ? { ...s, is_open: prev } : s));
      toast.error("Holatni o'zgartirib bo'lmadi", errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const header = (
    <PageHeader
      title="Do'kon"
      description="Do'kon holati, ma'lumotlari va platforma shartlari"
      actions={
        shop ? (
          <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={refreshing} onClick={() => load(true)}>
            Yangilash
          </Button>
        ) : undefined
      }
    />
  );

  if (loading && !shop) {
    return (
      <>
        {header}
        <ShopPageSkeleton />
      </>
    );
  }

  if (error && !shop) {
    return (
      <>
        {header}
        <Card>
          <ErrorState message={error} onRetry={() => load()} />
        </Card>
      </>
    );
  }

  if (!shop) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="Do'kon topilmadi"
            description="Sizning hisobingizga do'kon biriktirilmagan. Administrator bilan bog'laning."
            action={
              <Button variant="secondary" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => load()}>
                Qayta urinish
              </Button>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="space-y-6">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
            <span>Ma'lumotlarni yangilab bo'lmadi: {error}</span>
            <Button variant="ghost" size="sm" onClick={() => load(true)}>
              Qayta urinish
            </Button>
          </div>
        )}

        <ShopStatusCard shop={shop} toggling={toggling} onToggleOpen={toggleOpen} onUpdated={setShop} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ShopInfoForm shop={shop} onSaved={setShop} />
          </div>
          <div className="xl:self-start">
            <ShopMetaCard shop={shop} />
          </div>
        </div>
      </div>
    </>
  );
}
