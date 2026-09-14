// ============================================================
// ZAPP Donuts ERP — "Endorsed to others" card
// ============================================================
//
// One card that renders every side of the hand-over, because who you are
// decides what you see: the sender offering it, the recipient answering, and
// the read-only record both keep afterwards. Splitting it per role would have
// meant three components that must agree about the same four states.
//
// All gating comes from `lib/endorsement.ts`, never from inline role checks —
// the store re-checks the same helpers, and migration 048 enforces them for
// real. A hidden button is a courtesy, not access control.

import { useMemo, useState } from 'react';
import { Share2, Check, X, Clock, Undo2, ArrowRightLeft } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, Select, Badge } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store/useStore';
import { errorMessage } from '@/lib/errorMessage';
import {
  canCancelEndorsement,
  canEndorse,
  describeTarget,
  endorsementTargets,
  isEndorsementSender,
  isEndorsementTarget,
} from '@/lib/endorsement';
import type { Application } from '@/types';

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-PH') : '—');

export default function EndorsementCard({ application }: { application: Application }) {
  const {
    currentUser,
    distributors,
    subPartnerDistributors,
    plants,
    endorseApplication,
    respondToEndorsement,
    cancelEndorsement,
  } = useStore();
  const { addToast } = useToast();

  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState(false);

  const plantName = (id: string) => plants.find((p) => p.id === id)?.name ?? '';

  const targets = useMemo(
    () => endorsementTargets(currentUser, distributors, subPartnerDistributors, plantName),
    // plantName closes over `plants`; listing it keeps the memo honest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, distributors, subPartnerDistributors, plants],
  );

  const mayEndorse = canEndorse(currentUser, application);
  const amTarget = isEndorsementTarget(currentUser, application);
  const amSender = isEndorsementSender(currentUser, application);
  const mayCancel = canCancelEndorsement(currentUser, application);
  const state = application.endorsementStatus;

  // Nothing to say to anyone who is neither party and where nothing happened.
  if (!mayEndorse && !amTarget && !amSender && !state) return null;

  const senderName =
    distributors.find((d) => d.id === application.endorsedByDistributorId)?.name ?? 'ibang PD';
  const targetLabel = describeTarget(application, distributors, subPartnerDistributors);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      addToast('success', ok);
      setShowDecline(false);
      setDeclineReason('');
      setNote('');
      setChoice('');
    } catch (err) {
      addToast('error', errorMessage(err, 'Hindi na-save ang endorsement.'));
    } finally {
      setBusy(false);
    }
  };

  const submitEndorse = () => {
    const picked = targets.find((t) => t.key === choice);
    if (!picked) {
      addToast('error', 'Pumili muna ng pag-eendorsuhan.');
      return;
    }
    void run(
      () => endorseApplication(application.id, { kind: picked.kind, id: picked.id }, note),
      `Na-endorse kay ${picked.name}. Hihintayin ang pagtanggap nila.`,
    );
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Share2 size={16} className="text-zapp-orange" />
          Endorsed to Others
          {state === 'pending' && <Badge variant="warning" size="sm">Naghihintay</Badge>}
          {state === 'accepted' && <Badge variant="success" size="sm">Tinanggap</Badge>}
          {state === 'declined' && <Badge variant="danger" size="sm">Tinanggihan</Badge>}
        </h2>
      </CardHeader>

      <CardContent>
        {/* ── The recipient decides ─────────────────────────────────────── */}
        {amTarget && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                <strong>{senderName}</strong> ay nag-endorso ng application na ito sa iyo.
              </p>
              {application.endorsementNote && (
                <p className="mt-2 text-sm text-amber-800">
                  <span className="font-medium">Dahilan:</span> {application.endorsementNote}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-700">
                Kapag tinanggap mo, ilILIPAT sa channel mo ang application na ito — pati ang
                plant na maghahatid. Ikaw na rin ang mag-a-approve nito.
              </p>
            </div>

            {!showDecline ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={<Check size={15} />}
                  loading={busy}
                  onClick={() =>
                    void run(
                      () => respondToEndorsement(application.id, 'accept'),
                      'Tinanggap mo ang endorsement — sa iyo na ito.',
                    )
                  }
                >
                  Tanggapin
                </Button>
                <Button variant="outline" size="sm" iconLeft={<X size={15} />} onClick={() => setShowDecline(true)}>
                  Tanggihan
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={2}
                  placeholder="Bakit hindi mo ito matatanggap? (makikita ito ng nag-endorso)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-zapp-orange focus:outline-none focus:ring-2 focus:ring-zapp-orange/30"
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    loading={busy}
                    onClick={() =>
                      void run(
                        () => respondToEndorsement(application.id, 'decline', declineReason),
                        'Tinanggihan — babalik ito sa nag-endorso.',
                      )
                    }
                  >
                    Kumpirmahin ang pagtanggi
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDecline(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── The sender waits ──────────────────────────────────────────── */}
        {!amTarget && state === 'pending' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Clock size={15} className="mt-0.5 shrink-0" />
              <div>
                Na-endorso kay <strong>{targetLabel}</strong> noong {fmt(application.endorsedAt)}.
                Hinihintay ang sagot nila.
                <p className="mt-1 text-xs text-amber-700">
                  Hindi muna pwedeng i-approve habang nakabinbin ito.
                </p>
              </div>
            </div>
            {mayCancel && (
              <Button
                variant="outline"
                size="sm"
                iconLeft={<Undo2 size={15} />}
                loading={busy}
                onClick={() =>
                  void run(() => cancelEndorsement(application.id), 'Binawi ang endorsement.')
                }
              >
                Bawiin ang endorsement
              </Button>
            )}
          </div>
        )}

        {/* ── Resolved ──────────────────────────────────────────────────── */}
        {state === 'accepted' && (
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <ArrowRightLeft size={15} className="mt-0.5 shrink-0" />
            <div>
              Tinanggap ni <strong>{targetLabel}</strong> noong {fmt(application.endorsementResolvedAt)}.
              {amSender && (
                <p className="mt-1 text-xs text-green-800">
                  Nasa kanila na ito. Nananatili itong nakikita mo bilang record, pero hindi
                  mo na ito pwedeng galawin.
                </p>
              )}
            </div>
          </div>
        )}

        {state === 'declined' && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Tinanggihan ni <strong>{targetLabel}</strong> noong {fmt(application.endorsementResolvedAt)}.
            {application.endorsementDeclineReason && (
              <p className="mt-1">
                <span className="font-medium">Dahilan:</span> {application.endorsementDeclineReason}
              </p>
            )}
            <p className="mt-1 text-xs text-red-800">Sa iyo pa rin ito — pwede kang mag-endorso sa iba.</p>
          </div>
        )}

        {/* ── The sender offers it ──────────────────────────────────────── */}
        {mayEndorse && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Kung wala kang saklaw sa lokasyon ng applicant na ito, ipasa mo sa channel na
              may hawak doon.
            </p>
            {targets.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Wala pang ibang aktibong channel na pwedeng pag-endorsuhan.
              </p>
            ) : (
              <>
                <Select
                  label="I-endorso kay"
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  options={[
                    { value: '', label: 'Pumili ng channel...' },
                    ...targets.map((t) => ({
                      value: t.key,
                      // The plants are the whole point — they tell the sender who
                      // actually delivers to the applicant's area.
                      label:
                        `${t.name}${t.kind === 'spd' ? ' (Sub-Partner' + (t.parentName ? ' ng ' + t.parentName : '') + ')' : ''}` +
                        (t.plantNames.length ? ` — ${t.plantNames.join(', ')}` : ''),
                    })),
                  ]}
                />
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Dahilan (hal. Metro Manila ang lokasyon, wala akong coverage)"
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-zapp-orange focus:outline-none focus:ring-2 focus:ring-zapp-orange/30"
                />
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={<Share2 size={15} />}
                  loading={busy}
                  disabled={!choice}
                  onClick={submitEndorse}
                >
                  I-endorso
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
