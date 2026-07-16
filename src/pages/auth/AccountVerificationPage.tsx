// ============================================================
// ZAPP Donuts ERP — Account Verification (first-login gate)
// ============================================================
//
// Replaces the ENTIRE app for a franchisee whose account is not yet `active`.
// Rendered by the short-circuit in App.tsx — never routed to — so there is no
// URL that reaches the ERP around it.
//
// Two states:
//   not_activated        — must submit Gov ID + Proof of Billing + Selfie +
//                          accept Data Privacy. (Upload form lands in Phase C;
//                          this screen currently explains the requirement.)
//   pending_verification — submitted, waiting on staff review. Read-only.
//
// Sign out must always be reachable: without it a locked account is trapped in
// the browser with no way back to the login screen.

import { useState } from 'react';
import { Clock, LogOut, Lock, ShieldCheck, KeyRound } from 'lucide-react';
import { Button, FileUpload } from '@/components/ui';
import type { UploadedFile } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { uploadFile, buildObjectPath } from '@/services/storage';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';
import { passwordState } from '@/lib/loginCredentials';

export default function AccountVerificationPage() {
  const currentUser = useStore((s) => s.currentUser);
  const logout = useStore((s) => s.logout);
  const submitAccountVerification = useStore((s) => s.submitAccountVerification);
  const { addToast } = useToast();

  const [govId, setGovId] = useState<UploadedFile[]>([]);
  const [proof, setProof] = useState<UploadedFile[]>([]);
  const [selfie, setSelfie] = useState<UploadedFile[]>([]);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const isPending = currentUser?.accountStatus === 'pending_verification';
  // Their password was handed to them by another person. This screen is the
  // first place they can make it theirs, and they cannot reach the TopBar menu
  // (the account is locked) — so the prompt has to live here.
  const onTempPassword = passwordState(currentUser ?? undefined) === 'temporary';
  const hasAllDocs = !!govId[0] && !!proof[0] && !!selfie[0];
  // Spec: "The Submit button shall remain disabled until the Data Privacy
  // checkbox has been accepted." Documents are required too — submitting
  // without them would put the account in Pending Verification with nothing
  // for staff to review.
  const canSubmit = hasAllDocs && privacyAccepted && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser) return;
    setSubmitting(true);
    try {
      // Private bucket: these are identity documents. sign:false because the
      // franchisee only uploads them — staff read them via signed URLs later.
      const scope = currentUser.id;
      const [gov, pb, sf] = await Promise.all([
        uploadFile('zapp-private', buildObjectPath('gov-id', scope, govId[0].file), govId[0].file, { sign: false }),
        uploadFile('zapp-private', buildObjectPath('proof-of-billing', scope, proof[0].file), proof[0].file, { sign: false }),
        uploadFile('zapp-private', buildObjectPath('selfie', scope, selfie[0].file), selfie[0].file, { sign: false }),
      ]);
      await submitAccountVerification({
        govIdUrl: gov.storageRef,
        proofOfBillingUrl: pb.storageRef,
        selfieUrl: sf.storageRef,
      });
      addToast('success', 'Your documents have been submitted.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not submit. Please try again.';
      addToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // items-start + overflow-y so the upload form can grow past the viewport on
    // a phone — a centred fixed-height card would clip the Submit button.
    <div className="min-h-screen overflow-y-auto flex items-start justify-center bg-gray-50 p-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
            isPending ? 'bg-amber-100' : 'bg-orange-100'
          }`}
        >
          {isPending ? (
            <Clock size={30} className="text-amber-600" />
          ) : (
            <Lock size={30} className="text-zapp-orange" />
          )}
        </div>

        <h1 className="mt-5 text-xl font-bold text-gray-900">
          {isPending ? 'We are checking your documents' : 'Verify your account'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {isPending
            ? 'Your documents have been submitted. Our team is reviewing them. We will let you know once your account is active.'
            : 'Please complete this before you can use the system.'}
        </p>

        {currentUser && (
          <div className="mt-6 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Account</span>
              <span className="font-medium text-gray-900">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Status</span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  isPending ? 'text-amber-600' : 'text-gray-600'
                }`}
              >
                {isPending ? <Clock size={13} /> : <Lock size={13} />}
                {isPending ? 'Pending Verification' : 'Not Activated'}
              </span>
            </div>
          </div>
        )}

        {!isPending && (
          <div className="mt-6 space-y-4 text-left">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Government-issued ID <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" maxSizeMB={10} camera onChange={setGovId} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Proof of Billing <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" maxSizeMB={10} camera onChange={setProof} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Selfie Verification <span className="text-red-500">*</span>
              </label>
              <FileUpload accept="image/*" maxSizeMB={10} camera onChange={setSelfie} />
              <p className="mt-1 text-xs text-gray-500">
                Take a selfie while holding your Government ID.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-zapp-orange"
              />
              <span className="text-xs text-gray-700">
                I agree to the ZAPP Donuts <strong>Data Privacy Policy</strong> and allow my
                documents to be used for verification.
              </span>
            </label>

            <Button
              variant="primary"
              className="w-full"
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              iconLeft={<ShieldCheck size={16} />}
            >
              Submit for Verification
            </Button>
            {!canSubmit && !submitting && (
              <p className="text-center text-xs text-gray-500">
                {!hasAllDocs
                  ? 'Please upload all three documents.'
                  : 'Please accept the Data Privacy Policy.'}
              </p>
            )}
          </div>
        )}

        {onTempPassword && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
            <p className="text-xs text-amber-800">
              You are still using the temporary password that was given to you. Please set your
              own password.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              iconLeft={<KeyRound size={14} />}
              onClick={() => setChangingPassword(true)}
            >
              Change Password
            </Button>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-2">
          {!onTempPassword && (
            <button
              onClick={() => setChangingPassword(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <KeyRound size={15} /> Change Password
            </button>
          )}
          <button
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      <ChangePasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </div>
  );
}
