'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Unlock, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import type { Paginated, UserRow } from '@/lib/types';
import { ROLE_META } from '@/lib/constants';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { useDebounce } from '@/lib/hooks';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
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
import { UserDrawer } from '@/components/users/UserDrawer';
import { OrderDrawer } from '@/components/orders/OrderDrawer';

const LIMIT = 20;
type RoleFilter = 'all' | 'customer' | 'seller' | 'admin';
type BlockTarget = { id: string; name: string | null; is_blocked: boolean; role: string };

export default function UsersPage() {
  const toast = useToast();
  const [role, setRole] = useState<RoleFilter>('all');
  const [blocked, setBlocked] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q.trim());
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<UserRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [target, setTarget] = useState<BlockTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const r = await api.getUsers({
        q: dq || undefined,
        role: role === 'all' ? undefined : role,
        blocked: blocked || undefined,
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
  }, [dq, role, blocked, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPage(1), [dq, role, blocked]);

  const confirmBlock = async () => {
    if (!target) return;
    const next = !target.is_blocked;
    setSaving(true);
    try {
      await api.setUserBlocked(target.id, next);
      setResult((r) => (r ? { ...r, data: r.data.map((u) => (u.id === target.id ? { ...u, is_blocked: next } : u)) } : r));
      window.dispatchEvent(new CustomEvent('ryadom:user-updated', { detail: { id: target.id, is_blocked: next } }));
      toast.success(next ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi blokdan chiqarildi', target.name || undefined);
      setTarget(null);
    } catch (e) {
      toast.error("Amalni bajarib bo'lmadi", errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const rows = result?.data ?? [];

  return (
    <div>
      <PageHeader title="Foydalanuvchilar" description="Mijozlar, sotuvchilar va administratorlar" />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 pt-3 lg:flex-row lg:items-end lg:justify-between">
          <Tabs<RoleFilter>
            items={[
              { value: 'all', label: 'Hammasi' },
              { value: 'customer', label: 'Mijozlar' },
              { value: 'seller', label: 'Sotuvchilar' },
              { value: 'admin', label: 'Adminlar' },
            ]}
            value={role}
            onChange={setRole}
          />
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Select value={blocked} onChange={(e) => setBlocked(e.target.value)} className="sm:w-44" aria-label="Holat">
              <option value="">Barcha holatlar</option>
              <option value="false">Faol</option>
              <option value="true">Bloklangan</option>
            </Select>
            <SearchInput value={q} onChange={setQ} placeholder="Ism, telefon yoki login" className="sm:w-72" />
          </div>
        </div>

        {error && !result ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            <Table>
              <THead>
                <TH>Foydalanuvchi</TH>
                <TH>Rol</TH>
                <TH>Telefon / login</TH>
                <TH align="right">Buyurtmalar</TH>
                <TH align="right">Jami xarid</TH>
                <TH>Ro'yxatdan o'tgan</TH>
                <TH>Holat</TH>
                <TH />
              </THead>
              <TBody>
                {loading && !result ? (
                  <TableSkeleton rows={8} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon={<Users className="h-6 w-6" />} title="Foydalanuvchilar topilmadi" description="Qidiruv yoki filtrni o'zgartiring." />
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => {
                    const meta = ROLE_META[u.role];
                    return (
                      <TR key={u.id} onClick={() => setUserId(u.id)} className={loading ? 'opacity-60' : undefined}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {(u.name || u.login || u.phone || '?').replace('+', '')[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[200px] truncate font-medium text-slate-900">{u.name || 'Ismsiz'}</p>
                              {u.shop && <p className="max-w-[200px] truncate text-xs text-slate-400">{u.shop.name}</p>}
                            </div>
                          </div>
                        </TD>
                        <TD>{meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : u.role}</TD>
                        <TD>
                          <p className="tabular-nums text-slate-700">{u.phone || '—'}</p>
                          {u.login && <p className="font-mono text-xs text-slate-400">@{u.login}</p>}
                        </TD>
                        <TD align="right" className="tabular-nums">
                          {formatNumber(u.ordersCount)}
                        </TD>
                        <TD align="right" className="tabular-nums">
                          {formatMoney(u.totalSpentTiyin)}
                        </TD>
                        <TD className="text-slate-500">{formatDate(u.created_at)}</TD>
                        <TD>
                          {u.is_blocked ? (
                            <Badge tone="red" dot>
                              Bloklangan
                            </Badge>
                          ) : (
                            <Badge tone="green" dot>
                              Faol
                            </Badge>
                          )}
                        </TD>
                        <TD align="right">
                          {u.role !== 'admin' && (
                            <Button
                              size="sm"
                              variant={u.is_blocked ? 'secondary' : 'outline-danger'}
                              icon={u.is_blocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTarget(u);
                              }}
                            >
                              {u.is_blocked ? 'Ochish' : 'Bloklash'}
                            </Button>
                          )}
                        </TD>
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

      <UserDrawer userId={userId} onClose={() => setUserId(null)} onToggleBlock={setTarget} onOpenOrder={setOrderId} />
      <OrderDrawer orderId={orderId} onClose={() => setOrderId(null)} />
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={confirmBlock}
        loading={saving}
        tone={target?.is_blocked ? 'primary' : 'danger'}
        title={target?.is_blocked ? 'Blokdan chiqarish' : 'Foydalanuvchini bloklash'}
        message={
          target?.is_blocked
            ? `${target?.name || 'Foydalanuvchi'} yana ilovadan foydalana oladi.`
            : `${target?.name || 'Foydalanuvchi'} ilovaga kira olmaydi va buyurtma bera olmaydi.`
        }
        confirmLabel={target?.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
      />
    </div>
  );
}
