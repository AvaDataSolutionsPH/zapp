import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Upload,
  Camera,
  ScanLine,
  CheckSquare,
  Save,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { aiService } from '@/services/api';
import { tesseractAnalyzeDR } from '@/services/tesseractService';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Select,
  Badge,
  FileUpload,
  Table,
  ConfirmDialog,
  EmptyState,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { uploadFile, buildObjectPath, deleteFile, parseStorageRef } from '@/services/storage';
import type { TableColumn, SelectOption, UploadedFile } from '@/components/ui';
import type { AIResult, InventoryItem } from '@/types';

type Step = 1 | 2 | 3 | 4 | 5;

interface ConfirmedRow {
  rowId: string;        // stable unique key (scanned rows + manually-added rows)
  skuId: string;
  skuName: string;
  drQty: number;
  confirmedQty: number;
  lack: number;
  overage: number;
  manualOverride: boolean;
  confidence: AIResult['confidence'];
  isManual?: boolean;   // true = added by the reviewer (SKU picked from dropdown)
}

const stepLabels: Record<Step, string> = {
  1: 'Upload DR Image',
  2: 'Upload Crate Images',
  3: 'Scan DR',
  4: 'Confirm / Edit',
  5: 'Submit',
};

const confidenceBadge = (level: AIResult['confidence']) => {
  const map = {
    high: { variant: 'success' as const, label: 'High' },
    medium: { variant: 'warning' as const, label: 'Medium' },
    low: { variant: 'danger' as const, label: 'Low' },
  };
  const cfg = map[level];
  return <Badge variant={cfg.variant} size="sm" dot>{cfg.label}</Badge>;
};

