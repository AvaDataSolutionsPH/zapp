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
// 2. The product code is immutable once created. It is the join key quoted by
//    every historical delivery, inventory, forecast and special-order line, and
//    it is what the DR scanner matches against. Changing it would orphan all of
//    them. New products let you type it; existing ones show it read-only.
//
// There is deliberately NO delete. Removing a product would orphan the history
// that references it. A discontinued item is better handled by an `active` flag
// (a schema change) than by deletion.

import { useMemo, useState } from 'react';
import { Croissant, Plus, Pencil, Search, Info } from 'lucide-react';
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
  const { skus, addSku, updateSku, currentUser } = useStore();
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skus;
    return skus.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    );
  }, [skus, search]);

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
    if (creating && !form.id.trim()) e.id = 'Product code is required.';
    if (creating && skus.some((s) => s.id === form.id.trim())) e.id = 'This code is already used.';
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
        id: (creating ? form.id.trim() : editing!.id),
        name: form.name.trim(),
        category: form.category.trim(),
        drPrice: Number(form.drPrice),
        srpPrice: Number(form.srpPrice),
        unit: form.unit.trim(),
      };
      if (creating) {
        await addSku(payload);
        addToast('success', `${payload.name} added to the catalog.`);
      } else {
        await updateSku(payload.id, payload);
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
            disabled={!creating}
            helperText={
              creating
                ? 'The code printed on the Delivery Receipt. The DR scanner matches on this.'
                : 'The product code cannot be changed — every past delivery and inventory record refers to it.'
            }
          />
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
