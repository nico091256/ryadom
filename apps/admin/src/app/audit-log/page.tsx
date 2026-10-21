'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { AuditAction, AuditLogEntry, AuditTargetType, Paginated } from '@/lib/types';
import { AUDIT_ACTIONS, AUDIT_ACTION_META, AUDIT_TARGET_META } from '@/lib/constants';
import { cn, formatDateTime, shortId, timeAgo } from '@/lib/format';
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  Table,
  TableSkeleton,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { UserDrawer } from '@/components/users/UserDrawer';

const LIMIT = 25;
type TargetFilter = 'all' | AuditTargetType;

const TARGET_TABS: { value: TargetFilter; label: string }[] = [
  { value: 'all', label: 'Hammasi' },
  { value: 'shop', label: "Do'konlar" },
  { value: 'order', label: 'Buyurtmalar' },
  { value: 'user', label: 'Foydalanuvchilar' },
  { value: 'product', label: 'Mahsulotlar' },
  { value: 'category', label: 'Kategoriyalar' },
  { value: 'promo', label: 'Promo-kodlar' },
];

/** Keys in `meta` that are internal ids: shown shortened so the row stays readable. */
const ID_KEYS = new Set(['shop_id', 'owner_id', 'parent_id']);

const META_LABELS: Record<string, string> = {
  reason: 'Sabab',
  fields: 'Maydonlar',
  from: 'Avval',
  to: 'Keyin',
  name: 'Nomi',
  name_uz: 'Nomi',
  code: 'Kod',
  discount_percent: 'Chegirma %',
  seller_login: 'Login',
  login: 'Login',
  role: 'Rol',
  is_available: 'Mavjud',
  shop_id: "Do'kon",
  owner_id: 'Egasi',
  parent_id: 'Ota kategoriya',
};

function metaValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map(String).join(', ') || '—';
  if (typeof value === 'boolean') return value ? 'ha' : "yo'q";
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value);
  return ID_KEYS.has(key) ? shortId(s) : s;
}

function MetaChips({ meta }: { meta: AuditLogEntry['meta'] }) {
  const entries = meta ? Object.entries(meta).filter(([, v]) => v !== undefined) : [];
  if (entries.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex max-w-[420px] flex-wrap gap-1.5" title={JSON.stringify(meta)}>
      {entries.map(([k, v]) => (
        <span key={k} className="inline-flex max-w-full items-baseline gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs">
          <span className="shrink-0 text-slate-500">{META_LABELS[k] ?? k}:</span>
          <span className="truncate font-medium text-slate-700">{metaValue(k, v)}</span>
        </span>
      ))}
    </div>
  );
}

type BlockTarget = { id: string; name: string | null; is_blocked: boolean; role: string };

