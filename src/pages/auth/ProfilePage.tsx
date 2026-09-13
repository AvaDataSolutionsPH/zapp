// ============================================================
// ZAPP Donuts ERP — My Profile
// ============================================================
//
// The user menu had a "Profile" item that navigated to /settings. That was
// wrong twice over — Settings is not a profile, and once /settings became
// owner-only every other role clicking it was bounced out. The item was removed
// rather than left broken; this is the page it should have pointed at.
//
// It exists for a concrete reason, not for symmetry: after migration 045
// scoped `referral_codes`, a Partner Distributor has nowhere else in the app to
// SEE THEIR OWN CODE. The Distributors page is not in their sidebar, and 045
// (correctly) stops them reading anyone else's. Without this page they cannot
// read out the one string their recruits need.
//
// Read-only on purpose. Name, role, plants and scope are decided by HQ; the two
// things a person may change about their own account are their password (here)
// and — owner only, from the Distributor screen — their login email.

import { useState } from 'react';
import { KeyRound, Mail, Shield, Factory, Hash, Clock, Copy, CheckCircle2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import ChangePasswordModal from '@/components/auth/ChangePasswordModal';
import { useStore } from '@/store/useStore';
import { plantsServed } from '@/lib/phRegions';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner (Admin)',
  operations_manager: 'Operations Manager',
  forecaster: 'Forecaster',
  plant_manager: 'Plant Manager',
  billing_user: 'Billing User',
  partner_distributor: 'Partner Distributor',
  sub_partner_distributor: 'Sub-Partner Distributor',
  franchisee_distributor: 'Franchisee (Distributor)',
  franchisee_direct: 'Franchisee (Direct)',
  area_manager: 'Area Supervisor',
};

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <div className="mt-0.5 text-sm text-gray-900">{children}</div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { currentUser, plants, distributors, subPartnerDistributors, referralCodes } = useStore();
  const { addToast } = useToast();
  const [changing, setChanging] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentUser) return null;

  const plantNames = plantsServed({ plantId: currentUser.plantId ?? '', plantIds: currentUser.plantIds })
    .map((id) => plants.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  // A PD/SPD's channel code. 045 means the slice only ever holds codes this
  // account is entitled to, so no extra filtering is needed for safety — this
  // just picks the right one when several are visible (a PD also sees its
  // sub-partners').
  const myCode =
    referralCodes.find((r) => r.distributorId === currentUser.distributorId && !r.subPartnerDistributorId)?.code ??
    referralCodes.find((r) => r.subPartnerDistributorId === currentUser.subPartnerDistributorId)?.code;

  const company =
    distributors.find((d) => d.id === currentUser.distributorId)?.name ??
    subPartnerDistributors.find((s) => s.id === currentUser.subPartnerDistributorId)?.name;

  const copyCode = async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('error', 'Hindi na-copy — kopyahin nang manu-mano.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Ang detalye ng account mo. Ang pangalan, role at saklaw ay itinatakda ng Admin.
      </p>

      <Card className="mt-5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src={currentUser.avatar} alt={currentUser.name} className="h-11 w-11 rounded-full" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">{currentUser.name}</h2>
              <p className="text-xs text-gray-500">{ROLE_LABEL[currentUser.role] ?? currentUser.role}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-gray-100">
            <Row icon={<Mail size={16} />} label="Login Email">
              <span className="font-mono">{currentUser.email}</span>
              <p className="mt-0.5 text-xs text-gray-500">
                Ito ang ipinapasok mo sa /login. Ang Admin lang ang makakapagpalit nito.
              </p>
            </Row>

            <Row icon={<Shield size={16} />} label="Role">
              {ROLE_LABEL[currentUser.role] ?? currentUser.role}
            </Row>

            {company && (
              <Row icon={<Hash size={16} />} label="Kumpanya">{company}</Row>
            )}

            {plantNames.length > 0 && (
              <Row icon={<Factory size={16} />} label={plantNames.length > 1 ? 'Plants' : 'Plant'}>
                {plantNames.join(', ')}
              </Row>
            )}

            {myCode && (
              <Row icon={<Hash size={16} />} label="Referral Code">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-zapp-cream px-2 py-1 font-mono font-semibold text-zapp-brown">
                    {myCode}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    onClick={() => void copyCode()}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Ito ang ilalagay ng mga franchisee mo sa <strong>/apply</strong> para mapunta sa iyo
                  ang application nila.
                </p>
              </Row>
            )}

            {currentUser.lastLoginAt && (
              <Row icon={<Clock size={16} />} label="Huling Login">
                {new Date(currentUser.lastLoginAt).toLocaleString('en-PH')}
              </Row>
            )}

            <Row icon={<KeyRound size={16} />} label="Password">
              {currentUser.passwordChangedAt ? (
                <>Napalitan noong {new Date(currentUser.passwordChangedAt).toLocaleDateString('en-PH')}</>
              ) : (
                <span className="text-amber-700">
                  Temporary pa — ang password na ibinigay sa iyo. Palitan mo ito.
                </span>
              )}
              <div className="mt-2">
                <Button variant="primary" size="sm" iconLeft={<KeyRound size={14} />} onClick={() => setChanging(true)}>
                  Palitan ang Password
                </Button>
              </div>
            </Row>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordModal open={changing} onClose={() => setChanging(false)} />
    </div>
  );
}
