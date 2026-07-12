// ============================================================
// ZAPP Donuts ERP — Internal "New Franchisee" Onboarding Form
// ============================================================
//
// A login-gated onboarding application (NOT the public /apply). Used by a PD /
// owner / ops to encode a new franchisee. Unlike the public flow it captures the
// full onboarding packet boss asked for: channel/referral code (→ PD / SPD /
// direct), basic details, shop code (from the PD), delivery schedule (odd/even),
// opening date, valid ID + proof of billing, and Terms & Conditions.
//
// The channel/referral code is resolved against the LIVE store slices
// (referralCodes / distributors / subPartnerDistributors / plants) — which are
// hydrated from Supabase — so it works with REAL data after the data reset, not
// the mock referralService the public /apply uses.
//
// On submit it creates an Application (status 'pending') that flows through the
// existing review → approve pipeline; approval copies shopCode / deliverySchedule
// / openingDate / subPartnerDistributorId onto the new Store.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Users,
  Calendar,
  Truck,
  Image as ImageIcon,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Input,
  Modal,
  FileUpload,
} from '@/components/ui';
import type { UploadedFile } from '@/components/ui';
import { useStore } from '@/store/useStore';
import StorePinPicker from '@/pages/public/StorePinPicker';
import LegalConsent from '@/components/legal/LegalConsent';
import { compressImage } from '@/lib/imageCompress';
import { uploadFile, buildObjectPath, deleteFile, parseStorageRef } from '@/services/storage';
import type {
  ReferralCode,
  Distributor,
  SubPartnerDistributor,
  AreaSupervisor,
  Plant,
  DeliverySchedule,
} from '@/types';

const STEPS = [
  { label: 'Channel', icon: Hash },
  { label: 'Applicant', icon: User },
  { label: 'Store', icon: StoreIcon },
  { label: 'Details', icon: Truck },
  { label: 'Documents', icon: Upload },
  { label: 'Contract', icon: FileSearch },
];

interface ChannelInfo {
  referral: ReferralCode;
  distributor?: Distributor;
  subPartner?: SubPartnerDistributor;
  areaSupervisor?: AreaSupervisor;
  plant?: Plant;
  label: string;
}

interface FormData {
  channelCode: string;
  fullName: string;
  mobile: string;
  email: string;
  storeName: string;
  address: string;
  province: string;
  city: string;
  barangay: string;
  lat: string;
  lng: string;
  shopCode: string;
  deliverySchedule: '' | DeliverySchedule;
  openingDate: string;
  storePhoto: UploadedFile[];
  govId: UploadedFile[];
  proofOfBilling: UploadedFile[];
}

const EMPTY_FORM: FormData = {
  channelCode: '',
  fullName: '',
  mobile: '',
  email: '',
  storeName: '',
  address: '',
  province: '',
  city: '',
  barangay: '',
  lat: '',
  lng: '',
  shopCode: '',
  deliverySchedule: '',
  openingDate: '',
  storePhoto: [],
  govId: [],
  proofOfBilling: [],
};

