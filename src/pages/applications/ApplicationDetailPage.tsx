import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  Building2,
  FileImage,
  IdCard,
  Receipt,
  CheckCircle2,
  XCircle,
  ScrollText,
  Clock,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
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
import { useStorageUrl } from '@/lib/useStorageUrl';

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

  // Resolve any Supabase storage refs into renderable URLs. Public
  // bucket refs resolve to a permanent public URL; private bucket
  // refs resolve to a fresh signed URL each render. Legacy mock
  // URLs (e.g. https://placehold.co/...) pass through unchanged.
  const storePhotoUrl = useStorageUrl(application?.storePhotoUrl);
  const govIdUrl = useStorageUrl(application?.govIdUrl);
  const proofOfBillingUrl = useStorageUrl(application?.proofOfBillingUrl);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [notes, setNotes] = useState(application?.notes ?? '');
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

  const plant = plants.find((p) => p.id === application.assignedPlantId);
  const distributor = application.assignedDistributorId
    ? distributors.find((d) => d.id === application.assignedDistributorId)
    : null;
  const areaSupervisor = application.assignedAreaSupervisorId
    ? areaSupervisors.find((a) => a.id === application.assignedAreaSupervisorId)
    : null;

  // Self-service Partner Onboarding applications (marked by an applicationNumber)
  // get "Verify & Activate" (creates the partner login + store) / "Request Info"
  // / "Reject". Legacy /apply applications keep plain Approve / Decline.
  const isOnboarding = !!application.applicationNumber;
  const canAct =
    application.status === 'pending' || application.status === 'needs_more_info';

  const handleAction = async (action: 'approved' | 'declined' | 'needs_more_info') => {
    setActionLoading(true);
    try {
      await reviewApplication(
        application.id,
        action,
        currentUser?.id ?? 'system',
        notes || undefined,
      );
      const msg =
        action === 'approved'
          ? isOnboarding
            ? `${application.fullName} verified — partner login + store created.`
            : `Application from ${application.fullName} approved — store created.`
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

  const openPreview = (url: string, title: string) => {
    setPreviewImage(url);
    setPreviewTitle(title);
  };

  const docPlaceholder = 'https://placehold.co/600x400/f97316/white?text=';

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
            >
              {isOnboarding ? 'Verify & Activate' : 'Approve'}
            </Button>
          </div>
        )}
      </div>

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
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Operating Hours</dt>
                <dd className="mt-1 text-sm text-gray-700">{application.operatingHours ?? '—'}</dd>
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
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Facebook Link</dt>
                <dd className="mt-1 text-sm text-gray-700 break-all">
                  {application.facebookLink ? (
                    <a href={application.facebookLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      {application.facebookLink}
                    </a>
                  ) : '—'}
                </dd>
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
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Store Name</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">{application.storeName}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</dt>
                <dd className="mt-1 text-sm text-gray-700 flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" /> {application.address}
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

      {/* Documents */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Store Photo', url: storePhotoUrl, icon: <FileImage size={20} /> },
              { label: 'Government ID', url: govIdUrl, icon: <IdCard size={20} /> },
              { label: 'Proof of Billing', url: proofOfBillingUrl, icon: <Receipt size={20} /> },
            ].map((doc) => (
              <button
                key={doc.label}
                onClick={() => openPreview(doc.url || `${docPlaceholder}${encodeURIComponent(doc.label)}`, doc.label)}
                className="group relative rounded-xl border border-gray-200 bg-gray-50 overflow-hidden aspect-video flex items-center justify-center hover:border-zapp-orange transition-colors cursor-pointer"
              >
                {doc.url ? (
                  <img
                    src={doc.url}
                    alt={doc.label}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `${docPlaceholder}${encodeURIComponent(doc.label)}`;
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    {doc.icon}
                    <span className="text-xs">{doc.label}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium bg-black/50 px-3 py-1 rounded-full transition-opacity">
                    Click to view
                  </span>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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

      {/* Audit Timeline */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Audit Timeline</h2>
        </CardHeader>
        <CardContent>
          {application.auditLog.length === 0 ? (
            <p className="text-sm text-gray-500">No audit entries yet.</p>
          ) : (
            <div className="relative pl-6 space-y-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-200" />
              {application.auditLog.map((entry) => {
                const isApproved = entry.action === 'approved';
                const isDeclined = entry.action === 'declined';
                return (
                  <div key={entry.id} className="relative">
                    <div
                      className={`absolute -left-4 top-0.5 w-4 h-4 rounded-full border-2 border-white ${
                        isApproved
                          ? 'bg-green-500'
                          : isDeclined
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {entry.action}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.performedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{entry.details}</p>
                      <p className="text-xs text-gray-400 mt-0.5">By: {entry.performedBy}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Preview Modal */}
      <Modal
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title={previewTitle}
        size="lg"
      >
        {previewImage && (
          <img
            src={previewImage}
            alt={previewTitle}
            className="w-full rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `${docPlaceholder}${encodeURIComponent(previewTitle)}`;
            }}
          />
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
