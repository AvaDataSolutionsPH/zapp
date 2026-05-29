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

  const isPending = application.status === 'pending';

  const handleAction = async (action: 'approved' | 'declined') => {
    setActionLoading(true);
    try {
      await reviewApplication(
        application.id,
        action,
        currentUser?.id ?? 'system',
        notes || undefined,
      );
      addToast(
        action === 'approved' ? 'success' : 'info',
        action === 'approved'
          ? `Application from ${application.fullName} approved — store created.`
          : `Application from ${application.fullName} declined.`,
      );
      setShowApprove(false);
      setShowDecline(false);
    } catch {
      addToast(
        'error',
        `Failed to ${action === 'approved' ? 'approve' : 'decline'} application. Please try again.`,
      );
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
        {isPending && (
          <div className="flex gap-2">
            <Button
              variant="danger"
              iconLeft={<XCircle size={16} />}
              onClick={() => setShowDecline(true)}
            >
              Decline
            </Button>
            <Button
              variant="primary"
              iconLeft={<CheckCircle2 size={16} />}
              onClick={() => setShowApprove(true)}
            >
              Approve
            </Button>
          </div>
        )}
      </div>

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
                  <Badge variant={application.referralType === 'distributor' ? 'info' : 'orange'} size="sm">
                    {application.referralType === 'distributor' ? 'Distributor' : 'ZAPP Internal'}
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
      {!isPending && application.notes && (
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
        title="Approve Application"
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
              Approve
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Approve the application from{' '}
            <span className="font-semibold text-gray-900">{application.fullName}</span>? This
            will create a new franchise store account.
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
        title="Decline Application"
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
              Decline
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Decline the application from{' '}
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
    </div>
  );
}
