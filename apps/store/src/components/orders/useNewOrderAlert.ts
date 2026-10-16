'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney, shortId } from '@/lib/format';
import type { Order } from '@/lib/types';

const DEFAULT_TITLE = "Ryadom Do'kon";
const BEEP_REPEAT_MS = 4000;
const TITLE_FLASH_MS = 1000;

export type NotifyPermission = NotificationPermission | 'unsupported';

export interface PendingAlert {
  id: string;
  label: string;
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext || w.webkitAudioContext || null;
}

/** Three short ~880Hz beeps synthesized with the Web Audio API (no audio assets exist in the app). */
function playBeepPattern(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i++) {
    const start = t0 + i * 0.26;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.012);
    gain.gain.setValueAtTime(0.25, start + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  }
}

/**
 * Loud, multi-channel alert for incoming orders:
 *  - repeating synthesized beep every 4s,
 *  - browser Notification (when permission is granted),
 *  - document.title flashing,
 *  - `pending` list for the sticky banner.
 * Everything stops on `acknowledge()` (banner click) or when the last pending order is acted on.
 */
export function useNewOrderAlert() {
  const [pending, setPending] = useState<PendingAlert[]>([]);
  const [permission, setPermission] = useState<NotifyPermission>('unsupported');

  const audioRef = useRef<AudioContext | null>(null);
  const beepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCountRef = useRef(0);

  // Create / resume the AudioContext. Browsers only allow audio after a user gesture, so we also
  // warm it up on the first pointer/key interaction with the page.
  const ensureAudio = useCallback((): AudioContext | null => {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      if (!audioRef.current) audioRef.current = new Ctor();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      return ctx;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPermission(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    const unlock = () => ensureAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [ensureAudio]);

  const stopBeep = useCallback(() => {
    if (beepTimerRef.current) {
      clearInterval(beepTimerRef.current);
      beepTimerRef.current = null;
    }
  }, []);

  const stopTitle = useCallback(() => {
    if (titleTimerRef.current) {
      clearInterval(titleTimerRef.current);
      titleTimerRef.current = null;
    }
    if (typeof document !== 'undefined') document.title = DEFAULT_TITLE;
  }, []);

  const startBeep = useCallback(() => {
    if (beepTimerRef.current) return;
    const tick = () => {
      const ctx = ensureAudio();
      if (!ctx || ctx.state !== 'running') return;
      try {
        playBeepPattern(ctx);
      } catch {
        /* ignore */
      }
    };
    tick();
    beepTimerRef.current = setInterval(tick, BEEP_REPEAT_MS);
  }, [ensureAudio]);

  const startTitleFlash = useCallback(() => {
    if (titleTimerRef.current || typeof document === 'undefined') return;
    let flip = false;
    titleTimerRef.current = setInterval(() => {
      flip = !flip;
      document.title = flip ? `(${pendingCountRef.current}) Yangi buyurtma!` : DEFAULT_TITLE;
    }, TITLE_FLASH_MS);
  }, []);

  const notify = useCallback((order: Order) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification('Yangi buyurtma!', {
        body: `${shortId(order.id)} · ${formatMoney(order.total_amount)}`,
        tag: `order-${order.id}`,
      });
      n.onclick = () => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
        n.close();
      };
    } catch {
      /* Notification constructor may throw on some mobile browsers */
    }
  }, []);

  /** Fire the alert for one new order (idempotent per order id). */
  const trigger = useCallback(
    (order: Order) => {
      setPending((xs) => {
        if (xs.some((p) => p.id === order.id)) return xs;
        const next = [{ id: order.id, label: shortId(order.id) }, ...xs];
        pendingCountRef.current = next.length;
        return next;
      });
      // The updater above may run on the next render; make sure the title shows at least (1) meanwhile.
      if (pendingCountRef.current === 0) pendingCountRef.current = 1;
      startBeep();
      startTitleFlash();
      notify(order);
    },
    [notify, startBeep, startTitleFlash],
  );

  /** Dismiss everything (banner click). */
  const acknowledge = useCallback(() => {
    pendingCountRef.current = 0;
    setPending([]);
    stopBeep();
    stopTitle();
  }, [stopBeep, stopTitle]);

  /** Dismiss one order (it was accepted/rejected or disappeared); stops the alert if none are left. */
  const acknowledgeOrder = useCallback(
    (orderId: string) => {
      setPending((xs) => {
        if (!xs.some((p) => p.id === orderId)) return xs;
        const next = xs.filter((p) => p.id !== orderId);
        pendingCountRef.current = next.length;
        if (next.length === 0) {
          stopBeep();
          stopTitle();
        }
        return next;
      });
    },
    [stopBeep, stopTitle],
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const res = await Notification.requestPermission();
      setPermission(res);
    } catch {
      setPermission(Notification.permission);
    }
  }, []);

  // Stop timers and restore the title when the page unmounts.
  useEffect(() => {
    return () => {
      stopBeep();
      stopTitle();
      if (audioRef.current) {
        void audioRef.current.close().catch(() => {});
        audioRef.current = null;
      }
    };
  }, [stopBeep, stopTitle]);

  return useMemo(
    () => ({ pending, trigger, acknowledge, acknowledgeOrder, permission, requestPermission }),
    [pending, trigger, acknowledge, acknowledgeOrder, permission, requestPermission],
  );
}