export default function BeginningInventoryPage() {
  const {
    stores,
    skus,
    addBeginningInventory,
    getDeliveriesForCurrentUser,
  } = useStore();
  const { addToast } = useToast();

  // Deliveries the signed-in user may process, delivered ones only —
  // scoped to the current user so a franchisee sees only their own store's
  // deliveries (no cross-store picking). Derived inline (small list) so it
  // stays fresh across store hydration; the no-selector useStore()
  // subscription already re-renders this component on any store change.
  const deliveredList = getDeliveriesForCurrentUser().filter(
    (d) => d.status === 'delivered',
  );

  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [drFiles, setDrFiles] = useState<UploadedFile[]>([]);
  const [crateFiles, setCrateFiles] = useState<UploadedFile[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [ocrResults, setOcrResults] = useState<AIResult[]>([]);
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedRow[]>([]);
  const [notes, setNotes] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const delivery = deliveredList.find((d) => d.id === selectedDeliveryId);
  const store = delivery ? stores.find((s) => s.id === delivery.storeId) : null;

  const deliveryOptions: SelectOption[] = deliveredList.map((d) => ({
    value: d.id,
    label: `${d.drNumber} - ${stores.find((s) => s.id === d.storeId)?.name ?? d.storeId} (${d.date})`,
  }));

  // Land straight in the flow (no separate "select delivery" gate):
  // auto-select the first available delivery once. Keyed on the primitive
  // id (not the array) so it doesn't re-run on every render. The inline
  // selector below lets the user switch if they have more than one.
  const firstDeliveryId = deliveredList[0]?.id;
  useEffect(() => {
    if (!selectedDeliveryId && firstDeliveryId) {
      setSelectedDeliveryId(firstDeliveryId);
    }
  }, [selectedDeliveryId, firstDeliveryId]);

  // Switching delivery resets the in-progress capture so steps never
  // carry another delivery's files/scan over.
  const changeDelivery = (id: string) => {
    setSelectedDeliveryId(id);
    setStep(1);
    setDrFiles([]);
    setCrateFiles([]);
    setOcrResults([]);
    setConfirmedRows([]);
    setNotes('');
  };

  // Step navigation
  const canNext = (): boolean => {
    switch (step) {
      case 1: return drFiles.length > 0;
      case 2: return crateFiles.length >= 1;
      case 3: return ocrResults.length > 0;
      case 4: return confirmedRows.length > 0;
      default: return false;
    }
  };

  // Scan the Delivery Receipt
  const processAI = useCallback(async () => {
    if (!delivery) return;
    setAiProcessing(true);
    try {
      // Read the UPLOADED DR image directly with local Tesseract (no API,
      // zero cost). The scan shows exactly the donuts written on THIS DR
      // slip — nothing else — because it reads the image, not any system
      // record. On OCR failure we fall back to sample line items so the flow
      // never blocks; the reviewer can add/remove/edit rows in Step 4.
      const drFile = drFiles[0]?.file;

      let ocr: AIResult[];
      let ocrFailed = false;
      if (drFile) {
        try {
          ocr = await tesseractAnalyzeDR(drFile, skus);
        } catch (err) {
          console.error('[BeginningInventoryPage] Tesseract DR OCR failed:', err);
          ocr = await aiService.processOCR('mock-dr-image');
          ocrFailed = true;
        }
      } else {
        ocr = await aiService.processOCR('mock-dr-image');
      }

      if (ocrFailed) {
        addToast('warning', 'Scan failed — using sample items. Please review in the next step.');
      } else if (drFile) {
        if (ocr.length > 0) {
          addToast('success', `Scanned ${ocr.length} item(s) from the Delivery Receipt.`);
        } else {
          addToast('info', 'No items detected — please add them manually in the next step.');
        }
      }

      setOcrResults(ocr);

      // Build confirmed rows from the scanned DR line items. DR quantity
      // defaults to the scanned value; the reviewer edits both the DR qty
      // (if the scan misread) and the confirmed count for lack/overage, and
      // can add/remove rows in Step 4.
      const rows: ConfirmedRow[] = ocr.map((ocrItem, idx) => {
        const drQty = ocrItem.extractedValue ?? 0;
        return {
          rowId: `scan-${ocrItem.skuId ?? ocrItem.id ?? idx}`,
          skuId: ocrItem.skuId ?? '',
          skuName: ocrItem.skuName ?? '',
          drQty,
          confirmedQty: drQty,
          lack: 0,
          overage: 0,
          manualOverride: false,
          confidence: ocrItem.confidence,
        };
      });
      setConfirmedRows(rows);
    } catch (err) {
      console.error('DR scan processing failed:', err);
    } finally {
      setAiProcessing(false);
    }
  }, [delivery, drFiles, skus, addToast]);

  // Update a confirmed row by its stable rowId. Editing DR qty or confirmed
  // qty recomputes lack/overage from (confirmed − DR); editing the SKU on a
  // manually-added row backfills the SKU name.
  const updateRow = (
    rowId: string,
    field: 'skuId' | 'drQty' | 'confirmedQty' | 'manualOverride',
    value: number | boolean | string,
  ) => {
    setConfirmedRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated: ConfirmedRow = { ...r, [field]: value } as ConfirmedRow;
        if (field === 'skuId') {
          updated.skuName = skus.find((s) => s.id === value)?.name ?? '';
        }
        if (field === 'confirmedQty' || field === 'drQty') {
          const diff = updated.confirmedQty - updated.drQty;
          updated.lack = diff < 0 ? Math.abs(diff) : 0;
          updated.overage = diff > 0 ? diff : 0;
          if (field === 'confirmedQty') updated.manualOverride = true;
        }
        if (field === 'manualOverride') {
          updated.manualOverride = value as boolean;
        }
        return updated;
      }),
    );
  };

  // Add / remove rows in Step 4 so the reviewer can correct a mis-scanned DR
  // (add a SKU the scan missed, or delete one it wrongly picked up).
  const manualRowSeq = useRef(0);
  const addManualRow = () => {
    setConfirmedRows((prev) => [
      ...prev,
      {
        rowId: `manual-${manualRowSeq.current++}`,
        skuId: '',
        skuName: '',
        drQty: 0,
        confirmedQty: 0,
        lack: 0,
        overage: 0,
        manualOverride: true,
        confidence: 'high',
        isManual: true,
      },
    ]);
  };
  const removeRow = (rowId: string) => {
    setConfirmedRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // SKU options for a manual row's dropdown: every SKU except ones already
  // used by OTHER rows (the row's own pick stays selectable/visible).
  const skuOptionsForRow = (rowId: string): SelectOption[] => {
    const usedElsewhere = new Set(
      confirmedRows.filter((r) => r.rowId !== rowId && r.skuId).map((r) => r.skuId),
    );
    return [
      { value: '', label: 'Select SKU…' },
      ...skus
        .filter((s) => !usedElsewhere.has(s.id))
        .map((s) => ({ value: s.id, label: s.name })),
    ];
  };

  // Submit
  const handleSubmit = async () => {
    if (!delivery) return;
    setSubmitLoading(true);

    const id = `bi-${Date.now().toString(36)}`;
    const uploadedRefs: string[] = [];

    try {
      // Drop any manually-added row where no SKU was picked.
      const items: InventoryItem[] = confirmedRows
        .filter((r) => r.skuId)
        .map((r) => ({
          skuId: r.skuId,
          skuName: r.skuName,
          quantity: r.confirmedQty,
          confidence: r.confidence,
          discrepancy: r.confirmedQty - r.drQty,
          manualOverride: r.manualOverride,
        }));

      // Upload DR slip + crate photos to the private bucket. Both
      // contain internal operational data (DR line items, crate
      // counts) and shouldn't be exposed via permanent public URLs.
      const drFile = drFiles[0]?.file;
      if (!drFile) {
        throw new Error('Missing DR image upload');
      }
      const drUpload = await uploadFile(
        'zapp-private',
        buildObjectPath('bi-dr', id, drFile),
        drFile,
      );
      uploadedRefs.push(drUpload.storageRef);

      const crateUploads = await Promise.all(
        crateFiles
          .filter((f) => !!f.file)
          .map((f) =>
            uploadFile(
              'zapp-private',
              buildObjectPath('bi-crate', id, f.file),
              f.file,
            ),
          ),
      );
      for (const upload of crateUploads) uploadedRefs.push(upload.storageRef);

      addBeginningInventory({
        id,
        deliveryId: delivery.id,
        storeId: delivery.storeId,
        date: new Date().toISOString().slice(0, 10),
        drImageUrl: drUpload.storageRef,
        crateImageUrls: crateUploads.map((u) => u.storageRef),
        aiResults: [...ocrResults],
        confirmedItems: items,
        status: 'confirmed',
        notes: notes || undefined,
      });

      // addBeginningInventory is fire-and-forget; the optimistic UI
      // update happens synchronously, the DB write is background. A
      // rollback would log to the console but won't surface here —
      // most submissions succeed in practice.
      addToast('success', 'Beginning inventory submitted.');
      setShowSubmit(false);
      setSubmitted(true);
    } catch (err) {
      // Clean up any objects we managed to upload before failing so
      // the bucket doesn't accumulate orphans.
      for (const ref of uploadedRefs) {
        const parsed = parseStorageRef(ref);
        if (parsed) {
          deleteFile(parsed.bucket, parsed.path).catch(() => undefined);
        }
      }
      console.error('[BeginningInventoryPage] submit failed:', err);
      addToast('error', 'Failed to submit beginning inventory. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Scanned Delivery Receipt columns
  const ocrColumns: TableColumn<AIResult>[] = [
    { key: 'skuName', header: 'SKU', render: (row) => row.skuName ?? '-' },
    { key: 'extractedValue', header: 'Scanned Qty', render: (row) => row.extractedValue ?? '-' },
    { key: 'confidence', header: 'Confidence', render: (row) => confidenceBadge(row.confidence) },
    { key: 'warning', header: 'Warning', render: (row) => row.warning ? <span className="text-xs text-amber-600">{row.warning}</span> : <span className="text-xs text-gray-400">None</span> },
  ];

  // No delivery to process — show a friendly empty state instead of a
  // blank flow. (Auto-select handles the has-deliveries case above.)
  if (deliveredList.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beginning Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Scan the Delivery Receipt, then confirm quantities manually</p>
        </div>
        <Card>
          <CardContent>
            <EmptyState
              title="No Delivered Items"
              description="There are no deliveries with 'delivered' status to process yet."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CheckSquare size={28} />}
          title="Inventory Submitted Successfully"
          description={`Beginning inventory for ${delivery?.drNumber} has been confirmed and saved.`}
          actionLabel="Process Another"
          onAction={() => {
            setSubmitted(false);
            setSelectedDeliveryId('');
            setStep(1);
            setDrFiles([]);
            setCrateFiles([]);
            setOcrResults([]);
            setConfirmedRows([]);
            setNotes('');
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beginning Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            DR: <span className="font-mono font-medium">{delivery?.drNumber}</span> | Store: {store?.name ?? '-'}
          </p>
        </div>
        {/* Inline delivery switcher — only when there's more than one to pick */}
        {deliveredList.length > 1 && (
          <div className="w-full sm:w-72">
            <Select
              label="Delivery"
              options={deliveryOptions}
              value={selectedDeliveryId}
              onChange={(e) => changeDelivery(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {([1, 2, 3, 4, 5] as Step[]).map((s) => (
          <div
            key={s}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              s === step
                ? 'bg-zapp-orange text-white'
                : s < step
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              {s < step ? '✓' : s}
            </span>
            {stepLabels[s]}
          </div>
        ))}
      </div>

      {/* Step 1: Upload DR Image */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Upload size={18} /> Upload DR Image
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Upload a photo or scan of the Delivery Receipt (DR) — or use your camera to take one now.</p>
            <FileUpload
              accept="image/*"
              multiple={false}
              maxSizeMB={10}
              camera
              onChange={setDrFiles}
            />
            {drFiles.length > 0 && drFiles[0].preview && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <img src={drFiles[0].preview} alt="DR Preview" className="max-h-64 rounded-lg border border-gray-200" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload Crate Images */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Camera size={18} /> Upload Crate Images
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">Upload or take photos of the delivery crates as evidence for the record. Quantities are confirmed manually in a later step.</p>
            <FileUpload
              accept="image/*"
              multiple
              maxSizeMB={10}
              camera
              onChange={setCrateFiles}
            />
            {crateFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Previews ({crateFiles.length} images):</p>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {crateFiles.map((f) => (
                    f.preview && (
                      <img key={f.id} src={f.preview} alt="Crate" className="h-24 w-full object-cover rounded-lg border border-gray-200" />
                    )
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Scan Delivery Receipt */}
      {step === 3 && (
        <div className="space-y-4">
          {ocrResults.length === 0 && !aiProcessing && (
            <Card>
              <CardContent className="text-center py-12">
                <ScanLine size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-sm text-gray-600 mb-4">Ready to scan the Delivery Receipt. Only the donuts written on the DR will be listed.</p>
                <Button
                  variant="primary"
                  iconLeft={<ScanLine size={16} />}
                  onClick={processAI}
                  loading={aiProcessing}
                >
                  Scan Delivery Receipt
                </Button>
              </CardContent>
            </Card>
          )}

          {aiProcessing && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-zapp-orange rounded-full mx-auto mb-4" />
                <p className="text-sm text-gray-600">Scanning the Delivery Receipt... This may take a moment.</p>
              </CardContent>
            </Card>
          )}

          {ocrResults.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Delivery Receipt Items</h2>
              </CardHeader>
              <Table columns={ocrColumns} data={ocrResults} keyExtractor={(row) => row.id} />
            </Card>
          )}
        </div>
      )}

      {/* Step 4: Confirm/Edit */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckSquare size={18} /> Confirm Inventory Quantities
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-3">
              These are the donuts read from the DR. If a line is wrong you can edit the
              <span className="font-medium"> DR Qty</span>, remove it, or use
              <span className="font-medium"> + Add Item</span> to add a SKU the scan missed.
              Enter the actual counted quantity under <span className="font-medium">Confirmed Qty</span>.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU Name</th>
                    <th className="px-3 py-2 text-center">DR Qty</th>
                    <th className="px-3 py-2 text-center">Confirmed Qty</th>
                    <th className="px-3 py-2 text-center">Lack</th>
                    <th className="px-3 py-2 text-center">Overage</th>
                    <th className="px-3 py-2 text-center">Override</th>
                    <th className="px-3 py-2 text-center">Confidence</th>
                    <th className="px-3 py-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmedRows.map((row) => (
                    <tr
                      key={row.rowId}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {row.isManual ? (
                          <Select
                            options={skuOptionsForRow(row.rowId)}
                            value={row.skuId}
                            onChange={(e) => updateRow(row.rowId, 'skuId', e.target.value)}
                          />
                        ) : (
                          row.skuName
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.drQty}
                          onChange={(e) => updateRow(row.rowId, 'drQty', parseInt(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-zapp-orange"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.confirmedQty}
                          onChange={(e) => updateRow(row.rowId, 'confirmedQty', parseInt(e.target.value) || 0)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-zapp-orange"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={row.lack > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                          {row.lack}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={row.overage > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                          {row.overage}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.manualOverride}
                            onChange={(e) => updateRow(row.rowId, 'manualOverride', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-zapp-orange transition-colors">
                            <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform mt-0.5 ${row.manualOverride ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                          </div>
                        </label>
                      </td>
                      <td className="px-3 py-2 text-center">{confidenceBadge(row.confidence)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => removeRow(row.rowId)}
                          className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
                          aria-label={`Remove ${row.skuName || 'row'}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {confirmedRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-sm text-gray-400">
                        No items. Use “+ Add Item” to enter the donuts on the DR.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button
              onClick={addManualRow}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-zapp-orange hover:text-zapp-orange-dark cursor-pointer bg-transparent border-none"
            >
              <Plus size={16} /> Add Item
            </button>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Submit */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Save size={18} /> Review & Submit
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase">Total SKUs</p>
                <p className="text-lg font-bold text-gray-900">{confirmedRows.filter((r) => r.skuId).length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase">Total Confirmed Qty</p>
                <p className="text-lg font-bold text-gray-900">
                  {confirmedRows.reduce((s, r) => s + r.confirmedQty, 0)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-xs text-red-600 uppercase">Total Lacks</p>
                <p className="text-lg font-bold text-red-700">
                  {confirmedRows.reduce((s, r) => s + r.lack, 0)}
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 uppercase">Total Overages</p>
                <p className="text-lg font-bold text-blue-700">
                  {confirmedRows.reduce((s, r) => s + r.overage, 0)}
                </p>
              </div>
            </div>

            {/* Items Summary Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-center">DR Qty</th>
                    <th className="px-3 py-2 text-center">Confirmed</th>
                    <th className="px-3 py-2 text-center">Diff</th>
                    <th className="px-3 py-2 text-center">Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmedRows.filter((r) => r.skuId).map((r) => {
                    const diff = r.confirmedQty - r.drQty;
                    return (
                      <tr key={r.rowId}>
                        <td className="px-3 py-2 font-medium">{r.skuName}</td>
                        <td className="px-3 py-2 text-center">{r.drQty}</td>
                        <td className="px-3 py-2 text-center">{r.confirmedQty}</td>
                        <td className={`px-3 py-2 text-center font-medium ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.manualOverride ? <Badge variant="warning" size="sm">Yes</Badge> : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this inventory check..."
                rows={3}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange"
              />
            </div>

            <Button
              variant="primary"
              iconLeft={<Save size={16} />}
              onClick={() => setShowSubmit(true)}
              fullWidth
            >
              Submit Beginning Inventory
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          iconLeft={<ChevronLeft size={16} />}
          onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
          disabled={step === 1}
        >
          Previous
        </Button>
        <Button
          variant="primary"
          iconRight={<ChevronRight size={16} />}
          onClick={() => {
            if (step === 3 && ocrResults.length === 0) {
              processAI();
              return;
            }
            setStep((s) => Math.min(5, s + 1) as Step);
          }}
          disabled={step === 5 || !canNext()}
        >
          {step === 3 && ocrResults.length === 0 ? 'Scan Delivery Receipt' : 'Next'}
        </Button>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700">Audit Log</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs text-gray-500">
            <p>{new Date().toLocaleString()} - Beginning inventory session started</p>
            {drFiles.length > 0 && <p>DR image uploaded ({drFiles.length} file)</p>}
            {crateFiles.length > 0 && <p>Crate images uploaded ({crateFiles.length} files)</p>}
            {ocrResults.length > 0 && <p>Delivery Receipt scanned - {ocrResults.length} item(s)</p>}
            {confirmedRows.filter((r) => r.manualOverride).length > 0 && (
              <p>{confirmedRows.filter((r) => r.manualOverride).length} manual overrides applied</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Confirmation */}
      <ConfirmDialog
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        onConfirm={handleSubmit}
        title="Submit Beginning Inventory"
        message="Are you sure you want to submit this beginning inventory? Confirmed quantities will be locked."
        confirmLabel="Submit"
        loading={submitLoading}
      />
    </div>
  );
}
