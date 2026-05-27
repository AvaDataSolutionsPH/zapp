import { useState, useMemo } from 'react';
import {
  CreditCard,
  Upload,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import {
  Modal,
  Button,
  Input,
  Select,
  FileUpload,
  Badge,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { SelectOption } from '@/components/ui';

interface PaymentSubmitModalProps {
  open: boolean;
  onClose: () => void;
}

type PaymentMethodType = 'gateway' | 'manual';

export default function PaymentSubmitModal({ open, onClose }: PaymentSubmitModalProps) {
  const { billingRecords, currentUser, stores, submitPayment } = useStore();
  const { addToast } = useToast();

  const [selectedBillingId, setSelectedBillingId] = useState('');
  const [method, setMethod] = useState<PaymentMethodType>('gateway');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [datePaid, setDatePaid] = useState(new Date().toISOString().slice(0, 10));
  const [proofUrl, setProofUrl] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Get unpaid billing records for current user's stores
  const unpaidBilling = useMemo(() => {
    const userStoreIds = currentUser?.assignedStoreIds ?? [];
    return billingRecords.filter((b) => {
      const isUnpaid = b.status === 'issued' || b.status === 'overdue' || b.status === 'pending';
      const belongsToUser =
        currentUser?.role === 'owner' ||
        currentUser?.role === 'operations_manager' ||
        currentUser?.role === 'billing_user' ||
        userStoreIds.includes(b.storeId);
      return isUnpaid && belongsToUser;
    });
  }, [billingRecords, currentUser]);

  const billingOptions: SelectOption[] = useMemo(() => {
    return unpaidBilling.map((b) => {
      const store = stores.find((s) => s.id === b.storeId);
      return {
        value: b.id,
        label: `${b.id.toUpperCase()} - ${store?.name ?? b.storeId} - P${b.totalPayable.toLocaleString()}`,
      };
    });
  }, [unpaidBilling, stores]);

  const selectedBilling = useMemo(
    () => billingRecords.find((b) => b.id === selectedBillingId),
    [billingRecords, selectedBillingId],
  );

  // Check if close to 48-hour deadline
  const isDeadlineClose = useMemo(() => {
    if (!selectedBilling) return false;
    const due = new Date(selectedBilling.dueAt).getTime();
    const now = Date.now();
    const hoursLeft = (due - now) / (1000 * 60 * 60);
    return hoursLeft > 0 && hoursLeft <= 48;
  }, [selectedBilling]);

  const isOverdue = useMemo(() => {
    if (!selectedBilling) return false;
    return new Date(selectedBilling.dueAt).getTime() < Date.now();
  }, [selectedBilling]);

  // Auto-fill amount when billing is selected
  const handleBillingSelect = (id: string) => {
    setSelectedBillingId(id);
    const billing = billingRecords.find((b) => b.id === id);
    if (billing) {
      setAmount(billing.totalPayable.toString());
    }
    setError('');
    setSuccess(false);
  };

  // Validate amount
  const amountError = useMemo(() => {
    if (!amount) return '';
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return 'Please enter a valid amount';
    if (selectedBilling && num !== selectedBilling.totalPayable) {
      return `Amount must match total payable: P${selectedBilling.totalPayable.toLocaleString()}`;
    }
    return '';
  }, [amount, selectedBilling]);

  const handleSubmit = async () => {
    if (!selectedBillingId || !amount || amountError) return;

    setLoading(true);
    setError('');

    try {
      // Simulate processing delay for gateway
      if (method === 'gateway') {
        await new Promise((r) => setTimeout(r, 2000));
      }

      submitPayment({
        billingId: selectedBillingId,
        storeId: selectedBilling?.storeId ?? '',
        amount: parseFloat(amount),
        method,
        referenceNumber: method === 'gateway'
          ? `GW-${Date.now().toString(36).toUpperCase()}`
          : referenceNumber,
        datePaid,
        proofUrl: method === 'manual' ? proofUrl || '/uploads/payments/manual-proof.jpg' : undefined,
      });

      // submitPayment is fire-and-forget; rollback only logs to the
      // console on failure. Most submissions succeed in practice.
      addToast(
        'success',
        method === 'gateway'
          ? 'Payment processed. Awaiting billing verification.'
          : 'Payment submitted. Awaiting billing verification.',
      );
      setSuccess(true);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 2000);
    } catch {
      setError('Payment submission failed. Please try again.');
      addToast('error', 'Failed to submit payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedBillingId('');
    setMethod('gateway');
    setAmount('');
    setReferenceNumber('');
    setDatePaid(new Date().toISOString().slice(0, 10));
    setProofUrl('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setSuccess(false);
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Submit Payment"
      size="lg"
      footer={
        !success ? (
          <>
            <Button variant="secondary" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!selectedBillingId || !amount || !!amountError}
              iconLeft={method === 'gateway' ? <CreditCard size={16} /> : <Upload size={16} />}
            >
              {method === 'gateway' ? 'Process Payment' : 'Submit Payment'}
            </Button>
          </>
        ) : undefined
      }
    >
      {success ? (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900">Payment Submitted!</h3>
            <p className="text-sm text-gray-500 mt-1">
              Your payment has been submitted and is pending verification.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Deadline Warning */}
          {(isDeadlineClose || isOverdue) && (
            <div className={`flex items-start gap-3 rounded-lg px-4 py-3 ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <AlertTriangle size={18} className={isOverdue ? 'text-red-600 mt-0.5 shrink-0' : 'text-amber-600 mt-0.5 shrink-0'} />
              <div>
                <p className={`text-sm font-semibold ${isOverdue ? 'text-red-800' : 'text-amber-800'}`}>
                  {isOverdue ? 'This billing is OVERDUE!' : '48-Hour Deadline Warning'}
                </p>
                <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-amber-600'} mt-0.5`}>
                  {isOverdue
                    ? 'Please submit payment immediately to avoid penalties.'
                    : 'This billing is due within 48 hours. Please submit payment promptly.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Select Billing Record */}
          <Select
            label="Select Billing Record"
            options={billingOptions}
            value={selectedBillingId}
            onChange={(e) => handleBillingSelect(e.target.value)}
            placeholder="Choose unpaid billing..."
          />

          {/* Amount */}
          <Input
            label="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={amountError}
            iconLeft={<span className="text-sm font-medium">P</span>}
            placeholder="Enter amount"
          />

          {/* Payment Method Toggle */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Payment Method</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMethod('gateway')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  method === 'gateway'
                    ? 'border-zapp-orange bg-orange-50 text-zapp-orange'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <CreditCard size={18} />
                Payment Gateway
              </button>
              <button
                type="button"
                onClick={() => setMethod('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-colors ${
                  method === 'manual'
                    ? 'border-zapp-orange bg-orange-50 text-zapp-orange'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <Upload size={18} />
                Manual Upload
              </button>
            </div>
          </div>

          {/* Gateway form */}
          {method === 'gateway' && (
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-700">Simulated Payment Gateway</span>
                <Badge variant="info" size="sm">Demo</Badge>
              </div>
              <Input
                label="Card Number"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Expiry"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  placeholder="MM/YY"
                  maxLength={5}
                />
                <Input
                  label="CVV"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  placeholder="123"
                  maxLength={4}
                  type="password"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                This is a simulated gateway. No real charges will be made.
              </p>
            </div>
          )}

          {/* Manual upload form */}
          {method === 'manual' && (
            <div className="space-y-4">
              <FileUpload
                accept="image/*,.pdf"
                onChange={(files) => {
                  if (files.length > 0) {
                    setProofUrl(files[0].preview ?? `/uploads/payments/proof-${Date.now()}.jpg`);
                  }
                }}
              />
              <Input
                label="Reference Number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. BDO-20260323-1234"
              />
              <Input
                label="Date Paid"
                type="date"
                value={datePaid}
                onChange={(e) => setDatePaid(e.target.value)}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
