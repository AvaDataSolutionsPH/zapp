// ============================================================
// ZAPP Donuts ERP - Public Franchise Application Page
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Hash,
  User,
  Store as StoreIcon,
  Upload,
  FileSearch,
  AlertCircle,
  Phone,
  Mail,
  Handshake,
  Zap,
  ShieldCheck,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Input,
  Select,
  Modal,
  Badge,
  FileUpload,
} from '@/components/ui';
import type { SelectOption, UploadedFile } from '@/components/ui';
import { useStore } from '@/store/useStore';
import StorePinPicker from './StorePinPicker';
import { referralService } from '@/services/api';
import { uploadFile, buildObjectPath, deleteFile, parseStorageRef } from '@/services/storage';
import type { ReferralCode, Distributor, AreaSupervisor, Plant } from '@/types';

// ── Philippine provinces & cities for selects ─────────────────

const PROVINCES: SelectOption[] = [
  { value: '', label: 'Select Province' },
  { value: 'Albay', label: 'Albay' },
  { value: 'Camarines Sur', label: 'Camarines Sur' },
  { value: 'Sorsogon', label: 'Sorsogon' },
  { value: 'Catanduanes', label: 'Catanduanes' },
  { value: 'Masbate', label: 'Masbate' },
  { value: 'Metro Manila', label: 'Metro Manila' },
  { value: 'Cavite', label: 'Cavite' },
  { value: 'Laguna', label: 'Laguna' },
  { value: 'Bulacan', label: 'Bulacan' },
  { value: 'Rizal', label: 'Rizal' },
  { value: 'Batangas', label: 'Batangas' },
  { value: 'Pampanga', label: 'Pampanga' },
  { value: 'Cebu', label: 'Cebu' },
  { value: 'Bohol', label: 'Bohol' },
  { value: 'Leyte', label: 'Leyte' },
  { value: 'Iloilo', label: 'Iloilo' },
  { value: 'Negros Occidental', label: 'Negros Occidental' },
  { value: 'Davao del Sur', label: 'Davao del Sur' },
  { value: 'Zamboanga del Sur', label: 'Zamboanga del Sur' },
];

const CITY_MAP: Record<string, SelectOption[]> = {
  Albay: [
    { value: '', label: 'Select City/Area' },
    { value: 'Legazpi City', label: 'Legazpi City' },
    { value: 'Daraga', label: 'Daraga' },
    { value: 'Tabaco', label: 'Tabaco' },
    { value: 'Ligao', label: 'Ligao' },
    { value: 'Malilipot', label: 'Malilipot' },
  ],
  'Camarines Sur': [
    { value: '', label: 'Select City/Area' },
    { value: 'Naga City', label: 'Naga City' },
    { value: 'Pili', label: 'Pili' },
    { value: 'Iriga City', label: 'Iriga City' },
  ],
  Sorsogon: [
    { value: '', label: 'Select City/Area' },
    { value: 'Sorsogon City', label: 'Sorsogon City' },
    { value: 'Bulan', label: 'Bulan' },
  ],
  'Metro Manila': [
    { value: '', label: 'Select City/Area' },
    { value: 'Manila', label: 'Manila' },
    { value: 'Makati', label: 'Makati' },
    { value: 'Quezon City', label: 'Quezon City' },
    { value: 'Pasig', label: 'Pasig' },
    { value: 'Taguig', label: 'Taguig' },
    { value: 'Mandaluyong', label: 'Mandaluyong' },
    { value: 'San Juan', label: 'San Juan' },
    { value: 'Parañaque', label: 'Parañaque' },
    { value: 'Caloocan', label: 'Caloocan' },
  ],
  Cebu: [
    { value: '', label: 'Select City/Area' },
    { value: 'Cebu City', label: 'Cebu City' },
    { value: 'Mandaue', label: 'Mandaue' },
    { value: 'Lapu-Lapu', label: 'Lapu-Lapu' },
    { value: 'Talisay', label: 'Talisay' },
  ],
};

const DEFAULT_CITIES: SelectOption[] = [{ value: '', label: 'Select province first' }];

