// ============================================================
// ZAPP Donuts ERP — Donut Catalog (products + prices)
// ============================================================
//
// Admin maintenance for the `skus` table so product names and prices never
// need a developer.
//
// Editable by Owner / Operations Supervisor — see `canEditCatalog`. No
// migration was needed: 003's `ref_write` already restricts reference tables to
// app_is_admin(), which is exactly those two roles.
//
// ⚠️ TWO THINGS THIS SCREEN MUST KEEP TRUE
//
// 1. Prices are NOT retroactive. Every delivery, inventory line and special
//    order copies drPrice/srpPrice into itself when it is created, so past
//    billing keeps the price that was in force at the time. That is correct —
//    a retroactive change would silently restate statements already sent to
//    franchisees — but it surprises people, so the page says it plainly.
//
// 2. The product code is editable (boss request), but it is the join key quoted
//    by every historical delivery/inventory/forecast/special-order line and what
//    the DR scanner matches on. There is no FK, so a change is DB-legal; past
//    JSONB snapshots keep the OLD code (not retroactive, like prices). The form
//    warns on a change and the store blocks a collision with another code.
//
// 3. Rows are shown in the catalog display order (sortOrder, migration 039) so
//    they match the Delivery Receipt sequence. Up/Down arrows persist it, and
//    fetchSkus orders by it so every donut list downstream follows.
//
// There is deliberately NO delete. Removing a product would orphan the history
// that references it. A discontinued item is better handled by an `active` flag
// (a schema change) than by deletion.

import { useMemo, useState } from 'react';
import { Croissant, Plus, Pencil, Search, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Table } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { canEditCatalog } from '@/lib/catalogPermissions';
import type { SKU } from '@/types';

const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FormState {
  id: string;
  name: string;
  category: string;
  drPrice: string;
  srpPrice: string;
  unit: string;
}

const EMPTY: FormState = { id: '', name: '', category: '', drPrice: '', srpPrice: '', unit: 'pc' };

