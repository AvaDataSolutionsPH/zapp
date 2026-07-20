// ============================================================
// ZAPP Donuts ERP — Packaging Catalog (items + prices)
// ============================================================
//
// Admin maintenance for `packaging_catalog`, the boxes / bags / supplies a
// store orders on the Packaging page. Built for the same reason as the Donut
// Catalog: it is business data, and it was read-only in the app, so changing a
// price meant asking a developer.
//
// Permissions come from `canEditCatalog` (Owner / OS) and are enforced
// server-side by 003's `ref_write`. No migration was needed.
//
// ⚠️ The same two rules as the Donut Catalog, for the same reasons:
//   • Prices are NOT retroactive — a packaging order copies the price into its
//     line when placed, so past orders and billing keep the price of the day.
//   • The item code is immutable once created — every packaging_orders line
//     quotes it, and changing it would orphan them.
//
// No delete, deliberately: it would orphan the order history that references
// the item.

import { useMemo, useState } from 'react';
import { Package, Plus, Pencil, Search, Info } from 'lucide-react';
import { Card, CardContent, Button, Input, Modal, Table } from '@/components/ui';
import type { TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { canEditCatalog } from '@/lib/catalogPermissions';
import type { PackagingItem } from '@/types';

const peso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FormState {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
}

const EMPTY: FormState = { id: '', name: '', description: '', category: '', price: '' };

export default function PackagingCatalogPage() {
  const { packagingCatalog, addPackagingItem, updatePackagingItem, currentUser } = useStore();
  const { addToast } = useToast();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PackagingItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = canEditCatalog(currentUser?.role);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packagingCatalog;
    return packagingCatalog.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [packagingCatalog, search]);

  const openCreate = () => {
    setForm(EMPTY);
    setErrors({});
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (item: PackagingItem) => {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      price: String(item.price),
    });
    setErrors({});
    setCreating(false);
    setEditing(item);
  };

  const close = () => {
    if (saving) return;
    setEditing(null);
    setCreating(false);
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (creating && !form.id.trim()) e.id = 'Item code is required.';
    if (creating && packagingCatalog.some((p) => p.id === form.id.trim())) {
      e.id = 'This code is already used.';
    }
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.category.trim()) e.category = 'Category is required.';
    const price = Number(form.price);
    if (!form.price.trim() || Number.isNaN(price) || price < 0) e.price = 'Enter a valid price.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: PackagingItem = {
        id: creating ? form.id.trim() : editing!.id,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        // Preserved rather than edited here — the image is not part of this
        // form, and dropping it would silently blank the Packaging page tile.
        imageUrl: editing?.imageUrl,
      };
      if (creating) {
        await addPackagingItem(payload);
        addToast('success', `${payload.name} added to the catalog.`);
      } else {
        await updatePackagingItem(payload.id, payload);
        addToast('success', `${payload.name} updated. New prices apply to new orders only.`);
      }
      close();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<PackagingItem>[] = [
    {
      key: 'id',
      header: 'Item Code',
      render: (row) => <span className="font-mono text-xs text-gray-600">{row.id}</span>,
    },
    {
      key: 'name',
      header: 'Item',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.description && <p className="text-xs text-gray-500">{row.description}</p>}
        </div>
      ),
    },
    { key: 'category', header: 'Category' },
    {
      key: 'price',
      header: 'Price',
      render: (row) => <span className="font-mono text-sm">{peso(row.price)}</span>,
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            render: (row: PackagingItem) => (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Pencil size={14} />}
                onClick={() => openEdit(row)}
              >
                Edit
              </Button>
            ),
          } as TableColumn<PackagingItem>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Package size={22} className="text-zapp-orange" /> Packaging Catalog
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Boxes, bags and supplies stores can order, and their prices
          </p>
        </div>
        {canEdit && (
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openCreate}>
            Add Item
          </Button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Price changes are not retroactive.</p>
          <p className="mt-0.5 text-xs text-amber-800">
            Packaging orders already placed keep the price that was in effect when they were
            created. A new price applies to new orders only — existing billing is never restated.
          </p>
        </div>
      </div>

      <Card>
        <CardContent>
          <div className="mb-4 max-w-xs">
            <Input
              placeholder="Search item, code or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              iconLeft={<Search size={16} />}
            />
          </div>
          <Table columns={columns} data={filtered} keyExtractor={(row) => row.id} />
          <p className="mt-3 text-xs text-gray-400">
            {filtered.length} of {packagingCatalog.length} item(s)
          </p>
        </CardContent>
      </Card>

      <Modal
        open={creating || !!editing}
        onClose={close}
        title={creating ? 'Add Packaging Item' : `Edit ${editing?.name ?? ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving}>
              {creating ? 'Add Item' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Item Code"
            placeholder="e.g. pkg-01"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            error={errors.id}
            disabled={!creating}
            helperText={
              creating
                ? 'A short unique code for this item.'
                : 'The item code cannot be changed — every past packaging order refers to it.'
            }
          />
          <Input
            label="Item Name"
            placeholder="e.g. ZAPP Box (6-pc)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={errors.name}
          />
          <Input
            label="Description"
            placeholder="e.g. Branded donut box for 6 pieces"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Category"
              placeholder="e.g. Boxes"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              error={errors.category}
              helperText="Groups the item in the order catalog."
            />
            <Input
              label="Price (₱)"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              error={errors.price}
              helperText="What the store is billed per unit."
            />
          </div>

          {!creating && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Reminder:</strong> changing a price does not change past records. Packaging
              orders already placed keep the price that was used at that time. The new price
              applies to new orders only.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