export default function AuditLogPage() {
  const toast = useToast();
  const [target, setTarget] = useState<TargetFilter>('all');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<AuditLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api.getAuditLog({
        targetType: target === 'all' ? undefined : target,
        action: action || undefined,
        page,
        limit: LIMIT,
      });
      if (my !== seq.current) return;
      setResult(r);
      setError(null);
    } catch (e) {
      if (my === seq.current) setError(errorMessage(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [target, action, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [target, action]);

  // Only offer actions that belong to the selected target type.
  const actionOptions = AUDIT_ACTIONS.filter((a) => target === 'all' || a.startsWith(`${target}.`));
  useEffect(() => {
    if (action && !actionOptions.includes(action as AuditAction)) setAction('');
  }, [action, actionOptions]);

  // The user drawer offers block/unblock; perform it here and the new audit row shows up on reload.
  const confirmBlock = async () => {
    if (!blockTarget) return;
    const next = !blockTarget.is_blocked;
    setSaving(true);
    try {
      await api.setUserBlocked(blockTarget.id, next);
      window.dispatchEvent(new CustomEvent('ryadom:user-updated', { detail: { id: blockTarget.id, is_blocked: next } }));
      toast.success(next ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi', blockTarget.name || undefined);
      setBlockTarget(null);
      load();
    } catch (e) {
      toast.error("Amalni bajarib bo'lmadi", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const openTarget = (row: AuditLogEntry) => {
    if (!row.target_id) return;
    if (row.target_type === 'order') setOrderId(row.target_id);
    else if (row.target_type === 'user') setUserId(row.target_id);
    else if (row.target_type === 'shop') window.location.assign(`/shops/${row.target_id}`);
  };

  const rows = result?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Audit jurnali"
        description="Administratorlar bajargan har bir o'zgartirish: kim, nima, qachon va qayerdan"
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <Tabs<TargetFilter> items={TARGET_TABS} value={target} onChange={setTarget} />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Select value={action} onChange={(e) => setAction(e.target.value)} className="sm:w-64" aria-label="Amal">
              <option value="">Barcha amallar</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {AUDIT_ACTION_META[a].label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {error && !result ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Vaqt</TH>
                <TH>Administrator</TH>
                <TH>Amal</TH>
                <TH>Obyekt</TH>
                <TH>Tafsilot</TH>
                <TH>IP</TH>
              </THead>
              <TBody>
                {loading && !result ? (
                  <TableSkeleton rows={10} cols={6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={<ScrollText className="h-6 w-6" />}
                        title="Yozuvlar topilmadi"
                        description="Tanlangan filtr bo'yicha hali hech qanday amal bajarilmagan."
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const actionMeta = AUDIT_ACTION_META[row.action as AuditAction];
                    const targetMeta = AUDIT_TARGET_META[row.target_type as AuditTargetType];
                    const clickable = !!row.target_id && ['order', 'user', 'shop'].includes(row.target_type);
                    return (
                      <TR
                        key={row.id}
                        onClick={clickable ? () => openTarget(row) : undefined}
                        className={cn(loading && 'opacity-60')}
                      >
                        <TD>
                          <p className="text-slate-900">{timeAgo(row.created_at)}</p>
                          <p className="text-xs text-slate-400 tabular-nums">{formatDateTime(row.created_at)}</p>
                        </TD>
                        <TD>
                          <p className="font-medium text-slate-900">{row.actor?.name || 'Administrator'}</p>
                          {row.actor?.login && <p className="font-mono text-xs text-slate-400">@{row.actor.login}</p>}
                        </TD>
                        <TD>
                          <span className={cn('font-medium', actionMeta?.destructive ? 'text-rose-700' : 'text-slate-800')}>
                            {actionMeta?.label ?? row.action}
                          </span>
                          <p className="font-mono text-[11px] text-slate-400">{row.action}</p>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            {targetMeta ? <Badge tone={targetMeta.tone}>{targetMeta.label}</Badge> : <Badge>{row.target_type}</Badge>}
                            {row.target_id && <span className="font-mono text-xs text-slate-500">{shortId(row.target_id)}</span>}
                          </div>
                        </TD>
                        <TD className="whitespace-normal">
                          <MetaChips meta={row.meta} />
                        </TD>
                        <TD className="font-mono text-xs text-slate-500">{row.ip || '—'}</TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
            {result && result.total > 0 && <Pagination page={page} limit={result.limit || LIMIT} total={result.total} onChange={setPage} />}
          </>
        )}
      </Card>

      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      <UserDrawer userId={userId} onClose={() => setUserId(null)} onToggleBlock={setBlockTarget} onOpenOrder={setOrderId} />
      <ConfirmDialog
        open={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        onConfirm={confirmBlock}
        loading={saving}
        tone={blockTarget?.is_blocked ? 'primary' : 'danger'}
        title={blockTarget?.is_blocked ? 'Blokdan chiqarish' : 'Foydalanuvchini bloklash'}
        message={
          blockTarget?.is_blocked
            ? `${blockTarget?.name || 'Foydalanuvchi'} yana ilovadan foydalana oladi.`
            : `${blockTarget?.name || 'Foydalanuvchi'} ilovaga kira olmaydi va buyurtma bera olmaydi.`
        }
        confirmLabel={blockTarget?.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
      />
    </div>
  );
}
