// ============================================================
// ZAPP Donuts ERP - Partner Onboarding (self-service) — Phase 1
// ============================================================
//
// New, standalone applicant flow (route /onboarding). Distinct from the legacy
// public /apply and the internal /franchisees/new. See
// docs/superpowers/specs/2026-07-12-partner-onboarding-workflow-design.md.
//
// Steps (Boss's workflow; Step 5 removed):
//   1 Create Account   → real auth login (isolated signUp) + channel code
//   2 Business Info    → store + addresses + FB link + operating hours + map pin
//   3 Documents        → Gov ID, Proof of Billing, Live Selfie, Store Photo
//   4 Review Legal     → view Consignment / Privacy / Terms
//   6 Confirmations    → 4 checkboxes; Submit enabled only when all checked
//   7 Submit           → upload docs + insert application (+ Application Number)
//
// Phase 1 scope: happy path + persistence. Submission metadata (IP/device/GPS),
// PDF copy, and ID OCR autofill are Phase 2/3.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Store as StoreIcon,
  Upload,
  ScrollText,
  CheckSquare,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button, Card, CardContent, Input, FileUpload } from '@/components/ui';
import type { UploadedFile } from '@/components/ui';
import { useStore } from '@/store/useStore';
import StorePinPicker from './StorePinPicker';
import LegalDocModal from '@/components/legal/LegalDocModal';
import { LEGAL_DOCS, type LegalDocKey } from '@/data/legalContent';
import { signUpIsolated } from '@/lib/authSignup';
import { uploadFile, buildObjectPath } from '@/services/storage';
import type { Application, ReferralType } from '@/types';

const LEGAL_VERSION = '2026-07';

const STEPS = [
  { label: 'Create Account', icon: UserIcon },
  { label: 'Business Info', icon: StoreIcon },
  { label: 'Documents', icon: Upload },
  { label: 'Review Legal', icon: ScrollText },
  { label: 'Confirm & Submit', icon: CheckSquare },
];

interface FormState {
  referralCode: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  mobile: string;
  email: string;
  password: string;
  confirmPassword: string;
  storeName: string;
  businessAddress: string;
  residentialAddress: string;
  facebookLink: string;
  operatingHours: string;
  province: string;
  lat: string;
  lng: string;
  govId: UploadedFile[];
  proofOfBilling: UploadedFile[];
  selfie: UploadedFile[];
  storePhoto: UploadedFile[];
}

const EMPTY_FORM: FormState = {
  referralCode: '', firstName: '', middleName: '', lastName: '', suffix: '',
  mobile: '', email: '', password: '', confirmPassword: '',
  storeName: '', businessAddress: '', residentialAddress: '', facebookLink: '',
  operatingHours: '', province: '', lat: '', lng: '',
  govId: [], proofOfBilling: [], selfie: [], storePhoto: [],
};

const CONFIRMS = [
  { key: 'consignment' as const, label: 'I have read and agree to the ZAPP Donuts Consignment Display Agreement.', doc: 'consignment' as LegalDocKey },
  { key: 'privacy' as const, label: 'I have read and understood the Privacy Notice and consent to the processing of my personal information.', doc: 'privacy' as LegalDocKey },
  { key: 'terms' as const, label: 'I have read and agree to the Website Terms of Use.', doc: 'terms' as LegalDocKey },
  { key: 'certification' as const, label: 'I certify that all information and documents submitted are true, complete, authentic, and belong to me or to the business I represent.', doc: null },
];

type CheckState = Record<'consignment' | 'privacy' | 'terms' | 'certification', boolean>;