export default function SkuCatalogPage() {
  const { skus, addSku, updateSku, reorderSku, currentUser } = useStore();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  // null = closed; a SKU = editing it; EMPTY-shaped = creating.
  const [editing, setEditing] = useState<SKU | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  // Owner / OS — mirrors 003's ref_write, which is the real gate.
  const canEdit = canEditCatalog(currentUser?.role);

  // Always shown in display order (sortOrder), so the catalog matches the DR
  // sequence and Up/Down move a row relative to what is on screen.
  const ordered = useMemo(
    () => [...skus].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
    [skus],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [ordered, search]);

  // Reordering is disabled while a search is active: Up/Down would move a row
  // past hidden neighbours, which is not what the arrows appear to promise.
  const canReorder = canEdit && !search.trim();

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    try {
      await reorderSku(id, direction);
    } catch {
      addToast('error', 'Hindi na-save ang bagong ayos.');
    }
  };

  const openCreate = () => {
    setForm(EMPTY);
    setErrors({});
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (sku: SKU) => {
    setForm({
      id: sku.id,
      name: sku.name,
      category: sku.category,
      drPrice: String(sku.drPrice),
      srpPrice: String(sku.srpPrice),
      unit: sku.unit,
    });
    setErrors({});
    setCreating(false);
    setEditing(sku);
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
    setCreating(false);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    const code = form.id.trim();
    if (!code) e.id = 'Product code is required.';
    // A code must be unique. On edit, the row's own current code is allowed
    // (it is not a collision with itself).
    else if (skus.some((s) => s.id === code && s.id !== editing?.id)) {
      e.id = 'This code is already used.';
    }
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.category.trim()) e.category = 'Category is required.';
    const dr = Number(form.drPrice);
    const srp = Number(form.srpPrice);
    if (!form.drPrice.trim() || Number.isNaN(dr) || dr < 0) e.drPrice = 'Enter a valid DR price.';
    if (!form.srpPrice.trim() || Number.isNaN(srp) || srp < 0) e.srpPrice = 'Enter a valid SRP.';
    // Not blocked, only flagged: a promo or a loss-leader is legitimate, so this
    // is a sanity check for a typo (a swapped pair), not a business rule.
    if (!e.drPrice && !e.srpPrice && dr > srp) {
      e.drPrice = 'DR price is higher than SRP — check if these were swapped.';
    }
    if (!form.unit.trim()) e.unit = 'Unit is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: SKU = {
        // Editable now, on create AND edit (boss request).
        id: form.id.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        drPrice: Number(form.drPrice),
        srpPrice: Number(form.srpPrice),
        unit: form.unit.trim(),
        // Preserve the row's place in the display order.
        sortOrder: editing?.sortOrder,
      };
      if (creating) {
        await addSku(payload);
        addToast('success', `${payload.name} added to the catalog.`);
      } else {
        // First arg is the OLD code so the row is found even if the code changed.
        await updateSku(editing!.id, payload);
        addToast('success', `${payload.name} updated. New prices apply to new transactions only.`);
      }
      close();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<SKU>[] = [
    ...(canReorder
      ? [
          {
            key: 'reorder',
            header: 'Order',
            render: (row: SKU) => {
              const idx = filtered.findIndex((s) => s.id === row.id);
              return (
                <div className="flex flex-col">
                  <button
                    type="button"
                    aria-label="Itaas"
                    disabled={idx <= 0}
                    onClick={() => handleReorder(row.id, 'up')}
                    className="cursor-pointer border-none bg-transparent p-0.5 text-gray-400 hover:text-zapp-orange disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Ibaba"
                    disabled={idx >= filtered.length - 1}
                    onClick={() => handleReorder(row.id, 'down')}
                    className="cursor-pointer border-none bg-transparent p-0.5 text-gray-400 hover:text-zapp-orange disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              );
            },
          } as TableColumn<SKU>,
        ]
      : []),
    {
      key: 'id',
      header: 'Product Code',
      render: (row) => <span className="font-mono text-xs text-gray-600">{row.id}</span>,
    },
    {
      key: 'name',
      header: 'Product',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    { key: 'category', header: 'Category' },
    {
      key: 'drPrice',
      header: 'DR Price',
      render: (row) => <span className="font-mono text-sm">{peso(row.drPrice)}</span>,
    },
    {
      key: 'srpPrice',
      header: 'SRP',
      render: (row) => <span className="font-mono text-sm">{peso(row.srpPrice)}</span>,
    },
    { key: 'unit', header: 'Unit' },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: SKU) => (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Pencil size={14} />}
                onClick={() => openEdit(row)}
              >
                Edit
              </Button>
            ),
          } as TableColumn<SKU>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Croissant size={22} className="text-zapp-orange" /> Donut Catalog
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Product names and prices used across deliveries, inventory and billing
          </p>
        </div>
        {canEdit && (
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Add Product
          </Button>
        )}
      </div>

      {/* The single most important thing to know before editing a price. */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Price changes are not retroactive.</p>
          <p className="mt-0.5 text-xs text-amber-800">
            Past deliveries, inventory and billing keep the price that was in effect when they
            were created. A new price applies to new transactions only — existing billing
            statements are never restated.
          </p>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="mb-4 max-w-xs">
            <Input
              placeholder="Search product, code or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={<Search size={16} />}
            />
          </div>
          <Table columns={columns} data={filtered} keyExtractor={(row) => row.id} />
          <p className="mt-3 text-xs text-gray-400">
            {filtered.length} of {skus.length} product(s)
          </p>
        </CardContent>
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={close}
        title={creating ? 'Add Product' : `Edit ${editing?.name ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {creating ? 'Add Product' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Product Code"
            placeholder="e.g. 2000017949"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            error={errors.id}
            helperText="The code printed on the Delivery Receipt. The DR scanner matches on this."
          />
          {!creating && form.id.trim() !== editing?.id && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Heads up:</strong> you are changing the product code. Deliveries and
              inventory recorded under the old code <strong>{editing?.id}</strong> keep that old
              code (they are not rewritten), and future DR scans must use the new code. Only change
              it to match the real Delivery Receipt.
            </p>
          )}
          <Input
            label="Product Name"
            placeholder="e.g. Choco Butternut"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <Input
            label="Category"
            placeholder="e.g. Classic"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            error={errors.category}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="DR Price (₱)"
              type="number"
              step="0.01"
              min="0"
              value={form.drPrice}
              onChange={(e) => setForm({ ...form, drPrice: e.target.value })}
              error={errors.drPrice}
              helperText="What ZAPP bills the store."
            />
            <Input
              label="SRP (₱)"
              type="number"
              step="0.01"
              min="0"
              value={form.srpPrice}
              onChange={(e) => setForm({ ...form, srpPrice: e.target.value })}
              error={errors.srpPrice}
              helperText="Selling price. Drives the 15% / 85% split."
            />
          </div>
          <Input
            label="Unit"
            placeholder="pc"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            error={errors.unit}
          />

          {!creating && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Reminder:</strong> changing a price does not change past records. Previous
              deliveries, inventory and billing keep the price that was used at that time. The new
              price applies to new transactions only.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
