'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send, CheckCircle2, AlertCircle, RefreshCw, Unlink, ExternalLink } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button, Card, CardHeader, useToast } from '@/components/ui';

interface TelegramStatus {
  is_linked: boolean;
  telegram_chat_id: string | null;
  bot_username: string | null;
  link_url: string | null;
  shop_id: string;
}

export function TelegramNotificationsCard() {
  const toast = useToast();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.getTelegramStatus();
      setStatus(data);
    } catch (err) {
      // If error or disabled, status stays null
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUnlink = async () => {
    if (!confirm('Haqiqatan ham Telegram bot ulanishini uzmoqchimisiz?')) return;
    setUnlinking(true);
    try {
      await api.unlinkTelegram();
      toast.success('Telegram bot uzildi', 'Endi yangi buyurtmalar Telegramga yuborilmaydi');
      await fetchStatus(true);
    } catch (e) {
      toast.error('Xatolik', errorMessage(e));
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title="Telegram xabarnomalar" description="Yuklanmoqda..." />
        <div className="p-5 animate-pulse space-y-3">
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-8 bg-slate-100 rounded-lg w-2/3" />
        </div>
      </Card>
    );
  }

  const isLinked = status?.is_linked;
  const botUsername = status?.bot_username || 'ryadomuz_bot';
  const linkUrl = status?.link_url || `https://t.me/${botUsername}`;

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Telegram xabarnomalar</h3>
          <p className="text-xs text-slate-500">Yangi buyurtmalar kelganda do‘konchini tezkor ogohlantirish</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          title="Holatni tekshirish"
        >
          <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="p-5 space-y-4">
        {isLinked ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900">Telegram bot ulangan</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Bot: <b>@{botUsername}</b> (Chat ID: {status?.telegram_chat_id})
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Yangi buyurtma tushgan zahoti Telegramingizga to‘liq tafsilotlar va &quot;Qabul qilish&quot; tugmasi boradi.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">Boshqa akkauntga ulash uchun uzing</span>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinking}
              >
                <Unlink className="h-4 w-4 mr-1.5" />
                Ulanishni uzish
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Telegram bot ulanmagan</p>
                <p className="text-xs text-amber-700 mt-1">
                  Xaridor zakaz berganda 10 daqiqa ichida qabul qilmasangiz zakaz bekor bo‘ladi. Telegram bot orqali har bir buyurtmadan soniyalar ichida xabardor bo‘ling.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <Send className="h-4 w-4" />
                <span>Telegram botni ulash (@{botUsername})</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>

              <p className="text-center text-xs text-slate-500">
                Tugmani bosib botga kiring va <b>Boshlash (Start)</b> tugmasini bosing. Do‘koningiz avtomatik biriktiriladi.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
