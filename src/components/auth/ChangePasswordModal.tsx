// ============================================================
// ZAPP Donuts ERP — Change Password
// ============================================================
//
// Login Credentials & First-Time Account Activation — Phase G.
//
// Without this there is no way off the temporary password: approval mints one,
// the franchisee is told it, and it stays theirs forever. It is also what makes
// the Login Credentials card's "Password Updated" state reachable at all —
// passwordChangedAt is stamped here and nowhere else.
//
// Reachable from two places on purpose:
//   • the first-login verification screen — the franchisee is still LOCKED out
//     of every module there, which is exactly when they hold a password that
//     was relayed to them by another person;
//   • the TopBar user menu, once they are in.
//
// No "current password" field: Supabase's updateUser acts on the live session,
// so possession of the session IS the proof. Asking for it again would be
// theatre.

import { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';

/** Supabase's own default floor is 6; 8 is the shortest that isn't trivial. */
const MIN_LENGTH = 8;

export default function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const changeOwnPassword = useStore((s) => s.changeOwnPassword);
  const { addToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_LENGTH && password === confirm && !busy;

  const reset = () => {
    setPassword('');
    setConfirm('');
    setReveal(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await changeOwnPassword(password);
      addToast('success', 'Your password has been changed.');
      reset();
      onClose();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return;
        reset();
        onClose();
      }}
      title="Change Password"
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            iconLeft={<KeyRound size={15} />}
            onClick={handleSubmit}
            loading={busy}
            disabled={!canSubmit}
          >
            Save Password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose a password only you know. It must be at least {MIN_LENGTH} characters.
        </p>

        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-gray-700">
            New Password
          </label>
          <div className="relative">
            <input
              id="new-password"
              type={reveal ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-gray-900 focus:border-zapp-orange focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {tooShort && (
            <p className="mt-1 text-xs text-red-600">Too short — use at least {MIN_LENGTH} characters.</p>
          )}
        </div>

        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-gray-700">
            Confirm New Password
          </label>
          <input
            id="confirm-password"
            type={reveal ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={busy}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-zapp-orange focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 disabled:bg-gray-50"
          />
          {mismatch && <p className="mt-1 text-xs text-red-600">The passwords do not match.</p>}
        </div>
      </div>
    </Modal>
  );
}
