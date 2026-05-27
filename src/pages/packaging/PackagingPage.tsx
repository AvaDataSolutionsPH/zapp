import { useState, useMemo, useCallback } from 'react';
import {
  Package,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Truck,
  Receipt,
  Info,
  CheckCircle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Table,
  Tabs,
  Badge,
  Button,
  SearchInput,
  EmptyState,
  Stat,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { TableColumn, Tab } from '@/components/ui';
import type { PackagingItem, PackagingOrder } from '@/types';

// ── Cart Item Type ──────────────────────────────────────────────────────

interface CartItem {
  item: PackagingItem;
  quantity: number;
}

// ── Packaging Status Badge Config ───────────────────────────────────────

const packagingStatusConfig: Record<string, { label: string; variant: 'warning' | 'info' | 'success' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  included_in_delivery: { label: 'In Delivery', variant: 'info' },
  billed: { label: 'Billed', variant: 'success' },
};

function PackagingStatusBadge({ status }: { status: string }) {
  const config = packagingStatusConfig[status] ?? { label: status, variant: 'warning' as const };
  return <Badge variant={config.variant} size="sm" dot>{config.label}</Badge>;
}

// ── Catalog Tab Definitions ─────────────────────────────────────────────

const tabDefs: Tab[] = [
  { key: 'catalog', label: 'Packaging Catalog', icon: <Package size={14} /> },
  { key: 'history', label: 'Order History', icon: <Receipt size={14} /> },
];

// ── Main Component ──────────────────────────────────────────────────────

export default function PackagingPage() {
  const {
    packagingCatalog,
    packagingOrders,
    currentUser,
    stores,
    billingRecords,
    deliveries,
    submitPackagingOrder,
  } = useStore();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('catalog');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // Get current user's store
  const userStoreId = useMemo(() => {
    if (currentUser?.assignedStoreIds?.length) return currentUser.assignedStoreIds[0];
    // For owner/operations, default to first store
    return stores[0]?.id ?? '';
  }, [currentUser, stores]);

  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;

  // Filter catalog
  const categories = useMemo(() => {
    const cats = new Set(packagingCatalog.map((item) => item.category));
    return ['all', ...Array.from(cats)];
  }, [packagingCatalog]);

  const filteredCatalog = useMemo(() => {
    let result = [...packagingCatalog];
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q),
      );
    }
    return result;
  }, [packagingCatalog, categoryFilter, catalogSearch]);

  // User's order history
  const userOrders = useMemo(() => {
    if (currentUser?.role === 'owner' || currentUser?.role === 'operations_manager') {
      return packagingOrders;
    }
    return packagingOrders.filter((o) => o.storeId === userStoreId);
  }, [packagingOrders, userStoreId, currentUser]);

  const pagedOrders = useMemo(() => {
    const sorted = [...userOrders].sort((a, b) => b.orderedAt.localeCompare(a.orderedAt));
    const start = (historyPage - 1) * 10;
    return sorted.slice(start, start + 10);
  }, [userOrders, historyPage]);

  // Cart operations
  const addToCart = useCallback((item: PackagingItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.item.id === itemId) {
            const newQty = c.quantity + delta;
            return newQty > 0 ? { ...c, quantity: newQty } : c;
          }
          return c;
        })
        .filter((c) => c.quantity > 0);
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  }, []);

  const setQuantity = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.item.id !== itemId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.item.id === itemId ? { ...c, quantity: qty } : c)),
    );
  }, []);

  const cartTotal = useMemo(
    () => cart.reduce((s, c) => s + c.item.price * c.quantity, 0),
    [cart],
  );

  const cartItemCount = useMemo(
    () => cart.reduce((s, c) => s + c.quantity, 0),
    [cart],
  );

  // Submit order
  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      submitPackagingOrder({
        storeId: userStoreId,
        items: cart.map((c) => ({
          packagingItemId: c.item.id,
          quantity: c.quantity,
          price: c.item.price,
        })),
        totalAmount: cartTotal,
      });
      addToast(
        'success',
        `Packaging order submitted. Total: P${cartTotal.toLocaleString()}.`,
      );
      setCart([]);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    } catch {
      addToast('error', 'Failed to submit packaging order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Next delivery info (simulated)
  const nextDelivery = useMemo(() => {
    const storeDeliveries = deliveries
      .filter((d) => d.storeId === userStoreId && d.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date));
    return storeDeliveries[0] ?? null;
  }, [deliveries, userStoreId]);

  // Find billing record for a packaging order
  const findBillingForOrder = (order: PackagingOrder) => {
    if (order.status !== 'billed') return null;
    // Find billing that includes this order's store and period
    return billingRecords.find(
      (b) => b.storeId === order.storeId && b.packagingTotal > 0,
    );
  };

  const formatCurrency = (n: number) => `P${n.toLocaleString()}`;

  // Stats
  const orderStats = useMemo(() => ({
    totalOrders: userOrders.length,
    pending: userOrders.filter((o) => o.status === 'pending').length,
    totalSpent: userOrders
      .filter((o) => o.status === 'billed')
      .reduce((s, o) => s + o.totalAmount, 0),
  }), [userOrders]);

  // Order history columns
  const orderColumns: TableColumn<PackagingOrder>[] = [
    {
      key: 'id',
      header: 'Order #',
      render: (row) => (
        <span className="font-mono text-sm font-medium text-gray-900">{row.id.toUpperCase()}</span>
      ),
    },
    {
      key: 'storeId',
      header: 'Store',
      render: (row) => <span className="text-sm text-gray-700">{storeName(row.storeId)}</span>,
    },
    {
      key: 'orderedAt',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-gray-700">{new Date(row.orderedAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      render: (row) => {
        const itemNames = row.items.map((i) => {
          const pkg = packagingCatalog.find((p) => p.id === i.packagingItemId);
          return pkg ? `${pkg.name} x${i.quantity}` : `${i.packagingItemId} x${i.quantity}`;
        });
        return (
          <div className="max-w-[200px]">
            <span className="text-sm text-gray-700 truncate block" title={itemNames.join(', ')}>
              {itemNames.slice(0, 2).join(', ')}
              {itemNames.length > 2 && ` +${itemNames.length - 2} more`}
            </span>
          </div>
        );
      },
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (row) => (
        <span className="text-sm font-bold text-gray-900">{formatCurrency(row.totalAmount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <PackagingStatusBadge status={row.status} />,
    },
    {
      key: 'deliveryId',
      header: 'Delivery',
      render: (row) => row.deliveryId ? (
        <span className="font-mono text-xs text-blue-600">{row.deliveryId}</span>
      ) : (
        <span className="text-xs text-gray-400">-</span>
      ),
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (row) => {
        const billing = findBillingForOrder(row);
        return billing ? (
          <span className="font-mono text-xs text-zapp-orange">{billing.id.toUpperCase()}</span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Packaging Orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Order branded packaging materials for your store
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={<Package size={18} />} label="Total Orders" value={orderStats.totalOrders} />
        <Stat icon={<ShoppingCart size={18} />} label="Pending" value={orderStats.pending} />
        <Stat icon={<Receipt size={18} />} label="Total Billed" value={formatCurrency(orderStats.totalSpent)} />
      </div>

      {/* Next Delivery Notice */}
      {nextDelivery && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Truck size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-blue-900">Next Delivery</h3>
                <p className="text-sm text-blue-700 mt-0.5">
                  Scheduled for <span className="font-medium">{new Date(nextDelivery.date).toLocaleDateString()}</span> (DR #{nextDelivery.drNumber}).
                  Packaging orders placed now will be included in this delivery.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        tabs={tabDefs}
        activeTab={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === 'catalog' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Catalog Grid (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Catalog Filters */}
              <div className="flex flex-wrap gap-3">
                <SearchInput
                  value={catalogSearch}
                  onChange={setCatalogSearch}
                  placeholder="Search packaging..."
                  className="w-full sm:w-64"
                />
                <div className="flex gap-1 flex-wrap">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        categoryFilter === cat
                          ? 'bg-zapp-orange text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catalog Grid */}
              {filteredCatalog.length === 0 ? (
                <EmptyState
                  title="No items found"
                  description="Try adjusting your search or filter."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredCatalog.map((item) => {
                    const inCart = cart.find((c) => c.item.id === item.id);
                    return (
                      <Card key={item.id} hover>
                        <CardContent>
                          <div className="flex gap-4">
                            {/* Image placeholder */}
                            <div className="w-20 h-20 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                              <Package size={28} className="text-zapp-orange" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-900">{item.name}</h4>
                                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                </div>
                                <Badge variant="neutral" size="sm">{item.category}</Badge>
                              </div>
                              <div className="flex items-center justify-between mt-3">
                                <span className="text-lg font-bold text-zapp-orange">
                                  {formatCurrency(item.price)}
                                </span>
                                {inCart ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => updateQuantity(item.id, -1)}
                                      className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={inCart.quantity}
                                      onChange={(e) => setQuantity(item.id, parseInt(e.target.value) || 0)}
                                      className="w-12 text-center text-sm font-medium border border-gray-200 rounded-md py-1"
                                    />
                                    <button
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="w-7 h-7 rounded-md bg-zapp-orange text-white flex items-center justify-center hover:bg-zapp-orange-light transition-colors"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    iconLeft={<Plus size={14} />}
                                    onClick={() => addToCart(item)}
                                  >
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart Sidebar (1/3 width) */}
            <div className="space-y-4">
              <Card className="sticky top-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <ShoppingCart size={16} />
                      Order Summary
                    </h3>
                    {cartItemCount > 0 && (
                      <Badge variant="orange" size="sm">{cartItemCount} items</Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent>
                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">Your cart is empty</p>
                      <p className="text-xs text-gray-400 mt-1">Add items from the catalog</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((cartItem) => (
                        <div key={cartItem.item.id} className="flex items-center gap-3 text-sm">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{cartItem.item.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(cartItem.item.price)} x {cartItem.quantity}
                            </p>
                          </div>
                          <span className="font-semibold text-gray-900 shrink-0">
                            {formatCurrency(cartItem.item.price * cartItem.quantity)}
                          </span>
                          <button
                            onClick={() => removeFromCart(cartItem.item.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}

                      {/* Pricing display */}
                      <div className="border-t border-gray-100 pt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal</span>
                          <span className="font-medium text-gray-900">{formatCurrency(cartTotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>Discount</span>
                          <span>P0 (fixed pricing)</span>
                        </div>
                        <div className="flex justify-between text-base font-bold border-t border-gray-100 pt-2">
                          <span className="text-gray-900">Order Total</span>
                          <span className="text-zapp-orange">{formatCurrency(cartTotal)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>

                {cart.length > 0 && (
                  <CardFooter>
                    <div className="space-y-3 w-full">
                      {/* Notices */}
                      <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                        <Info size={14} className="shrink-0 mt-0.5" />
                        <span>Items will be included in your next delivery.</span>
                      </div>
                      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                        <Receipt size={14} className="shrink-0 mt-0.5" />
                        <span>Packaging cost will be added to your billing.</span>
                      </div>

                      {/* Success message */}
                      {submitted && (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                          <CheckCircle size={16} />
                          <span className="font-medium">Order submitted successfully!</span>
                        </div>
                      )}

                      <Button
                        variant="primary"
                        fullWidth
                        loading={submitting}
                        onClick={handleSubmit}
                        iconLeft={<ShoppingCart size={16} />}
                      >
                        Submit Order ({formatCurrency(cartTotal)})
                      </Button>
                    </div>
                  </CardFooter>
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* Order History Tab */
          <div className="space-y-4">
            <Table
              columns={orderColumns}
              data={pagedOrders}
              keyExtractor={(row) => row.id}
              emptyMessage="No packaging orders found."
              pagination={{
                page: historyPage,
                pageSize: 10,
                total: userOrders.length,
                onPageChange: setHistoryPage,
              }}
            />
          </div>
        )}
      </Tabs>
    </div>
  );
}
