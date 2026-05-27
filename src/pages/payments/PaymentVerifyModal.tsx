import { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  X,
  DollarSign,
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
import type { Payment } from '@/types';

// ── Image Viewer ────────────────────────────────────────────────────────

function ProofViewer({ url, onExpand }: { url: string; onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      className="w-full rounded-lg border border-gray-200 bg-gray-50 h-48 flex flex-col items-center justify-center gap-2 hover:bg-gray-100 transition-colors cursor-pointer"
    >
      <ImageIcon size={36} className="text-gray-400" />
      <span className="text-sm text-gray-500">Click to view proof image</span>
      <span className="text-xs text-gray-400 truncate max-w-[200px]">{url}</span>
    </button>
  );
}

function ExpandedImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-3 -right-3 p-2 rounded-full bg-white shadow-lg text-gray-600 hover:text-gray-900 z-10">
          <X size={18} />
        </button>
        <div className="bg-white rounded-xl p-2 shadow-2xl">
          <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <ImageIcon size={48} className="mx-auto mb-2" />
              <p className="text-sm">{url}</p>
              <p className="text-xs mt-1">Payment proof image placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface PaymentVerifyModalProps {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
}

export default function PaymentVerifyModal({ open, onClose, payment }: PaymentVerifyModalProps) {
  const { verifyPayment, currentUser, billingRecords, stores } = useStore();
  const { addToast } = useToast();

  const [action, setAction] = useState<'verified' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [success, setSuccess] = useState(false);

  const billing = useMemo(
    () => (payment ? billingRecords.find((b) => b.id === payment.billingId) : null),
    [payment, billingRecords],
  );

  const store = useMemo(
    () => (payment ? stores.find((s) => s.id === payment.storeId) : null),
    [payment, stores],
  );

  // Amount match check
  const amountMatches = useMemo(() => {
    if (!payment || !billing) return false;
    return payment.amount === billing.totalPayable;
  }, [payment, billing]);

  const handleVerify = async () => {
    if (!payment || !currentUser) return;
    setLoading(true);
    try {
      await verifyPayment(payment.id, 'verified', currentUser.id);
      addToast(
        'success',
        `Payment from ${store?.name ?? 'store'} verified. Billing marked paid.`,
      );
      setSuccess(true);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch {
      addToast('error', 'Failed to verify payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!payment || !currentUser || !rejectReason.trim()) return;
    setLoading(true);
    try {
      await verifyPayment(payment.id, 'rejected', currentUser.id, rejectReason);
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
        title="Verify Payment"
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
                    onClick={handleVerify}
                    loading={loading}
                    iconLeft={<CheckCircle size={16} />}
                  >
                    Verify Payment
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
                Payment {action === 'rejected' ? 'Rejected' : 'Verified'}!
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {action === 'rejected'
                  ? 'The payment has been rejected and the store will be notified.'
                  : 'The payment has been verified and the billing record updated.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
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
                <ProofViewer url={payment.proofUrl} onExpand={() => setShowProof(true)} />
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
        <ExpandedImageModal url={payment.proofUrl} onClose={() => setShowProof(false)} />
      )}
    </>
  );
}
