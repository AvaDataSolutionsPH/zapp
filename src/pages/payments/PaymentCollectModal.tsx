import { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  X,
  DollarSign,
  HandCoins,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Modal,
  Button,
  Badge,
  Card,
  CardContent,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStorageUrl } from '@/lib/useStorageUrl';
import type { Payment } from '@/types';

// ── Image Viewer (mirrors PaymentVerifyModal) ────────────────────────────

function ProofViewer({
  resolvedUrl,
  rawRef,
  onExpand,
}: {
  resolvedUrl: string | undefined;
  rawRef: string;
  onExpand: () => void;
}) {
  return (
    <button
      onClick={onExpand}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 h-48 overflow-hidden flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors cursor-pointer"
    >
      {resolvedUrl ? (
        <img
          src={resolvedUrl}
          alt="Payment proof"
          className="h-full w-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <>
          <ImageIcon size={36} className="text-gray-400" />
          <span className="text-sm text-gray-500">Click to view proof image</span>
          <span className="text-xs text-gray-400 truncate max-w-[200px]">{rawRef}</span>
        </>
      )}
    </button>
  );
}

function ExpandedImageModal({
  resolvedUrl,
  rawRef,
  onClose,
}: {
  resolvedUrl: string | undefined;
  rawRef: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 p-2 rounded-full bg-white shadow-lg text-gray-600 hover:text-gray-900 z-10">
          <X size={18} />
        </button>
        <div className="bg-white rounded-xl p-2 shadow-2xl">
          <div className="bg-gray-100 rounded-lg h-96 overflow-hidden flex items-center justify-center">
            {resolvedUrl ? (
              <img
                src={resolvedUrl}
                alt="Payment proof"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon size={48} className="mx-auto mb-2" />
                <p className="text-sm">{rawRef}</p>
                <p className="text-xs mt-1">Loading proof image…</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface PaymentCollectModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}

/**
 * PD / SPD collection step. The partner distributor confirms it has collected
 * the store's remittance (status → 'collected') and forwards it to billing for
 * verification, or rejects it back to the store. Collection does NOT mark the
 * billing paid — only billing verification does.
 */
export default function PaymentCollectModal({ open, onClose, payment }: PaymentCollectModalProps) {
  const { collectPayment, currentUser, billingRecords, stores } = useStore();
  const { addToast } = useToast();

  const [action, setAction] = useState<'collected' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [success, setSuccess] = useState(false);

  const billing = useMemo(
    () => (payment ? billingRecords.find((b) => b.id === payment.billingId) : null),
    [payment, billingRecords],
  );

  const resolvedProofUrl = useStorageUrl(payment?.proofUrl);

  const store = useMemo(
    () => (payment ? stores.find((s) => s.id === payment.storeId) : null),
    [payment, stores],
  );

  const amountMatches = useMemo(() => {
    if (!payment || !billing) return false;
    return payment.amount === billing.totalPayable;
  }, [payment, billing]);

  const handleCollect = async () => {
    if (!payment || !currentUser) return;
    setLoading(true);
    try {
      await collectPayment(payment.id, 'collected', currentUser.id);
      addToast(
        'success',
        `Payment from ${store?.name ?? 'store'} collected. Forwarded to billing.`,
      );
      setSuccess(true);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch {
      addToast('error', 'Failed to collect payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!payment || !currentUser || !rejectReason.trim()) return;
    setLoading(true);
    try {
      await collectPayment(payment.id, 'rejected', currentUser.id, rejectReason);
      addToast('info', `Payment from ${store?.name ?? 'store'} rejected.`);
      setSuccess(true);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch {
      addToast('error', 'Failed to reject payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAction(null);
    setRejectReason('');
    setSuccess(false);
    setShowProof(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!payment) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Collect Payment"
        size="lg"
        footer={
          !success ? (
            <>
              <Button variant="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              {action === 'rejected' ? (
                <Button
                  variant="danger"
                  onClick={handleReject}
                  loading={loading}
                  disabled={!rejectReason.trim()}
                  iconLeft={<XCircle size={16} />}
                >
                  Confirm Rejection
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    onClick={() => setAction('rejected')}
                    disabled={loading}
                    iconLeft={<XCircle size={16} />}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCollect}
                    loading={loading}
                    iconLeft={<HandCoins size={16} />}
                  >
                    Mark Collected
                  </Button>
                </div>
              )}
            </>
          ) : undefined
        }
      >
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${action === 'rejected' ? 'bg-red-100' : 'bg-green-100'}`}>
              {action === 'rejected' ? (
                <XCircle size={32} className="text-red-600" />
              ) : (
                <CheckCircle size={32} className="text-green-600" />
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Payment {action === 'rejected' ? 'Rejected' : 'Collected'}!
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {action === 'rejected'
                  ? 'The payment has been rejected and the store will be notified.'
                  : 'The payment has been collected and forwarded to billing for verification.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Collection context */}
            <div className="flex items-start gap-3 rounded-lg px-4 py-3 bg-blue-50 border border-blue-200">
              <HandCoins size={18} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">You are collecting this remittance</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Confirm you received this payment from the store. It will be forwarded to
                  billing for final verification — billing marks the record paid.
                </p>
              </div>
            </div>

            {/* Payment Details */}
            <Card>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Reference Number</p>
                    <p className="font-mono font-medium text-gray-900">{payment.referenceNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Store</p>
                    <p className="font-medium text-gray-900">{store?.name ?? payment.storeId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Billing ID</p>
                    <p className="font-mono font-medium text-gray-900">{payment.billingId.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Method</p>
                    <Badge variant={payment.method === 'gateway' ? 'info' : 'neutral'} size="sm">
                      {payment.method === 'gateway' ? 'Gateway' : 'Manual'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date Paid</p>
                    <p className="font-medium text-gray-900">{new Date(payment.datePaid).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Submitted At</p>
                    <p className="font-medium text-gray-900">{new Date(payment.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amount Match Check */}
            <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${amountMatches ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center gap-3">
                <DollarSign size={18} className={amountMatches ? 'text-green-600' : 'text-amber-600'} />
                <div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Payment: <span className="font-bold text-gray-900">P{payment.amount.toLocaleString()}</span></span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">Billing: <span className="font-bold text-gray-900">P{billing?.totalPayable.toLocaleString() ?? 'N/A'}</span></span>
                  </div>
                </div>
              </div>
              <Badge variant={amountMatches ? 'success' : 'warning'} size="sm" dot>
                {amountMatches ? 'Matches' : 'Mismatch'}
              </Badge>
            </div>

            {/* Proof Image */}
            {payment.proofUrl ? (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Payment Proof</label>
                <ProofViewer
                  resolvedUrl={resolvedProofUrl}
                  rawRef={payment.proofUrl}
                  onExpand={() => setShowProof(true)}
                />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-center text-sm text-gray-400">
                No proof image uploaded (gateway payment)
              </div>
            )}

            {/* Reject Reason */}
            {action === 'rejected' && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejecting this payment..."
                  rows={3}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
                />
                {!rejectReason.trim() && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Reason is required for rejection
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Expanded proof image modal */}
      {showProof && payment.proofUrl && (
        <ExpandedImageModal
          resolvedUrl={resolvedProofUrl}
          rawRef={payment.proofUrl}
          onClose={() => setShowProof(false)}
        />
      )}
    </>
  );
}
