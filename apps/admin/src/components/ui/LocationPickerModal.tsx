'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, TriangleAlert } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Overlay';
import {
  DEFAULT_CENTER,
  GEOCODE_DEBOUNCE_MS,
  loadYandexMaps,
  reverseGeocode,
  roundCoord,
  type LatLng,
  type YMap,
  type YMaps,
  type YPlacemark,
} from '@/lib/yandex-maps';

export interface LocationPickerResult extends LatLng {
  /** Reverse-geocode natijasi; topilmasa bo'sh satr. */
  address: string;
}

function isValidCoord(lat?: number | null, lng?: number | null): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Do'kon joylashuvini Yandex xaritasidan tanlash modali (admin).
 *
 * - Xarita bosilganda yoki marker sudralganda koordinata darhol yangilanadi.
 * - Reverse-geocode bepul tarifni tejash uchun 500ms debounce bilan, faqat
 *   marker joylashgach yuboriladi.
 * - Natija 6 xonali aniqlikda qaytariladi.
 * - Yandex logotipi/shartnoma havolasi default control'lar bilan saqlanadi.
 */
export function LocationPickerModal({
  open,
  onClose,
  initial,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  initial: LatLng | null;
  onConfirm: (result: LocationPickerResult) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMap | null>(null);
  const placemarkRef = useRef<YPlacemark | null>(null);
  const ymapsRef = useRef<YMaps | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const runGeocode = useCallback((next: LatLng) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const ymaps = ymapsRef.current;
      if (!ymaps) {
        setGeocoding(false);
        return;
      }
      const text = await reverseGeocode(ymaps, next);
      setAddress(text);
      setGeocoding(false);
    }, GEOCODE_DEBOUNCE_MS);
  }, []);

  const moveTo = useCallback(
    (next: LatLng) => {
      setCoords(next);
      const pm = placemarkRef.current;
      if (pm) pm.geometry.setCoordinates([next.lat, next.lng]);
      runGeocode(next);
    },
    [runGeocode],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setStatus('loading');
    setGeocoding(false);
    const hasInitial = isValidCoord(initial?.lat, initial?.lng);
    const start: LatLng = hasInitial
      ? { lat: initial!.lat, lng: initial!.lng }
      : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
    setCoords(hasInitial ? start : null);
    setAddress('');

    loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;

        const map = new ymaps.Map(
          containerRef.current,
          { center: [start.lat, start.lng], zoom: 15, controls: ['zoomControl', 'geolocationControl'] },
          { suppressMapOpenBlock: true },
        );
        const placemark = new ymaps.Placemark([start.lat, start.lng], {}, { draggable: true });
        map.geoObjects.add(placemark);

        map.events.add('click', (e) => {
          const [lat, lng] = e.get('coords');
          moveTo({ lat, lng });
        });
        placemark.events.add('dragend', () => {
          const [lat, lng] = placemark.geometry.getCoordinates();
          setCoords({ lat, lng });
          runGeocode({ lat, lng });
        });

        mapRef.current = map;
        placemarkRef.current = placemark;
        setStatus('ready');
        if (hasInitial) runGeocode(start);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      placemarkRef.current = null;
    };
    // initial faqat ochilish paytida o'qiladi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirm = () => {
    if (!coords) return;
    onConfirm({ lat: roundCoord(coords.lat), lng: roundCoord(coords.lng), address });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Xaritadan joylashuvni belgilash"
      description="Xaritaga bosing yoki markerni sudrab do'kon joylashuvini belgilang"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button icon={<MapPin className="h-4 w-4" />} onClick={confirm} disabled={!coords || status !== 'ready'}>
            Bu joyni tanlash
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <div ref={containerRef} className="h-full w-full" />

          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-100/80 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Xarita yuklanmoqda…
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center">
              <TriangleAlert className="h-6 w-6 text-amber-500" />
              <p className="text-sm font-medium text-slate-700">Xaritani yuklab bo'lmadi</p>
              <p className="text-xs text-slate-500">
                Internet aloqasini yoki Yandex Maps kaliti (NEXT_PUBLIC_YANDEX_MAPS_KEY) sozlamasini tekshiring.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin className="h-4 w-4 shrink-0 text-brand-600" />
            {coords ? (
              <span className="font-mono tabular-nums">
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </span>
            ) : (
              <span className="text-slate-500">Nuqta tanlanmagan</span>
            )}
          </div>
          <div className="mt-1.5 flex min-h-[1.25rem] items-center gap-2 text-xs text-slate-500">
            {geocoding ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Manzil aniqlanmoqda…
              </>
            ) : (
              address && <span className="line-clamp-2">{address}</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