// ── Step definitions ──────────────────────────────────────────

const STEPS = [
  { label: 'Referral Code', icon: Hash },
  { label: 'Personal Info', icon: User },
  { label: 'Store Info', icon: StoreIcon },
  { label: 'Documents', icon: Upload },
  { label: 'Review & Submit', icon: FileSearch },
];

// ── Types ─────────────────────────────────────────────────────

interface ReferralInfo {
  referral: ReferralCode;
  distributor?: Distributor;
  areaSupervisor?: AreaSupervisor;
  plant?: Plant;
}

interface FormData {
  // Step 1
  referralCode: string;
  // Step 2
  fullName: string;
  mobile: string;
  email: string;
  // Step 3
  storeName: string;
  address: string;
  province: string;
  city: string;
  lat: string;
  lng: string;
  // Step 4
  storePhoto: UploadedFile[];
  govId: UploadedFile[];
  proofOfBilling: UploadedFile[];
}

// ── Application Page ──────────────────────────────────────────

export default function ApplicationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { submitApplication } = useStore();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    referralCode: '',
    fullName: '',
    mobile: '',
    email: '',
    storeName: '',
    address: '',
    province: '',
    city: '',
    lat: '',
    lng: '',
    storePhoto: [],
    govId: [],
    proofOfBilling: [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'consent', string>>>({});
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralError, setReferralError] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-fill referral code from URL
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setForm((prev) => ({ ...prev, referralCode: refCode }));
      // Auto-validate after a short delay
      const timer = setTimeout(() => {
        handleValidateReferral(refCode);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // City options based on province
  const cityOptions = useMemo(
    () => CITY_MAP[form.province] ?? DEFAULT_CITIES,
    [form.province],
  );

  // ── Form helpers ────────────────────────────────────────────

  const updateForm = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Referral validation ────────────────────────────────────

  const handleValidateReferral = async (codeOverride?: string) => {
    const code = codeOverride ?? form.referralCode.trim();
    if (!code) {
      setReferralError('Please enter a referral code.');
      return;
    }

    setReferralLoading(true);
    setReferralError('');
    setReferralInfo(null);

    try {
      const result = await referralService.validate(code);
      if (result.valid && result.referral) {
        setReferralInfo({
          referral: result.referral,
          distributor: result.distributor,
          areaSupervisor: result.areaSupervisor,
          plant: result.plant,
        });
        setReferralError('');
      } else {
        setReferralError(
          'Invalid or inactive referral code. Please check and try again, or contact a ZAPP representative.',
        );
      }
    } catch {
      setReferralError('Failed to validate referral code. Please try again.');
    } finally {
      setReferralLoading(false);
    }
  };

  // ── Validation per step ────────────────────────────────────

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<Record<keyof FormData | 'consent', string>> = {};

    switch (currentStep) {
      case 0:
        if (!form.referralCode.trim()) {
          newErrors.referralCode = 'Valid referral code is required.';
        } else if (!referralInfo) {
          newErrors.referralCode = 'Valid referral code is required. Please validate your code before proceeding.';
        }
        break;

      case 1:
        if (!form.fullName.trim()) newErrors.fullName = 'Full name is required.';
        if (!form.mobile.trim()) {
          newErrors.mobile = 'Mobile number is required.';
        } else if (!/^(\+63|0)(9\d{9})$/.test(form.mobile.replace(/[\s-]/g, ''))) {
          newErrors.mobile = 'Enter a valid PH mobile number (e.g. 09171234567 or +639171234567).';
        }
        if (!form.email.trim()) {
          newErrors.email = 'Email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
          newErrors.email = 'Enter a valid email address.';
        }
        break;

      case 2:
        if (!form.storeName.trim()) newErrors.storeName = 'Store name is required.';
        if (!form.address.trim()) newErrors.address = 'Complete address is required.';
        if (!form.province) newErrors.province = 'Province is required.';
        if (!form.city) newErrors.city = 'City/Area is required.';
        if (!form.lat || !form.lng) {
          newErrors.lat = 'I-pin ang eksaktong lokasyon ng tindahan sa mapa.';
        }
        break;

      case 3:
        if (form.storePhoto.length === 0) newErrors.storePhoto = 'Store photo is required.';
        if (form.govId.length === 0) newErrors.govId = 'Government ID is required.';
        if (form.proofOfBilling.length === 0) newErrors.proofOfBilling = 'Proof of billing is required.';
        break;

      case 4:
        if (!consent) newErrors.consent = 'You must agree to the data privacy consent.';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Navigation ─────────────────────────────────────────────

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Submit ─────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validateStep(4)) return;
    if (!referralInfo) return;

    setSubmitting(true);

    // Scope ID used as a path prefix in Storage. The store action
    // generates the actual application ID, so we mint a temporary
    // one here just for path grouping. If the submit fails after
    // uploads we clean the orphaned objects up below.
    const scopeId = `pending-${Date.now().toString(36)}`;
    const uploadedRefs: string[] = [];

    try {
      // Store photo → public bucket (low-sensitivity, embedded
      // directly in <img src>). Gov ID + Proof of billing → private
      // bucket; renderers fetch a fresh signed URL via useStorageUrl.
      const storePhotoFile = form.storePhoto[0]?.file;
      const govIdFile = form.govId[0]?.file;
      const proofFile = form.proofOfBilling[0]?.file;
      if (!storePhotoFile || !govIdFile || !proofFile) {
        throw new Error('Missing required upload');
      }

      const storePhotoUpload = await uploadFile(
        'zapp-public',
        buildObjectPath('store-photo', scopeId, storePhotoFile),
        storePhotoFile,
      );
      uploadedRefs.push(storePhotoUpload.storageRef);

      const govIdUpload = await uploadFile(
        'zapp-private',
        buildObjectPath('gov-id', scopeId, govIdFile),
        govIdFile,
      );
      uploadedRefs.push(govIdUpload.storageRef);

      const proofUpload = await uploadFile(
        'zapp-private',
        buildObjectPath('proof-of-billing', scopeId, proofFile),
        proofFile,
      );
      uploadedRefs.push(proofUpload.storageRef);

      await submitApplication({
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email,
        storeName: form.storeName,
        address: `${form.address}, ${form.city}, ${form.province}`,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        storePhotoUrl: storePhotoUpload.storageRef,
        govIdUrl: govIdUpload.storageRef,
        proofOfBillingUrl: proofUpload.storageRef,
        referralCode: form.referralCode,
        referralType: referralInfo.referral.type,
        assignedDistributorId: referralInfo.distributor?.id,
        assignedAreaSupervisorId: referralInfo.areaSupervisor?.id,
        assignedPlantId: referralInfo.referral.plantId,
      });
      setShowSuccess(true);
    } catch (err) {
      // Best-effort cleanup of any files we managed to upload before
      // failing — keeps the Storage buckets tidy.
      for (const ref of uploadedRefs) {
        const parsed = parseStorageRef(ref);
        if (parsed) {
          deleteFile(parsed.bucket, parsed.path).catch(() => undefined);
        }
      }
      console.error('[ApplicationPage] submission failed:', err);
      setErrors({ consent: 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stepper Component ──────────────────────────────────────

  const Stepper = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isCompleted = i < step;
          const isCurrent = i === step;

          return (
            <div key={s.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-green-500 bg-green-500 text-white'
                      : isCurrent
                        ? 'border-zapp-orange bg-zapp-orange text-white'
                        : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    isCurrent ? 'text-zapp-orange' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded transition-colors ${
                    i < step ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Step Content ───────────────────────────────────────────

  const renderStep = () => {
    switch (step) {
      /* ── Step 1: Referral Code ─────────────────────────── */
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Enter Your Referral Code</h2>
              <p className="mt-1 text-sm text-gray-500">
                A valid referral code is required to submit your application. Obtain one from a ZAPP distributor or internal representative.
              </p>
            </div>

            <div className="flex gap-3">
              <Input
                label="Referral Code *"
                placeholder="e.g. BICOL-MARCO or ZAPP-INT-001"
                required
                value={form.referralCode}
                onChange={(e) => {
                  updateForm('referralCode', e.target.value);
                  setReferralError('');
                  setReferralInfo(null);
                }}
                error={errors.referralCode}
                className="flex-1"
                iconLeft={<Hash size={16} />}
              />
              <div className="flex items-end">
                <Button
                  variant="primary"
                  onClick={() => handleValidateReferral()}
                  loading={referralLoading}
                  disabled={!form.referralCode.trim()}
                >
                  Validate
                </Button>
              </div>
            </div>

            {referralError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{referralError}</p>
              </div>
            )}

            {referralInfo && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 size={20} />
                  <span className="font-bold">Referral Code Validated!</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                      Code
                    </span>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">
                      {referralInfo.referral.code}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                      Franchise Type
                    </span>
                    <p className="mt-0.5">
                      <Badge variant={referralInfo.referral.type === 'distributor' ? 'orange' : 'info'}>
                        {referralInfo.referral.type === 'distributor'
                          ? 'Distributor-Linked'
                          : 'Direct to ZAPP'}
                      </Badge>
                    </p>
                  </div>
                  {referralInfo.distributor && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                        Distributor
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">
                        {referralInfo.distributor.name}
                      </p>
                    </div>
                  )}
                  {referralInfo.areaSupervisor && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                        Area Supervisor
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">
                        {referralInfo.areaSupervisor.name}
                      </p>
                    </div>
                  )}
                  {referralInfo.plant && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-green-600">
                        Assigned Plant
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-gray-900">
                        {referralInfo.plant.name} ({referralInfo.plant.region})
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      /* ── Step 2: Personal Info ─────────────────────────── */
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
              <p className="mt-1 text-sm text-gray-500">
                Provide your details as the franchise applicant.
              </p>
            </div>

            <Input
              label="Full Name"
              placeholder="Juan Dela Cruz"
              value={form.fullName}
              onChange={(e) => updateForm('fullName', e.target.value)}
              error={errors.fullName}
              iconLeft={<User size={16} />}
            />

            <Input
              label="Mobile Number"
              placeholder="09171234567"
              value={form.mobile}
              onChange={(e) => updateForm('mobile', e.target.value)}
              error={errors.mobile}
              helperText="Philippine format: 09XX or +639XX"
              iconLeft={<Phone size={16} />}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="juan@example.com"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              error={errors.email}
              iconLeft={<Mail size={16} />}
            />
          </div>
        );

      /* ── Step 3: Store Info ────────────────────────────── */
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Store Information</h2>
              <p className="mt-1 text-sm text-gray-500">
                Tell us about your planned store location.
              </p>
            </div>

            <Input
              label="Store Name"
              placeholder="ZAPP Donuts - Legazpi Centro"
              value={form.storeName}
              onChange={(e) => updateForm('storeName', e.target.value)}
              error={errors.storeName}
              iconLeft={<StoreIcon size={16} />}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Complete Address</label>
              <textarea
                value={form.address}
                onChange={(e) => updateForm('address', e.target.value)}
                placeholder="Street, Building, Barangay..."
                rows={3}
                className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.address
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
                    : 'border-gray-300 focus:border-zapp-orange focus:ring-zapp-orange/30'
                }`}
              />
              {errors.address && (
                <p className="mt-1.5 text-xs text-red-600">{errors.address}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Province"
                options={PROVINCES}
                value={form.province}
                onChange={(e) => {
                  updateForm('province', e.target.value);
                  updateForm('city', '');
                }}
                error={errors.province}
              />
              <Select
                label="City / Area"
                options={cityOptions}
                value={form.city}
                onChange={(e) => updateForm('city', e.target.value)}
                error={errors.city}
                disabled={!form.province}
              />
            </div>

            {/* Map pin — exact store location (required) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Store Location on Map <span className="text-red-500">*</span>
              </label>
              <StorePinPicker
                lat={form.lat}
                lng={form.lng}
                province={form.province}
                onChange={(lat, lng) => {
                  updateForm('lat', lat);
                  updateForm('lng', lng);
                }}
                error={errors.lat}
              />
            </div>
          </div>
        );

      /* ── Step 4: Document Upload ───────────────────────── */
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Document Upload</h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload the required documents for verification.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <ImageIcon size={16} className="text-gray-400" />
                  Store Photo (Front View) <span className="text-red-500">*</span>
                </label>
                <FileUpload
                  accept="image/*"
                  onChange={(files) =>
                    setForm((prev) => ({ ...prev, storePhoto: files }))
                  }
                />
                {errors.storePhoto && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.storePhoto}</p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <ShieldCheck size={16} className="text-gray-400" />
                  Valid Government ID <span className="text-red-500">*</span>
                </label>
                <FileUpload
                  accept="image/*,.pdf"
                  onChange={(files) =>
                    setForm((prev) => ({ ...prev, govId: files }))
                  }
                />
                {errors.govId && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.govId}</p>
                )}
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <FileText size={16} className="text-gray-400" />
                  Proof of Billing <span className="text-red-500">*</span>
                </label>
                <FileUpload
                  accept="image/*,.pdf"
                  onChange={(files) =>
                    setForm((prev) => ({ ...prev, proofOfBilling: files }))
                  }
                />
                {errors.proofOfBilling && (
                  <p className="mt-1.5 text-xs text-red-600">{errors.proofOfBilling}</p>
                )}
              </div>
            </div>
          </div>
        );

      /* ── Step 5: Review & Submit ───────────────────────── */
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Review & Submit</h2>
              <p className="mt-1 text-sm text-gray-500">
                Please review your application details before submitting.
              </p>
            </div>

            {/* Referral summary */}
            {referralInfo && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  {referralInfo.referral.type === 'distributor' ? (
                    <Handshake size={16} className="text-zapp-orange" />
                  ) : (
                    <Zap size={16} className="text-blue-500" />
                  )}
                  Referral Information
                </h3>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-gray-500">Code:</span>{' '}
                    <span className="font-medium">{referralInfo.referral.code}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>{' '}
                    <Badge variant={referralInfo.referral.type === 'distributor' ? 'orange' : 'info'} size="sm">
                      {referralInfo.referral.type === 'distributor' ? 'Distributor' : 'Direct'}
                    </Badge>
                  </div>
                  {referralInfo.distributor && (
                    <div>
                      <span className="text-gray-500">Distributor:</span>{' '}
                      <span className="font-medium">{referralInfo.distributor.name}</span>
                    </div>
                  )}
                  {referralInfo.plant && (
                    <div>
                      <span className="text-gray-500">Plant:</span>{' '}
                      <span className="font-medium">{referralInfo.plant.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Personal info summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <User size={16} className="text-gray-400" />
                Personal Information
              </h3>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-gray-500">Full Name:</span>{' '}
                  <span className="font-medium">{form.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Mobile:</span>{' '}
                  <span className="font-medium">{form.mobile}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Email:</span>{' '}
                  <span className="font-medium">{form.email}</span>
                </div>
              </div>
            </div>

            {/* Store info summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <StoreIcon size={16} className="text-gray-400" />
                Store Information
              </h3>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-gray-500">Store Name:</span>{' '}
                  <span className="font-medium">{form.storeName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Province:</span>{' '}
                  <span className="font-medium">{form.province}</span>
                </div>
                <div>
                  <span className="text-gray-500">City/Area:</span>{' '}
                  <span className="font-medium">{form.city}</span>
                </div>
                <div>
                  <span className="text-gray-500">Coordinates:</span>{' '}
                  <span className="font-medium">
                    {form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'Not provided'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Address:</span>{' '}
                  <span className="font-medium">{form.address}</span>
                </div>
              </div>
            </div>

            {/* Documents summary */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Upload size={16} className="text-gray-400" />
                Uploaded Documents
              </h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {form.storePhoto.length > 0 ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-red-500" />
                  )}
                  <span className="text-gray-600">
                    Store Photo:{' '}
                    {form.storePhoto.length > 0
                      ? form.storePhoto[0].file.name
                      : 'Not uploaded'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {form.govId.length > 0 ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-red-500" />
                  )}
                  <span className="text-gray-600">
                    Government ID:{' '}
                    {form.govId.length > 0 ? form.govId[0].file.name : 'Not uploaded'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {form.proofOfBilling.length > 0 ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <AlertCircle size={16} className="text-red-500" />
                  )}
                  <span className="text-gray-600">
                    Proof of Billing:{' '}
                    {form.proofOfBilling.length > 0
                      ? form.proofOfBilling[0].file.name
                      : 'Not uploaded'}
                  </span>
                </div>
              </div>
            </div>

            {/* File previews */}
            {(form.storePhoto.length > 0 || form.govId.length > 0 || form.proofOfBilling.length > 0) && (
              <div className="flex flex-wrap gap-3">
                {[...form.storePhoto, ...form.govId, ...form.proofOfBilling].map(
                  (f) =>
                    f.preview && (
                      <img
                        key={f.id}
                        src={f.preview}
                        alt={f.file.name}
                        className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
                      />
                    ),
                )}
              </div>
            )}

            {/* Data Privacy Consent */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Data Privacy Consent</h3>
              <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600 leading-relaxed">
                <p className="mb-2">
                  By submitting this application, I acknowledge and consent to the collection, storage,
                  processing, and use of my personal information by ZAPP Donuts Corp., its affiliates,
                  partners, and authorized distributors for the following purposes:
                </p>
                <ul className="mb-2 list-disc pl-5 space-y-1">
                  <li>
                    Processing and evaluation of my franchise application, including verification of
                    submitted documents and information.
                  </li>
                  <li>
                    Communication regarding application status, franchise operations, promotions, and
                    updates.
                  </li>
                  <li>
                    Compliance with applicable laws and regulations, including the Data Privacy Act of
                    2012 (Republic Act No. 10173) of the Philippines.
                  </li>
                  <li>
                    Integration with the ZAPP Donuts ERP system for ongoing operational management,
                    billing, inventory tracking, and analytics.
                  </li>
                </ul>
                <p>
                  I understand that I may withdraw my consent at any time by contacting ZAPP Donuts at
                  privacy@zappdonuts.ph. I also understand that withdrawal of consent may affect the
                  processing of my application or ongoing franchise operations.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (e.target.checked) setErrors((prev) => ({ ...prev, consent: undefined }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-zapp-orange focus:ring-zapp-orange"
                />
                <span className="text-sm text-gray-700">
                  I have read and agree to the Data Privacy Consent and authorize ZAPP Donuts to process my
                  personal information as described above.
                </span>
              </label>
              {errors.consent && (
                <p className="mt-2 text-xs text-red-600">{errors.consent}</p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-zapp-orange transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
          </div>
          <div className="flex items-center gap-3">
            <img src="/Logo.jpg" alt="ZAPP Donuts" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Franchise Application</h1>
              <p className="text-sm text-gray-500">Apply to become a ZAPP Donuts franchise owner.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Form ────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <Stepper />
          </CardHeader>

          <CardContent>{renderStep()}</CardContent>

          <CardFooter className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={step === 0}
              iconLeft={<ArrowLeft size={16} />}
            >
              Previous
            </Button>

            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={handleNext} iconRight={<ArrowRight size={16} />}>
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                iconRight={!submitting ? <Check size={16} /> : undefined}
              >
                Submit Application
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* ─── Success Modal ───────────────────────────────── */}
      <Modal
        open={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          navigate('/');
        }}
        size="sm"
      >
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Application Submitted!</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Your franchise application is now under review. Our team will evaluate your information and
            documents, and you will be notified of the result via email at{' '}
            <strong>{form.email}</strong>.
          </p>
          <p className="mt-3 text-xs text-gray-400">
            Reference Code: {form.referralCode}
          </p>
          <div className="mt-6 flex gap-3">
            <Button
              variant="primary"
              onClick={() => {
                setShowSuccess(false);
                navigate('/');
              }}
            >
              Back to Home
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccess(false);
                navigate('/stores');
              }}
            >
              View Stores
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
