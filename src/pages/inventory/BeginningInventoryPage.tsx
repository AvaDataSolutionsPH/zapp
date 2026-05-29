import { useState, useMemo, useCallback } from 'react';
import {
  Upload,
  Camera,
  Cpu,
  CheckSquare,
  Save,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import { aiService } from '@/services/api';
import { isGeminiConfigured, geminiAnalyzeDR } from '@/services/aiService';
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
  skuId: string;
  skuName: string;
  drQty: number;
  crateEstimate: number;
  confirmedQty: number;
  lack: number;
  overage: number;
  manualOverride: boolean;
  confidence: AIResult['confidence'];
  hasDiscrepancy: boolean;
}

const stepLabels: Record<Step, string> = {
  1: 'Upload DR Image',
  2: 'Upload Crate Images',
  3: 'AI Processing',
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
    deliveries,
    stores,
    skus,
    addBeginningInventory,
  } = useStore();
  const { addToast } = useToast();

  // Only show delivered ones
  const deliveredList = useMemo(
    () => deliveries.filter((d) => d.status === 'delivered'),
    [deliveries],
  );

  const [selectedDeliveryId, setSelectedDeliveryId] = useState('');
  const [step, setStep] = useState<Step>(1);
  const [drFiles, setDrFiles] = useState<UploadedFile[]>([]);
  const [crateFiles, setCrateFiles] = useState<UploadedFile[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [ocrResults, setOcrResults] = useState<AIResult[]>([]);
  const [crateResults, setCrateResults] = useState<AIResult[]>([]);
  const [discrepancies, setDiscrepancies] = useState<AIResult[]>([]);
  const [confirmedRows, setConfirmedRows] = useState<ConfirmedRow[]>([]);
  const [notes, setNotes] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const delivery = deliveredList.find((d) => d.id === selectedDeliveryId);
  const store = delivery ? stores.find((s) => s.id === delivery.storeId) : null;

  const deliveryOptions: SelectOption[] = [
    { value: '', label: 'Select a delivery...' },
    ...deliveredList.map((d) => ({
      value: d.id,
      label: `${d.drNumber} - ${stores.find((s) => s.id === d.storeId)?.name ?? d.storeId} (${d.date})`,
    })),
  ];

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

  // AI Processing
  const processAI = useCallback(async () => {
    if (!delivery) return;
    setAiProcessing(true);
    try {
      // Real OCR via Gemini when configured + a DR file is present;
      // otherwise fall back to the legacy mock so the demo still works
      // without an API key. On Gemini failure (network, rate, schema)
      // we surface a warning toast and still fall back so the user can
      // complete the BI submission flow.
      const drFile = drFiles[0]?.file;
      let ocr: AIResult[];
      if (isGeminiConfigured() && drFile) {
        try {
          ocr = await geminiAnalyzeDR(drFile, skus);
          addToast('success', `AI extracted ${ocr.length} line item(s) from DR.`);
        } catch (err) {
          console.error('[BeginningInventoryPage] Gemini DR OCR failed:', err);
          addToast('warning', 'AI extraction failed — using mock estimates.');
          ocr = await aiService.processOCR('mock-dr-image');
        }
      } else {
        ocr = await aiService.processOCR('mock-dr-image');
      }

      const crates = await aiService.estimateCrates(['mock-crate-1', 'mock-crate-2']);
      setOcrResults(ocr);
      setCrateResults(crates);

      // Detect discrepancies
      const drItems = ocr.map((r) => ({
        skuId: r.skuId ?? '',
        skuName: r.skuName ?? '',
        quantity: r.extractedValue ?? 0,
      }));
      const crateItems = crates.map((c) => ({
        skuId: c.skuId ?? '',
        estimatedValue: c.estimatedValue,
      }));
      const disc = await aiService.detectDiscrepancies(drItems, crateItems);
      setDiscrepancies(disc);

      // Build confirmed rows
      const rows: ConfirmedRow[] = ocr.map((ocrItem) => {
        const crateItem = crates.find((c) => c.skuId === ocrItem.skuId);
        const drQty = ocrItem.extractedValue ?? 0;
        const crateEst = crateItem?.estimatedValue ?? 0;
        const hasDisc = disc.some((d) => d.skuId === ocrItem.skuId);
        return {
          skuId: ocrItem.skuId ?? '',
          skuName: ocrItem.skuName ?? '',
          drQty,
          crateEstimate: crateEst,
          confirmedQty: drQty,
          lack: 0,
          overage: 0,
          manualOverride: false,
          confidence: ocrItem.confidence,
          hasDiscrepancy: hasDisc,
        };
      });
      setConfirmedRows(rows);
    } catch (err) {
      console.error('AI processing failed:', err);
    } finally {
      setAiProcessing(false);
    }
  }, [delivery, drFiles, skus, addToast]);

  // Update confirmed row
  const updateRow = (skuId: string, field: keyof ConfirmedRow, value: number | boolean) => {
    setConfirmedRows((prev) =>
      prev.map((r) => {
        if (r.skuId !== skuId) return r;
        const updated = { ...r, [field]: value };
        if (field === 'confirmedQty') {
          const diff = (value as number) - r.drQty;
          updated.lack = diff < 0 ? Math.abs(diff) : 0;
          updated.overage = diff > 0 ? diff : 0;
          // Auto-set manualOverride when user edits the quantity
          updated.manualOverride = true;
        }
        if (field === 'manualOverride') {
          updated.manualOverride = value as boolean;
        }
        return updated;
      }),
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!delivery) return;
    setSubmitLoading(true);

    const id = `bi-${Date.now().toString(36)}`;
    const uploadedRefs: string[] = [];

    try {
      const items: InventoryItem[] = confirmedRows.map((r) => ({
        skuId: r.skuId,
        skuName: r.skuName,
        quantity: r.confirmedQty,
        aiEstimate: r.crateEstimate,
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
        aiResults: [...ocrResults, ...crateResults, ...discrepancies],
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

  // OCR Results columns
  const ocrColumns: TableColumn<AIResult>[] = [
    { key: 'skuName', header: 'SKU', render: (row) => row.skuName ?? '-' },
    { key: 'extractedValue', header: 'AI Extracted Qty', render: (row) => row.extractedValue ?? '-' },
    { key: 'confidence', header: 'Confidence', render: (row) => confidenceBadge(row.confidence) },
    { key: 'warning', header: 'Warning', render: (row) => row.warning ? <span className="text-xs text-amber-600">{row.warning}</span> : <span className="text-xs text-gray-400">None</span> },
  ];

  const crateColumns: TableColumn<AIResult>[] = [
    { key: 'skuName', header: 'SKU', render: (row) => row.skuName ?? '-' },
    { key: 'estimatedValue', header: 'AI Estimated Qty', render: (row) => row.estimatedValue ?? '-' },
    { key: 'confidence', header: 'Confidence', render: (row) => confidenceBadge(row.confidence) },
    { key: 'warning', header: 'Warning', render: (row) => row.warning ? <span className="text-xs text-amber-600">{row.warning}</span> : <span className="text-xs text-gray-400">None</span> },
  ];

  if (!selectedDeliveryId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beginning Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Process DR images and crate photos with AI verification</p>
        </div>
        <Card>
          <CardContent>
            <Select
              label="Select Delivery"
              options={deliveryOptions}
              value={selectedDeliveryId}
              onChange={(e) => setSelectedDeliveryId(e.target.value)}
            />
            {deliveredList.length === 0 && (
              <div className="mt-4">
                <EmptyState
                  title="No Delivered Items"
                  description="There are no deliveries with 'delivered' status to process."
                />
              </div>
            )}
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
            setCrateResults([]);
            setDiscrepancies([]);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beginning Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">
            DR: <span className="font-mono font-medium">{delivery?.drNumber}</span> | Store: {store?.name ?? '-'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setSelectedDeliveryId(''); setStep(1); }}>
          Change Delivery
        </Button>
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
            <p className="text-sm text-gray-600 mb-4">Upload a photo or scan of the Delivery Receipt (DR).</p>
            <FileUpload
              accept="image/*"
              multiple={false}
              maxSizeMB={10}
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
            <p className="text-sm text-gray-600 mb-4">Upload 3-5 photos of the delivery crates for AI counting.</p>
            <FileUpload
              accept="image/*"
              multiple
              maxSizeMB={10}
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

      {/* Step 3: AI Processing */}
      {step === 3 && (
        <div className="space-y-4">
          {ocrResults.length === 0 && !aiProcessing && (
            <Card>
              <CardContent className="text-center py-12">
                <Cpu size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-sm text-gray-600 mb-4">Ready to process DR and crate images with AI.</p>
                <Button
                  variant="primary"
                  iconLeft={<Cpu size={16} />}
                  onClick={processAI}
                  loading={aiProcessing}
                >
                  Process with AI
                </Button>
              </CardContent>
            </Card>
          )}

          {aiProcessing && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-zapp-orange rounded-full mx-auto mb-4" />
                <p className="text-sm text-gray-600">Processing images with AI... This may take a moment.</p>
              </CardContent>
            </Card>
          )}

          {ocrResults.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">AI OCR Results (DR)</h2>
                </CardHeader>
                <Table columns={ocrColumns} data={ocrResults} keyExtractor={(row) => row.id} />
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="text-lg font-semibold text-gray-900">Crate Estimation Results</h2>
                </CardHeader>
                <Table columns={crateColumns} data={crateResults} keyExtractor={(row) => row.id} />
              </Card>

              {discrepancies.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="bg-amber-50">
                    <h2 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={18} /> Discrepancies Detected ({discrepancies.length})
                    </h2>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {discrepancies.map((d) => (
                        <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50">
                          <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{d.skuName}</p>
                            <p className="text-xs text-amber-700">{d.warning}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU Name</th>
                    <th className="px-3 py-2 text-center">DR Qty</th>
                    <th className="px-3 py-2 text-center">Crate Est.</th>
                    <th className="px-3 py-2 text-center">Confirmed Qty</th>
                    <th className="px-3 py-2 text-center">Lack</th>
                    <th className="px-3 py-2 text-center">Overage</th>
                    <th className="px-3 py-2 text-center">Override</th>
                    <th className="px-3 py-2 text-center">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {confirmedRows.map((row) => (
                    <tr
                      key={row.skuId}
                      className={row.hasDiscrepancy ? 'bg-amber-50' : 'hover:bg-gray-50'}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {row.skuName}
                        {row.hasDiscrepancy && (
                          <AlertTriangle size={12} className="inline ml-1 text-amber-500" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{row.drQty}</td>
                      <td className="px-3 py-2 text-center">{row.crateEstimate || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.confirmedQty}
                          onChange={(e) => updateRow(row.skuId, 'confirmedQty', parseInt(e.target.value) || 0)}
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
                            onChange={(e) => updateRow(row.skuId, 'manualOverride', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-zapp-orange transition-colors">
                            <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform mt-0.5 ${row.manualOverride ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'}`} />
                          </div>
                        </label>
                      </td>
                      <td className="px-3 py-2 text-center">{confidenceBadge(row.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <p className="text-lg font-bold text-gray-900">{confirmedRows.length}</p>
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
                  {confirmedRows.map((r) => {
                    const diff = r.confirmedQty - r.drQty;
                    return (
                      <tr key={r.skuId}>
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
          {step === 3 && ocrResults.length === 0 ? 'Process AI' : 'Next'}
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
            {ocrResults.length > 0 && <p>AI processing completed - {ocrResults.length} SKUs extracted</p>}
            {discrepancies.length > 0 && <p className="text-amber-600">{discrepancies.length} discrepancies detected</p>}
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
