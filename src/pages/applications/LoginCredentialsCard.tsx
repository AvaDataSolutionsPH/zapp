// ============================================================
// ZAPP Donuts ERP — Login Credentials card
// ============================================================
//
// Login Credentials & First-Time Account Activation — Phases E + F.
//
// "Display the Username, the password status, the Account Status and the date
// and time the Data Privacy Policy was accepted... Authorized personnel may
// reset the password."
//
// Lives on the Application Details page next to Documents, because that is
// where the same people already verify the account. It renders only for an
// application that actually minted a login (accountUserId), so /onboarding
// applicants — who kept their own email login — never see an empty card.
//
// ⚠️ There is no password on this card, by design. See lib/loginCredentials.

import { useState } from 'react';
import { KeyRound, Copy, CheckCircle2, AlertCircle, RotateCcw, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import type { GeneratedLogin } from '@/store/useStore';
import {
  ACCOUNT_STATUS_LABELS,
  PASSWORD_STATE_LABELS,
  canResetPassword,
  canViewLoginCredentials,
  passwordState,
} from '@/lib/loginCredentials';
import type { AccountStatus, Application } from '@/types';

const STATUS_VARIANT: Record<AccountStatus, 'neutral' | 'warning' | 'success'> = {
  not_activated: 'neutral',
  pending_verification: 'warning',
  active: 'success',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-700">{children}</dd>
    </div>
  );
}

export default function LoginCredentialsCard({ application }: { application: Application }) {
  const { currentUser, demoUsers, resetFranchiseePassword } = useStore();
  const { addToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<GeneratedLogin | null>(null);
  const [copied, setCopied] = useState(false);

  const accountUser = application.accountUserId
    ? demoUsers.find((u) => u.id === application.accountUserId)
    : undefined;

  // No generated login (legacy approval, /onboarding, or not approved yet) —
  // there is nothing to show, so the card stays out of the page entirely.
  if (!application.accountUserId || !canViewLoginCredentials(currentUser?.role)) return null;

  const pwState = passwordState(accountUser);
  const status = accountUser?.accountStatus;

  const handleReset = async () => {
    setBusy(true);
    try {
      const generated = await resetFranchiseePassword(application.accountUserId!);
      setConfirming(false);
      // Same one-time reveal as approval: this is the only moment it exists in
      // readable form.
      setIssued(generated);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Hindi na-reset ang password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <KeyRound size={18} /> Login Credentials
          </h2>
          {canResetPassword(currentUser?.role) && (
            <Button
              variant="outline"
              size="sm"
              iconLeft={<RotateCcw size={14} />}
              onClick={() => setConfirming(true)}
            >
              Reset Password
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Username">
            <span className="font-mono font-semibold text-gray-900">
              {application.shopCode ?? '—'}
            </span>
          </Field>
          <Field label="Password">
            <span className="inline-flex items-center gap-1.5">
              <Badge variant={pwState === 'updated' ? 'success' : 'warning'} size="sm">
                {PASSWORD_STATE_LABELS[pwState]}
              </Badge>
            </span>
            {pwState === 'updated' && accountUser?.passwordChangedAt && (
              <span className="mt-1 block text-xs text-gray-400">
                {new Date(accountUser.passwordChangedAt).toLocaleString()}
              </span>
            )}
          </Field>
          <Field label="Account Status">
            {status ? (
              <Badge variant={STATUS_VARIANT[status]} size="sm">
                {ACCOUNT_STATUS_LABELS[status]}
              </Badge>
            ) : (
              '—'
            )}
          </Field>
          <Field label="Data Privacy Accepted">
            {application.acceptedPrivacyAt
              ? new Date(application.acceptedPrivacyAt).toLocaleString()
              : 'Not yet accepted'}
          </Field>
          <Field label="Last Sign-in">
            {accountUser?.lastLoginAt
              ? new Date(accountUser.lastLoginAt).toLocaleString()
              : 'Never signed in'}
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Login Address (system)">
              {/* The franchisee types the Shop Code, never this — but staff
                  debugging a "cannot log in" call need to see it. */}
              <span className="font-mono break-all text-gray-500">{accountUser?.email ?? '—'}</span>
            </Field>
          </div>
        </dl>
      </CardContent>

      {/* Reset confirmation. The old password dies the moment this runs, so it
          is a deliberate two-step. */}
      <Modal
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        title="Reset Password"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" iconLeft={<RotateCcw size={15} />} onClick={handleReset} loading={busy}>
              Issue New Password
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Bibigyan si <span className="font-semibold">{application.fullName}</span> ng bagong
            <strong> temporary password</strong>.
          </p>
          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <ShieldAlert size={13} className="mt-0.5 shrink-0" />
            <span>
              Hindi na gagana ang dati niyang password. Makikita mo ang bago ngayon lang — ikaw
              ang magbibigay nito sa kanya.
            </span>
          </p>
        </div>
      </Modal>

      {/* One-time reveal — identical contract to the credentials shown at
          approval: closing this loses the password for good. */}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="Bagong temporary password" size="md">
        {issued && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                <KeyRound size={14} /> Ibigay ito sa franchisee
              </div>
              <div className="mt-3 space-y-1.5 font-mono text-sm">
                <div>
                  <span className="text-gray-500">Username:</span>{' '}
                  <span className="font-semibold">{issued.username}</span>
                </div>
                <div>
                  <span className="text-gray-500">Temporary Password:</span>{' '}
                  <span className="font-semibold">{issued.tempPassword}</span>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <strong>Ngayon lang ito makikita.</strong>&nbsp;Naka-encrypt ang password sa
                database at hindi na mababasa muli.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                iconLeft={copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `ZAPP Donuts login\nUsername: ${issued.username}\nTemporary Password: ${issued.tempPassword}`,
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    addToast('error', 'Hindi ma-copy — kopyahin nang manual.');
                  }
                }}
              >
                {copied ? 'Copied!' : 'Copy Credentials'}
              </Button>
              <Button variant="primary" onClick={() => setIssued(null)}>
                Nakopya ko na
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