function makeApplicationNumber(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ZAPP-${ymd}-${rand}`;
}

export default function PartnerOnboardingPage() {
  const navigate = useNavigate();
  const { submitApplication, referralCodes } = useStore();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [accountCreated, setAccountCreated] = useState(false);
  const [checks, setChecks] = useState<CheckState>({
    consignment: false, privacy: false, terms: false, certification: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocKey | null>(null);
  const [success, setSuccess] = useState<string | null>(null); // application number

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: '' }));
  };

  const allChecked = Object.values(checks).every(Boolean);

  // Best-effort channel-code resolution (authoritative resolution happens at
  // Admin verification; anon applicants only have the mock referral slice).
  const resolvedChannel = useMemo(() => {
    const code = form.referralCode.trim().toUpperCase();
    if (!code) return null;
    return referralCodes.find((r) => r.code.toUpperCase() === code) ?? null;
  }, [form.referralCode, referralCodes]);

  // ── Validation ────────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!form.referralCode.trim()) e.referralCode = 'Channel code is required.';
      if (!form.firstName.trim()) e.firstName = 'First name is required.';
      if (!form.lastName.trim()) e.lastName = 'Surname is required.';
      if (!form.mobile.trim()) e.mobile = 'Mobile number is required.';
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Valid email is required.';
      if (form.password.length < 6) e.password = 'Password must be at least 6 characters.';
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match.';
    } else if (s === 1) {
      if (!form.storeName.trim()) e.storeName = 'Store name is required.';
      if (!form.businessAddress.trim()) e.businessAddress = 'Business address is required.';
      if (!form.residentialAddress.trim()) e.residentialAddress = 'Residential address is required.';
      if (!form.operatingHours.trim()) e.operatingHours = 'Operating hours are required.';
      if (!form.lat || !form.lng) e.pin = 'I-pin ang eksaktong lokasyon ng iyong TINDAHAN.';
    } else if (s === 2) {
      if (form.govId.length === 0) e.govId = 'Government-issued ID is required.';
      if (form.proofOfBilling.length === 0) e.proofOfBilling = 'Proof of billing is required.';
      if (form.selfie.length === 0) e.selfie = 'Live selfie is required.';
      if (form.storePhoto.length === 0) e.storePhoto = 'Store photo is required.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 0: create the auth login (isolated — no session) ──────────────
  const handleCreateAccount = async () => {
    if (!validateStep(0)) return;
    if (accountCreated) { setStep(1); return; }
    setBusy(true);
    try {
      await signUpIsolated(form.email.trim().toLowerCase(), form.password);
      setAccountCreated(true);
      setStep(1);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '';
      setErrors({
        email: /registered|already/i.test(msg)
          ? 'This email already has an account. Try logging in instead.'
          : 'Could not create the account. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const next = () => { if (validateStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!allChecked) return;
    setBusy(true);
    setErrors({});
    try {
      const scope = `onb-${Date.now().toString(36)}`;
      // sign:false — the applicant is anonymous and can't sign every private
      // prefix (e.g. selfie/); we only persist the storageRef, which is
      // re-signed on render by an authenticated reader.
      const up = async (bucket: 'zapp-public' | 'zapp-private', purpose: string, f: UploadedFile) =>
        (await uploadFile(bucket, buildObjectPath(purpose, scope, f.file), f.file, { sign: false })).storageRef;

      const [govIdUrl, proofUrl, selfieUrl, storePhotoUrl] = await Promise.all([
        up('zapp-private', 'gov-id', form.govId[0]),
        up('zapp-private', 'proof-of-billing', form.proofOfBilling[0]),
        up('zapp-private', 'selfie', form.selfie[0]),
        up('zapp-public', 'store-photo', form.storePhoto[0]),
      ]);

      const now = new Date().toISOString();
      const fullName = [form.firstName, form.middleName, form.lastName, form.suffix]
        .map((s) => s.trim()).filter(Boolean).join(' ');
      const referralType: ReferralType = resolvedChannel?.type ?? 'zapp_internal';
      const applicationNumber = makeApplicationNumber();

      const app: Omit<Application, 'id' | 'status' | 'submittedAt' | 'auditLog'> = {
        fullName,
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        suffix: form.suffix.trim() || undefined,
        mobile: form.mobile.trim(),
        email: form.email.trim().toLowerCase(),
        storeName: form.storeName.trim(),
        address: form.businessAddress.trim(),
        residentialAddress: form.residentialAddress.trim(),
        facebookLink: form.facebookLink.trim() || undefined,
        operatingHours: form.operatingHours.trim(),
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        storePhotoUrl,
        govIdUrl,
        proofOfBillingUrl: proofUrl,
        selfieUrl,
        referralCode: form.referralCode.trim().toUpperCase(),
        referralType,
        assignedDistributorId: resolvedChannel?.distributorId,
        assignedSubPartnerDistributorId: resolvedChannel?.subPartnerDistributorId,
        assignedPlantId: resolvedChannel?.plantId ?? 'plant-01',
        acceptedConsignmentAt: now,
        acceptedPrivacyAt: now,
        acceptedTermsAt: now,
        certifiedAt: now,
        agreementVersion: LEGAL_VERSION,
        applicationNumber,
      };

      await submitApplication(app);
      setSuccess(applicationNumber);
    } catch {
      setErrors({ submit: 'Submission failed. Please check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="mt-5 text-xl font-bold text-gray-900">Application Submitted!</h1>
          <p className="mt-2 text-sm text-gray-500">
            Matagumpay na naisumite ang iyong onboarding requirements. Awaiting verification.
          </p>
          <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <span className="text-gray-500">Application Number</span>
            <p className="mt-1 font-mono text-lg font-bold text-gray-900">{success}</p>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Mag-login gamit ang iyong email at password para masubaybayan ang status.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Partner Onboarding</h1>
          <p className="mt-1 text-sm text-gray-500">Kumpletuhin ang mga hakbang para maging ZAPP Donuts Store Partner.</p>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.label} className="flex flex-1 flex-col items-center">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                  active ? 'border-zapp-orange bg-orange-50 text-zapp-orange'
                    : done ? 'border-green-500 bg-green-50 text-green-600'
                      : 'border-gray-200 bg-white text-gray-400'}`}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className={`mt-1 hidden text-[11px] sm:block ${active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <Card>
          <CardContent>
            {/* STEP 0 — Create Account */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Create Account</h2>
                <Input label="Channel / Referral Code" value={form.referralCode}
                  onChange={(e) => set('referralCode', e.target.value)} error={errors.referralCode}
                  placeholder="e.g. SPD-MARIEL" />
                {resolvedChannel && (
                  <p className="-mt-2 text-xs text-green-600">✓ Channel resolved: {resolvedChannel.type.replace(/_/g, ' ')}</p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="First Name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} />
                  <Input label="Middle Name (optional)" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
                  <Input label="Surname / Last Name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} />
                  <Input label="Suffix (optional)" value={form.suffix} onChange={(e) => set('suffix', e.target.value)} placeholder="Jr., Sr., III" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Mobile Number" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} error={errors.mobile} placeholder="+63 9xx xxx xxxx" />
                  <Input label="Email Address" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} disabled={accountCreated} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label="Password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} disabled={accountCreated} />
                  <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} error={errors.confirmPassword} disabled={accountCreated} />
                </div>
                {accountCreated && (
                  <p className="text-xs text-green-600">✓ Account created. Continue with your onboarding.</p>
                )}
              </div>
            )}

            {/* STEP 1 — Business Info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Business Information</h2>
                <Input label="Store Name" value={form.storeName} onChange={(e) => set('storeName', e.target.value)} error={errors.storeName} />
                <Input label="Business Address" value={form.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} error={errors.businessAddress} />
                <Input label="Residential Address" value={form.residentialAddress} onChange={(e) => set('residentialAddress', e.target.value)} error={errors.residentialAddress} />
                <Input label="Personal Facebook Link (optional)" value={form.facebookLink} onChange={(e) => set('facebookLink', e.target.value)} placeholder="https://facebook.com/..." />
                <Input label="Operating Hours" value={form.operatingHours} onChange={(e) => set('operatingHours', e.target.value)} error={errors.operatingHours} placeholder="e.g. 8:00 AM – 8:00 PM" />
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Store Location (pin)</label>
                  <p className="mb-2 text-xs text-amber-600">I-pin ang EKSAKTONG lokasyon ng iyong TINDAHAN — hindi ang inyong bahay.</p>
                  <StorePinPicker lat={form.lat} lng={form.lng} onChange={(la, ln) => { set('lat', la); set('lng', ln); }} />
                  {errors.pin && <p className="mt-1 text-xs text-red-600">{errors.pin}</p>}
                </div>
              </div>
            )}

            {/* STEP 2 — Documents */}
            {step === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-bold text-gray-900">Upload Required Documents</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Government-Issued ID</label>
                  <FileUpload accept="image/*,.pdf" camera onChange={(f) => set('govId', f)} />
                  {errors.govId && <p className="mt-1 text-xs text-red-600">{errors.govId}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Proof of Billing (Residential)</label>
                  <FileUpload accept="image/*,.pdf" camera onChange={(f) => set('proofOfBilling', f)} />
                  {errors.proofOfBilling && <p className="mt-1 text-xs text-red-600">{errors.proofOfBilling}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Live Selfie Verification</label>
                  <FileUpload accept="image/*" camera onChange={(f) => set('selfie', f)} />
                  {errors.selfie && <p className="mt-1 text-xs text-red-600">{errors.selfie}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Store Photo</label>
                  <FileUpload accept="image/*" camera onChange={(f) => set('storePhoto', f)} />
                  {errors.storePhoto && <p className="mt-1 text-xs text-red-600">{errors.storePhoto}</p>}
                </div>
              </div>
            )}

            {/* STEP 3 — Review Legal */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Review Legal Documents</h2>
                <p className="text-sm text-gray-500">Basahin ang bawat dokumento bago magpatuloy.</p>
                <div className="space-y-2">
                  {(['consignment', 'privacy', 'terms'] as LegalDocKey[]).map((k) => (
                    <button key={k} type="button" onClick={() => setOpenDoc(k)}
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-zapp-orange hover:bg-orange-50">
                      <span className="font-medium text-gray-900">{LEGAL_DOCS[k].title}</span>
                      <span className="text-xs font-semibold text-zapp-orange">View</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4 — Confirmations + Submit */}
            {step === 4 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">Confirmations</h2>
                <p className="text-sm text-gray-500">Lagyan ng check ang lahat bago mag-submit.</p>
                <div className="space-y-3">
                  {CONFIRMS.map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <input type="checkbox" checked={checks[c.key]}
                        onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-zapp-orange focus:ring-zapp-orange" />
                      <span className="text-sm text-gray-700">
                        {c.doc ? (
                          <>
                            {c.label.split(LEGAL_DOCS[c.doc].label)[0]}
                            <button type="button" onClick={() => setOpenDoc(c.doc)} className="font-semibold text-zapp-orange underline underline-offset-2">
                              {LEGAL_DOCS[c.doc].label}
                            </button>
                            {c.label.split(LEGAL_DOCS[c.doc].label)[1]}
                          </>
                        ) : c.label}
                      </span>
                    </label>
                  ))}
                </div>
                {errors.submit && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={16} /> {errors.submit}
                  </div>
                )}
              </div>
            )}

            {/* Nav */}
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
              <button onClick={back} disabled={step === 0 || busy}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">
                <ArrowLeft size={15} /> Back
              </button>

              {step === 0 ? (
                <Button onClick={handleCreateAccount} loading={busy}>
                  {accountCreated ? 'Next' : 'Create Account'} <ArrowRight size={15} className="ml-1" />
                </Button>
              ) : step < STEPS.length - 1 ? (
                <Button onClick={next} disabled={busy}>Next <ArrowRight size={15} className="ml-1" /></Button>
              ) : (
                <Button onClick={handleSubmit} loading={busy} disabled={!allChecked || busy}>
                  {busy ? <Loader2 size={15} className="mr-1 animate-spin" /> : null}
                  Submit Application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <LegalDocModal docKey={openDoc} onClose={() => setOpenDoc(null)} />
    </div>
  );
}
