'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/format';
import { Button, Field, Modal } from '@/components/ui';
import { Textarea } from '@/components/ui/Input';

export const REASON_PRESETS = ['Mahsulot tugagan', "Do'kon yopilmoqda", 'Yetkaza olmaymiz', 'Manzil juda uzoq'];

export function ReasonModal({
  open,
  onClose,
  onSubmit,
  loading,
  title,
  description,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void | Promise<void>;
  loading?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel: string;
}) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setTouched(false);
    }
  }, [open]);

  const reason = text.trim();
  const invalid = reason.length === 0;

  const submit = () => {
    setTouched(true);
    if (invalid) return;
    void onSubmit(reason);
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Bekor
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {REASON_PRESETS.map((p) => {
            const active = text === p;
            return (
              <button
                key={p}
                type="button"
                disabled={loading}
                onClick={() => {
                  setText(p);
                  setTouched(false);
                }}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50',
                  active
                    ? 'bg-rose-600 text-white ring-rose-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50',
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <Field label="Sabab" required error={touched && invalid ? 'Sababni kiriting' : null} hint="Sabab mijozga ko'rsatiladi">
          <Textarea
            autoFocus
            value={text}
            invalid={touched && invalid}
            disabled={loading}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yoki sababni o'zingiz yozing..."
            maxLength={500}
          />
        </Field>
      </div>
    </Modal>
  );
}
