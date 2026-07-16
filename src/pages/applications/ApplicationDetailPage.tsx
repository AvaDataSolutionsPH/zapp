import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  XCircle,
  ScrollText,
  Clock,
  Facebook,
  KeyRound,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { GeneratedLogin } from '@/store/useStore';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  StatusBadge,
  Modal,
  EmptyState,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ensureHttpUrl } from '@/lib/externalUrl';
import { resolveLocation } from '@/lib/phRegions';
import { canSetStatus, effectiveAreaSupervisorId, ROLE_LABELS } from '@/lib/applicationMonitoring';
import { useStorageUrl } from '@/lib/useStorageUrl';
import MonitoringFieldsCard from './MonitoringFieldsCard';
import DocumentsSection from './DocumentsSection';
import LoginCredentialsCard from './LoginCredentialsCard';

// Resolves a private storage ref to a signed URL (one hook call per render) so
// the reviewer can open the system-generated PDF copy of the application.
function OnboardingPdfLink({ refStr }: { refStr: string }) {
  const url = useStorageUrl(refStr);
  if (!url) return <span className="text-gray-400">Loading…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
      View / Download PDF
    </a>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    applications,
    plants,
    distributors,
    areaSupervisors,
    currentUser,
    reviewApplication,
  } = useStore();

  const application = useMemo(
    () => applications.find((a) => a.id === id),
    [applications, id],
  );

  const { addToast } = useToast();

  // Document storage refs + their preview modal live in DocumentsSection now —
  // each of the four tiles needs its own useStorageUrl hook.
  const [notes, setNotes] = useState(application?.notes ?? '');
  // Non-null only in the moment right after approval generated a login. Never
  // re-derivable — closing this dialog loses the password for good.
  const [credentials, setCredentials] = useState<GeneratedLogin | null>(null);
  const [copied, setCopied] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (!application) {
    return (
      <div className="p-6">
        <EmptyState
          title="Application Not Found"
          description="The application you are looking for does not exist."
          actionLabel="Back to Applications"
          onAction={() => navigate('/applications')}
        />
      </div>
    );
  }

  // Both /apply and /onboarding collect these, so they live in Applicant
  // Information (shown for every application) rather than the onboarding card.
  const fbUrl = ensureHttpUrl(application.facebookLink);
  const operating =
    [application.operatingDays, application.operatingHours].filter(Boolean).join(' · ') || '—';

  const plant = plants.find((p) => p.id === application.assignedPlantId);
  const distributor = application.assignedDistributorId
    ? distributors.find((d) => d.id === application.assignedDistributorId)
    : null;
  // Same resolution as the list: the admin province master list wins over the
  // id the referral code happened to carry.
  const effectiveAsId = effectiveAreaSupervisorId(application, areaSupervisors);
  const areaSupervisor = effectiveAsId
    ? areaSupervisors.find((a) => a.id === effectiveAsId)
    : null;

  // Self-service Partner Onboarding applications (marked by an applicationNumber)
  // get "Verify & Activate" (creates the partner login + store) / "Request Info"
  // / "Reject". Legacy /apply applications keep plain Approve / Decline.
  const isOnboarding = !!application.applicationNumber;
  // Two gates: the application must still be open, AND the role must own Status.
  // The role gate is new — Status used to be status-only, which let an Area
  // Supervisor approve (RLS permits an AS row UPDATE). The monitoring module's
  // RBAC table scopes Status to OS + Admin; partner_distributor is kept on top
  // of that because approving its own-channel franchisees was an explicit boss
  // request (commit 7796856 + migration 018). See lib/applicationMonitoring.
  const canAct =
    (application.status === 'pending' || application.status === 'needs_more_info') &&
    canSetStatus(currentUser?.role);

  // The Shop Code becomes the franchisee's username, so approving without one
  // would create a store nobody can log into. Gates APPROVE only — declining or
  // requesting info never needs a code. /onboarding applicants already have
  // their own login, so they are exempt.
  const needsShopCode = !isOnboarding && !application.shopCode?.trim();

  const handleAction = async (action: 'approved' | 'declined' | 'needs_more_info') => {
    setActionLoading(true);
    try {
      const generated = await reviewApplication(
        application.id,
        action,
        currentUser?.id ?? 'system',
        notes || undefined,
      );
      // Revealed ONCE — the password is bcrypt-hashed by Supabase and can never
      // be read back. If the reviewer closes this without copying it, the only
      // recovery is a password reset.
      if (generated) setCredentials(generated);
      const msg =
        action === 'approved'
          ? isOnboarding
            ? `${application.fullName} verified — partner login + store created.`
            : `Application from ${application.fullName} approved — store + login created.`
          : action === 'needs_more_info'
            ? `Requested more information from ${application.fullName}.`
            : `Application from ${application.fullName} ${isOnboarding ? 'rejected' : 'declined'}.`;
      addToast(action === 'approved' ? 'success' : 'info', msg);
      setShowApprove(false);
      setShowDecline(false);
      setShowRequestInfo(false);
    } catch {
      addToast('error', `Failed to update the application. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };


  return (
    <div className="p-6 space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<ArrowLeft size={16} />}
          onClick={() => navigate('/applications')}
        >
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {application.fullName}
            </h1>
            <StatusBadge category="application" status={application.status} size="md" />
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Application ID: {application.id}
          </p>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <Button
              variant="danger"
              iconLeft={<XCircle size={16} />}
              onClick={() => setShowDecline(true)}
            >
              {isOnboarding ? 'Reject' : 'Decline'}
            </Button>
            {isOnboarding && (
              <Button
                variant="secondary"
                iconLeft={<Mail size={16} />}
                onClick={() => setShowRequestInfo(true)}
              >
                Request Info
              </Button>
            )}
            <Button
              variant="primary"
              iconLeft={<CheckCircle2 size={16} />}
              onClick={() => setShowApprove(true)}
              disabled={needsShopCode}
              title={
                needsShopCode
                  ? 'Kailangan muna ng Shop Code — ito ang magiging username ng franchisee.'
                  : undefined
              }
            >
              {isOnboarding ? 'Verify & Activate' : 'Approve'}
            </Button>
          </div>
        )}
      </div>

      {/* Why Approve is disabled — a bare greyed-out button would just look
          broken. Shop Code is set on Evaluation Details (AS/OS/Admin). */}
      {canAct && needsShopCode && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            <strong>Kailangan ng Shop Code bago mag-approve.</strong> Ito ang magiging
            username ng franchisee sa kanyang login. Ilagay ito sa{' '}
            <strong>Evaluation Details</strong> sa ibaba (Area Supervisor / Ops / Admin).
          </span>
        </div>
      )}

      {/* Onboarding-specific details (self-service Partner Onboarding only) */}
      {isOnboarding && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ScrollText size={18} /> Onboarding Details
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Application No.</dt>
                <dd className="mt-1 text-sm font-mono font-semibold text-gray-900">{application.applicationNumber}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name on ID (scanned)</dt>
                <dd className="mt-1 text-sm text-gray-700">{application.idScannedName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">ID Number</dt>
                <dd className="mt-1 text-sm font-mono text-gray-700">{application.idNumber ?? '—'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Residential Address</dt>
                <dd className="mt-1 text-sm text-gray-700">{application.residentialAddress ?? '—'}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Accepted Agreements{application.agreementVersion ? ` (v${application.agreementVersion})` : ''}
              </p>
              <ul className="space-y-1.5 text-sm text-gray-700">
                {[
                  { label: 'Consignment Display Agreement', at: application.acceptedConsignmentAt },
                  { label: 'Privacy Notice', at: application.acceptedPrivacyAt },
                  { label: 'Website Terms of Use', at: application.acceptedTermsAt },
                  { label: 'Certification (info true & authentic)', at: application.certifiedAt },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-2">
                    {row.at ? (
                      <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                    ) : (
                      <XCircle size={15} className="text-gray-300 shrink-0" />
                    )}
                    <span>{row.label}</span>
                    {row.at && (
                      <span className="text-xs text-gray-400">— {new Date(row.at).toLocaleString()}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {(application.submittedIp || application.deviceInfo || application.gpsLat != null || application.pdfUrl) && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Submission Metadata
                </p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</dt>
                    <dd className="mt-1 text-sm text-gray-700">{application.submittedIp ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Device</dt>
                    <dd className="mt-1 text-sm text-gray-700 break-all">{application.deviceInfo ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">GPS (device)</dt>
                    <dd className="mt-1 text-sm text-gray-700">
                      {application.gpsLat != null && application.gpsLng != null
                        ? `${application.gpsLat.toFixed(6)}, ${application.gpsLng.toFixed(6)}`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">PDF Copy</dt>
                    <dd className="mt-1 text-sm text-gray-700">
                      {application.pdfUrl ? (
                        <OnboardingPdfLink refStr={application.pdfUrl} />
                      ) : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Application Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <User size={18} /> Applicant Information
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{application.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <Phone size={14} className="text-gray-400" /> {application.mobile}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <Mail size={14} className="text-gray-400" /> {application.email}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Facebook</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1 break-all">
                  <Facebook size={14} className="shrink-0 text-gray-400" />
                  {fbUrl ? (
                    <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {application.facebookLink}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Store Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{application.storeName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Operating</dt>
                <dd className="mt-1 text-sm text-gray-700">{operating}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" /> {application.address}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Province</dt>
                <dd className="mt-1 text-sm text-gray-700">{application.province ?? '—'}</dd>
              </div>
              <div>
                {/* Derived from the province. Falls back to a live derivation so
                    rows filed before migration 021 still show something. */}
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</dt>
                <dd className="mt-1 text-sm text-gray-700">
                  {application.location ?? resolveLocation(application.province) ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Latitude</dt>
                <dd className="mt-1 text-sm text-gray-700 font-mono">{application.lat}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Longitude</dt>
                <dd className="mt-1 text-sm text-gray-700 font-mono">{application.lng}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Referral Info */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Building2 size={18} /> Referral & Assignment
            </h2>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Referral Code</dt>
                <dd className="mt-1 text-sm font-mono font-medium text-gray-900">{application.referralCode}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Referral Type</dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      application.referralType === 'distributor'
                        ? 'info'
                        : application.referralType === 'sub_partner_distributor'
                          ? 'success'
                          : 'orange'
                    }
                    size="sm"
                  >
                    {application.referralType === 'distributor'
                      ? 'Distributor'
                      : application.referralType === 'sub_partner_distributor'
                        ? 'Sub-Partner Distributor'
                        : 'ZAPP Internal'}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Distributor</dt>
                <dd className="mt-1 text-sm text-gray-700">{distributor?.name ?? 'N/A (Direct)'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Area Supervisor</dt>
                <dd className="mt-1 text-sm text-gray-700">{areaSupervisor?.name ?? 'Not Assigned'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Plant</dt>
                <dd className="mt-1 text-sm text-gray-700">{plant?.name ?? '-'} ({plant?.code ?? '-'})</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</dt>
                <dd className="mt-1 text-sm text-gray-700">
                  {new Date(application.submittedAt).toLocaleString()}
                </dd>
              </div>
              {application.reviewedAt && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Reviewed At</dt>
                  <dd className="mt-1 text-sm text-gray-700">
                    {new Date(application.reviewedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* New Application Monitoring — the department-owned evaluation fields.
          Role decides which are editable; the rest render read-only. */}
      <MonitoringFieldsCard application={application} />

      {/* The generated login: username, password state, account status, privacy
          acceptance + Reset Password. Renders itself away when the application
          minted no login, or the role may not see credentials. Sits above
          Documents because verifying those is what activates this account. */}
      <LoginCredentialsCard application={application} />

      {/* Documents + per-document verification. Adding the Selfie and the
          verify/reject actions moved this into its own component — the four
          tiles each need their own useStorageUrl hook. */}
      <DocumentsSection application={application} />

      {/* Reviewer Notes (read-only when already reviewed) */}
      {application.status !== 'pending' && application.notes && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Reviewer Notes</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{application.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Transaction History (Audit Trail) — read-only by design: the module
          requires that no record may be modified or deleted, so there is no
          edit affordance here and nothing writes to auditLog except the store
          actions themselves. Newest first. */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ScrollText size={18} /> Transaction History
            </h2>
            <span className="text-xs text-gray-500">Read-only</span>
          </div>
        </CardHeader>
        <CardContent>
          {application.auditLog.length === 0 ? (
            <p className="text-sm text-gray-500">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-2xl text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Date &amp; Time</th>
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Dept.</th>
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Action</th>
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Field</th>
                    <th className="pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-500">Previous</th>
                    <th className="pb-2 text-xs font-medium uppercase tracking-wider text-gray-500">New</th>
                  </tr>
                </thead>
                <tbody>
                  {[...application.auditLog].reverse().map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 last:border-0 align-top">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-gray-500">
                        {new Date(entry.performedAt).toLocaleString()}
                      </td>
                      {/* Older entries predate performedByName — fall back to the id. */}
                      <td className="py-2 pr-4 text-gray-900">{entry.performedByName ?? entry.performedBy}</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {(entry.role && ROLE_LABELS[entry.role]) ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge
                          variant={
                            entry.action === 'approved' ? 'success'
                            : entry.action === 'declined' ? 'danger'
                            : 'info'
                          }
                        >
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{entry.fieldModified ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-500 break-all">{entry.previousValue ?? '—'}</td>
                      <td className="py-2 text-gray-900 break-all">{entry.newValue ?? entry.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* One-time credential reveal. Deliberately NOT closable by backdrop —
          the password exists nowhere else, so a stray click must not lose it. */}
      <Modal
        open={!!credentials}
        onClose={() => setCredentials(null)}
        title="Franchisee login created"
        size="md"
      >
        {credentials && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                <KeyRound size={14} /> Ibigay ito sa franchisee
              </div>
              <div className="mt-3 space-y-1.5 font-mono text-sm">
                <div>
                  <span className="text-gray-500">Username:</span>{' '}
                  <span className="font-semibold">{credentials.username}</span>
                </div>
                <div>
                  <span className="text-gray-500">Temporary Password:</span>{' '}
                  <span className="font-semibold">{credentials.tempPassword}</span>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-800">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <strong>Ngayon lang ito makikita.</strong>&nbsp;Naka-encrypt ang password sa
                database at hindi na mababasa muli. Kung mawala, kailangan ng bagong
                password (reset) — hindi ito maibabalik.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Sa unang login niya, hihingin ang Government ID, Proof of Billing, Selfie at
              Data Privacy bago siya makapasok sa ERP.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                iconLeft={copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `ZAPP Donuts login\nUsername: ${credentials.username}\nTemporary Password: ${credentials.tempPassword}`,
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
              <Button variant="primary" onClick={() => setCredentials(null)}>
                Nakopya ko na
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Dialog (notes textarea inline) */}
      <Modal
        open={showApprove}
        onClose={() => !actionLoading && setShowApprove(false)}
        title={isOnboarding ? 'Verify & Activate Partner' : 'Approve Application'}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowApprove(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={<CheckCircle2 size={16} />}
              onClick={() => handleAction('approved')}
              loading={actionLoading}
            >
              {isOnboarding ? 'Verify & Activate' : 'Approve'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {isOnboarding ? (
              <>
                Verify and activate{' '}
                <span className="font-semibold text-gray-900">{application.fullName}</span>? This
                creates their partner login profile + store account so they gain access.
              </>
            ) : (
              <>
                Approve the application from{' '}
                <span className="font-semibold text-gray-900">{application.fullName}</span>? This
                will create a new franchise store account.
              </>
            )}
          </p>
          <div>
            <label
              htmlFor="approve-notes"
              className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5"
            >
              Reviewer Notes (optional)
            </label>
            <textarea
              id="approve-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note for the audit log..."
              rows={3}
              disabled={actionLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange disabled:bg-gray-50"
            />
          </div>
        </div>
      </Modal>

      {/* Decline Dialog (notes textarea inline) */}
      <Modal
        open={showDecline}
        onClose={() => !actionLoading && setShowDecline(false)}
        title={isOnboarding ? 'Reject Application' : 'Decline Application'}
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDecline(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              iconLeft={<XCircle size={16} />}
              onClick={() => handleAction('declined')}
              loading={actionLoading}
            >
              {isOnboarding ? 'Reject' : 'Decline'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            {isOnboarding ? 'Reject' : 'Decline'} the application from{' '}
            <span className="font-semibold text-gray-900">{application.fullName}</span>? This
            action cannot be undone.
          </p>
          <div>
            <label
              htmlFor="decline-notes"
              className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5"
            >
              Reason / Reviewer Notes (optional)
            </label>
            <textarea
              id="decline-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain why this application is declined..."
              rows={3}
              disabled={actionLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange disabled:bg-gray-50"
            />
          </div>
        </div>
      </Modal>

      {/* Request Additional Info Dialog (onboarding only) */}
      <Modal
        open={showRequestInfo}
        onClose={() => !actionLoading && setShowRequestInfo(false)}
        title="Request Additional Information"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRequestInfo(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={<Clock size={16} />}
              onClick={() => handleAction('needs_more_info')}
              loading={actionLoading}
            >
              Request Info
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Ask{' '}
            <span className="font-semibold text-gray-900">{application.fullName}</span>{' '}
            for more information. The application stays open and the applicant will see this
            note on their status screen.
          </p>
          <div>
            <label htmlFor="req-info-notes" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              What's needed?
            </label>
            <textarea
              id="req-info-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please re-upload a clearer photo of your government ID..."
              rows={3}
              disabled={actionLoading}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-zapp-orange/30 focus:border-zapp-orange disabled:bg-gray-50"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