export default function FranchiseeOnboardingPage() {
  const navigate = useNavigate();
  const {
    submitApplication,
    referralCodes,
    distributors,
    subPartnerDistributors,
    areaSupervisors,
    plants,
    currentUser,
  } = useStore();

  // Only owner / ops / PD may encode a franchisee onboarding application.
  const canUse =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'operations_manager' ||
    currentUser?.role === 'partner_distributor';

  useEffect(() => {
    if (currentUser && !canUse) navigate('/dashboard', { replace: true });
  }, [currentUser, canUse, navigate]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData | 'terms', string>>>({});
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [channelError, setChannelError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const updateForm = useCallback((field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Channel/referral resolution against LIVE data ───────────
  const resolveChannel = () => {
    const code = form.channelCode.trim();
    if (!code) {
      setChannelError('Please enter a channel / referral code.');
      setChannelInfo(null);
      return;
    }
    const ref = referralCodes.find(
      (r) => r.code.toLowerCase() === code.toLowerCase() && r.status === 'active',
    );
    if (!ref) {
      setChannelError('Invalid or inactive code. Check it and try again.');
      setChannelInfo(null);
      return;
    }
    const plant = plants.find((p) => p.id === ref.plantId);
    if (ref.type === 'sub_partner_distributor') {
      const subPartner = subPartnerDistributors.find((s) => s.id === ref.subPartnerDistributorId);
      const distributor = distributors.find(
        (d) => d.id === (ref.distributorId ?? subPartner?.parentDistributorId),
      );
      setChannelInfo({
        referral: ref,
        distributor,
        subPartner,
        plant,
        label: `Sub-Partner Distributor — ${subPartner?.name ?? ref.subPartnerDistributorId ?? ''}`,
      });
    } else if (ref.type === 'distributor') {
      const distributor = distributors.find((d) => d.id === ref.distributorId);
      setChannelInfo({
        referral: ref,
        distributor,
        plant,
        label: `Partner Distributor — ${distributor?.name ?? ref.distributorId ?? ''}`,
      });
    } else {
      const areaSupervisor = areaSupervisors.find((a) => a.id === ref.areaSupervisorId);
      setChannelInfo({
        referral: ref,
        areaSupervisor,
        plant,
        label: 'Direct to Company (ZAPP)',
      });
    }
    setChannelError('');
  };

  // ── Validation per step ─────────────────────────────────────
  const validateStep = (currentStep: number): boolean => {
    const e: Partial<Record<keyof FormData | 'terms', string>> = {};
    switch (currentStep) {
      case 0:
        if (!form.channelCode.trim()) e.channelCode = 'Channel / referral code is required.';
        else if (!channelInfo) e.channelCode = 'Resolve the code first (click Resolve).';
        break;
      case 1:
        if (!form.fullName.trim()) e.fullName = 'Full name is required.';
        if (!form.mobile.trim()) e.mobile = 'Mobile number is required.';
        else if (!/^(\+63|0)(9\d{9})$/.test(form.mobile.replace(/[\s-]/g, '')))
          e.mobile = 'Enter a valid PH mobile (e.g. 09171234567).';
        if (!form.email.trim()) e.email = 'Email is required.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email.';
        break;
      case 2:
        if (!form.storeName.trim()) e.storeName = 'Store name is required.';
        if (!form.address.trim()) e.address = 'Address is required.';
        if (!form.province.trim()) e.province = 'Province is required.';
        if (!form.city.trim()) e.city = 'City / Municipality is required.';
        if (!form.lat || !form.lng) e.lat = 'I-pin ang eksaktong lokasyon ng tindahan sa mapa.';
        break;
      case 3:
        if (!form.shopCode.trim()) e.shopCode = 'Shop code (from PD) is required.';
        if (!form.deliverySchedule) e.deliverySchedule = 'Select a delivery schedule.';
        if (!form.openingDate) e.openingDate = 'Opening date is required.';
        break;
      case 4:
        if (form.storePhoto.length === 0) e.storePhoto = 'Store photo is required.';
        if (form.govId.length === 0) e.govId = 'Valid ID is required.';
        if (form.proofOfBilling.length === 0) e.proofOfBilling = 'Proof of billing is required.';
        break;
      case 5:
        if (!termsAccepted) e.terms = 'You must agree to the ZAPP Donuts Consignment Agreement.';
        break;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

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

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep(5) || !channelInfo) return;
    setSubmitting(true);

    const scopeId = `pending-${Date.now().toString(36)}`;
    const uploadedRefs: string[] = [];
    let stage: 'upload' | 'save' = 'upload';
    try {
      const upload = async (
        bucket: 'zapp-public' | 'zapp-private',
        purpose: string,
        file: File,
      ) => {
        const compressed = await compressImage(file);
        const res = await uploadFile(bucket, buildObjectPath(purpose, scopeId, compressed), compressed);
        uploadedRefs.push(res.storageRef);
        return res.storageRef;
      };

      const storePhotoRef = await upload('zapp-public', 'store-photo', form.storePhoto[0].file);
      const govIdRef = await upload('zapp-private', 'gov-id', form.govId[0].file);
      const proofRef = await upload('zapp-private', 'proof-of-billing', form.proofOfBilling[0].file);

      stage = 'save';
      await submitApplication({
        fullName: form.fullName,
        mobile: form.mobile,
        email: form.email,
        storeName: form.storeName,
        address: `${form.address}${form.barangay ? `, Brgy. ${form.barangay}` : ''}, ${form.city}, ${form.province}`,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        storePhotoUrl: storePhotoRef,
        govIdUrl: govIdRef,
        proofOfBillingUrl: proofRef,
        referralCode: channelInfo.referral.code,
        referralType: channelInfo.referral.type,
        assignedDistributorId:
          channelInfo.distributor?.id ?? channelInfo.referral.distributorId,
        assignedSubPartnerDistributorId:
          channelInfo.subPartner?.id ?? channelInfo.referral.subPartnerDistributorId,
        assignedAreaSupervisorId:
          channelInfo.areaSupervisor?.id ?? channelInfo.referral.areaSupervisorId,
        assignedPlantId: channelInfo.referral.plantId,
        shopCode: form.shopCode.trim(),
        deliverySchedule: form.deliverySchedule || undefined,
        openingDate: form.openingDate,
        termsAcceptedAt: new Date().toISOString(),
      });
      setShowSuccess(true);
    } catch (err) {
      for (const ref of uploadedRefs) {
        const parsed = parseStorageRef(ref);
        if (parsed) deleteFile(parsed.bucket, parsed.path).catch(() => undefined);
      }
      console.error('[FranchiseeOnboarding] submit failed:', err);
      setErrors({
        terms:
          stage === 'upload'
            ? 'Hindi ma-upload ang mga larawan/dokumento. Pakisubukan ulit (mas malinaw/maliit na file).'
            : 'Hindi na-save ang application. Pakisubukan ulit.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Stepper ─────────────────────────────────────────────────
  const stepper = useMemo(
    () => (
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const current = i === step;
            return (
              <div key={s.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      done
                        ? 'border-green-500 bg-green-500 text-white'
                        : current
                          ? 'border-zapp-orange bg-zapp-orange text-white'
                          : 'border-gray-300 bg-white text-gray-400'
                    }`}
                  >
                    {done ? <Check size={18} /> : <Icon size={18} />}
                  </div>
                  <span
                    className={`hidden text-xs font-medium sm:block ${
                      current ? 'text-zapp-orange' : done ? 'text-green-600' : 'text-gray-400'
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
    ),
    [step],
  );

  // ── Step content ────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Channel / Referral Code</h2>
              <p className="mt-1 text-sm text-gray-500">
                Enter the code that identifies whether this franchisee is under a Partner
                Distributor, a Sub-Partner, or direct to the company.
              </p>
            </div>
            <div className="flex gap-3">
              <Input
                label="Channel / Referral Code *"
                placeholder="e.g. BICOL-MARCO, SPD-MARIEL, or ZAPP-INT-001"
                value={form.channelCode}
                onChange={(e) => {
                  updateForm('channelCode', e.target.value);
                  setChannelError('');
                  setChannelInfo(null);
                }}
                error={errors.channelCode}
                className="flex-1"
                iconLeft={<Hash size={16} />}
              />
              <div className="flex items-end">
                <Button variant="primary" onClick={resolveChannel} disabled={!form.channelCode.trim()}>
                  Resolve
                </Button>
              </div>
            </div>
            {channelError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{channelError}</p>
              </div>
            )}
            {channelInfo && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-center gap-2 text-green-700">
                  {channelInfo.referral.type === 'sub_partner_distributor' ? (
                    <Users size={18} />
                  ) : channelInfo.referral.type === 'distributor' ? (
                    <Handshake size={18} />
                  ) : (
                    <Zap size={18} />
                  )}
                  <span className="font-bold">{channelInfo.label}</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Code <span className="font-medium">{channelInfo.referral.code}</span>
                  {channelInfo.plant && <> · Plant: {channelInfo.plant.name}</>}
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Applicant / Owner Details</h2>
              <p className="mt-1 text-sm text-gray-500">Basic details of the franchisee.</p>
            </div>
            <Input label="Full Name" placeholder="Juan Dela Cruz" value={form.fullName}
              onChange={(e) => updateForm('fullName', e.target.value)} error={errors.fullName} iconLeft={<User size={16} />} />
            <Input label="Mobile Number" placeholder="09171234567" value={form.mobile}
              onChange={(e) => updateForm('mobile', e.target.value)} error={errors.mobile}
              helperText="Philippine format: 09XX or +639XX" iconLeft={<Phone size={16} />} />
            <Input label="Email Address" type="email" placeholder="juan@example.com" value={form.email}
              onChange={(e) => updateForm('email', e.target.value)} error={errors.email} iconLeft={<Mail size={16} />} />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Store Information</h2>
              <p className="mt-1 text-sm text-gray-500">Location details + exact map pin.</p>
            </div>
            <Input label="Store Name" placeholder="ZAPP Donuts - Legazpi Centro" value={form.storeName}
              onChange={(e) => updateForm('storeName', e.target.value)} error={errors.storeName} iconLeft={<StoreIcon size={16} />} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Complete Address</label>
              <textarea
                value={form.address}
                onChange={(e) => updateForm('address', e.target.value)}
                placeholder="Street, Building, Barangay..."
                rows={3}
                className={`block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
                  errors.address ? 'border-red-300 focus:ring-red-500/30' : 'border-gray-300 focus:border-zapp-orange focus:ring-zapp-orange/30'
                }`}
              />
              {errors.address && <p className="mt-1.5 text-xs text-red-600">{errors.address}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input label="Province" placeholder="Albay" value={form.province}
                onChange={(e) => updateForm('province', e.target.value)} error={errors.province} />
              <Input label="City / Municipality" placeholder="Legazpi City" value={form.city}
                onChange={(e) => updateForm('city', e.target.value)} error={errors.city} />
              <Input label="Barangay" placeholder="Brgy. Centro" value={form.barangay}
                onChange={(e) => updateForm('barangay', e.target.value)} />
            </div>
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

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Onboarding Details</h2>
              <p className="mt-1 text-sm text-gray-500">Shop code, delivery schedule, and opening date.</p>
            </div>
            <Input label="Shop Code (from PD)" placeholder="e.g. 131260" value={form.shopCode}
              onChange={(e) => updateForm('shopCode', e.target.value)} error={errors.shopCode} iconLeft={<Hash size={16} />} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Delivery Schedule <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['odd', 'even'] as DeliverySchedule[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateForm('deliverySchedule', opt)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${
                      form.deliverySchedule === opt
                        ? 'border-zapp-orange bg-orange-50 text-zapp-brown'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-zapp-orange/50'
                    }`}
                  >
                    <Truck size={16} className={form.deliverySchedule === opt ? 'text-zapp-orange' : 'text-gray-400'} />
                    <span className="capitalize">{opt}</span>
                    <span className="text-xs text-gray-400">
                      {opt === 'odd' ? '(1,3,5…)' : '(2,4,6…)'}
                    </span>
                  </button>
                ))}
              </div>
              {errors.deliverySchedule && <p className="mt-1.5 text-xs text-red-600">{errors.deliverySchedule}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Opening Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={form.openingDate}
                  onChange={(e) => updateForm('openingDate', e.target.value)}
                  className={`block w-full rounded-lg border bg-white pl-9 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                    errors.openingDate ? 'border-red-300 focus:ring-red-500/30' : 'border-gray-300 focus:border-zapp-orange focus:ring-zapp-orange/30'
                  }`}
                />
              </div>
              {errors.openingDate && <p className="mt-1.5 text-xs text-red-600">{errors.openingDate}</p>}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Documents</h2>
              <p className="mt-1 text-sm text-gray-500">Store photo, valid ID, and proof of billing.</p>
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <ImageIcon size={16} className="text-gray-400" /> Store Photo (Front View) <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" camera onChange={(files) => setForm((p) => ({ ...p, storePhoto: files }))} />
              {errors.storePhoto && <p className="mt-1.5 text-xs text-red-600">{errors.storePhoto}</p>}
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <User size={16} className="text-gray-400" /> Valid Government ID <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" camera onChange={(files) => setForm((p) => ({ ...p, govId: files }))} />
              {errors.govId && <p className="mt-1.5 text-xs text-red-600">{errors.govId}</p>}
            </div>
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileSearch size={16} className="text-gray-400" /> Proof of Billing <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" camera onChange={(files) => setForm((p) => ({ ...p, proofOfBilling: files }))} />
              {errors.proofOfBilling && <p className="mt-1.5 text-xs text-red-600">{errors.proofOfBilling}</p>}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Contract & Terms</h2>
              <p className="mt-1 text-sm text-gray-500">Review the summary, then confirm.</p>
            </div>

            {/* Quick recap */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm space-y-1.5">
              <div><span className="text-gray-500">Channel:</span> <span className="font-medium">{channelInfo?.label}</span></div>
              <div><span className="text-gray-500">Applicant:</span> <span className="font-medium">{form.fullName}</span> · {form.mobile} · {form.email}</div>
              <div><span className="text-gray-500">Store:</span> <span className="font-medium">{form.storeName}</span> — {form.city}, {form.province}</div>
              <div><span className="text-gray-500">Shop Code:</span> <span className="font-medium">{form.shopCode}</span> · <span className="text-gray-500">Delivery:</span> <span className="font-medium capitalize">{form.deliverySchedule}</span> · <span className="text-gray-500">Opening:</span> <span className="font-medium">{form.openingDate}</span></div>
            </div>

            <LegalConsent
              checked={termsAccepted}
              onChange={(v) => {
                setTermsAccepted(v);
                if (v) setErrors((prev) => ({ ...prev, terms: undefined }));
              }}
              error={errors.terms}
              confirmingForOther
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/franchisees')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-zapp-orange transition-colors bg-transparent border-none cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Franchisees
          </button>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Franchisee Application</h1>
          <p className="text-sm text-gray-500 mt-1">Onboard a new franchisee into ZAPP Donuts.</p>
        </div>

        <Card>
          <CardHeader>{stepper}</CardHeader>
          <CardContent>{renderStep()}</CardContent>
          <CardFooter className="flex items-center justify-between">
            <Button variant="ghost" onClick={handlePrev} disabled={step === 0} iconLeft={<ArrowLeft size={16} />}>
              Previous
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={handleNext} iconRight={<ArrowRight size={16} />}>
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSubmit} loading={submitting}
                iconRight={!submitting ? <Check size={16} /> : undefined}>
                Submit Application
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Modal open={showSuccess} onClose={() => { setShowSuccess(false); navigate('/applications'); }} size="sm">
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Application Submitted!</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Naipasa ang onboarding application ni <strong>{form.fullName}</strong>. Nasa review queue
            na ito para sa approval.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="primary" onClick={() => { setShowSuccess(false); navigate('/applications'); }}>
              Go to Applications
            </Button>
            <Button variant="outline" onClick={() => { setShowSuccess(false); setForm(EMPTY_FORM); setChannelInfo(null); setTermsAccepted(false); setStep(0); }}>
              Add Another
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
