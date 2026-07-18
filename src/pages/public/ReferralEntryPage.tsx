// ============================================================
// ZAPP Donuts ERP - Referral Entry Page
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Hash,
  Handshake,
  Zap,
  Building2,
  User,
  MapPin,
  Loader2,
} from 'lucide-react';
import { Button, Card, CardContent, Input, Badge } from '@/components/ui';
import { referralService } from '@/services/api';
import type { ReferralCode, Distributor, AreaSupervisor, Plant } from '@/types';

// ── Types ─────────────────────────────────────────────────────

interface ReferralInfo {
  referral: ReferralCode;
  distributor?: Distributor;
  areaSupervisor?: AreaSupervisor;
  plant?: Plant;
}

// ── Referral Entry Page ───────────────────────────────────────

export default function ReferralEntryPage() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code: string }>();

  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Auto-validate code from URL on mount
  useEffect(() => {
    if (urlCode) {
      validateCode(urlCode);
    }
  }, [urlCode]);

  const validateCode = async (code: string) => {
    if (!code.trim()) {
      setError('Please enter a referral code.');
      return;
    }

    setLoading(true);
    setError('');
    setReferralInfo(null);

    try {
      const result = await referralService.validate(code.trim());
      if (result.valid && result.referral) {
        setReferralInfo({
          referral: result.referral,
          distributor: result.distributor,
          areaSupervisor: result.areaSupervisor,
          plant: result.plant,
        });
      } else {
        setError(
          'This referral code is invalid or no longer active. Please check the code and try again.',
        );
      }
    } catch {
      setError('Unable to validate referral code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToApplication = () => {
    const code = referralInfo?.referral.code ?? urlCode ?? manualCode;
    navigate(`/apply?ref=${encodeURIComponent(code)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zapp-cream/50 to-white">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-zapp-orange transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Home
            </button>
          </div>
          <div className="flex items-center gap-3">
            <img src="/Logo.jpg" alt="ZAPP Donuts" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Referral Verification</h1>
              <p className="text-sm text-gray-500">Verify your referral code to start your application.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Loading state while auto-validating URL code */}
        {loading && !showManualInput && (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center py-12 text-center">
                <Loader2 size={40} className="animate-spin text-zapp-orange mb-4" />
                <h2 className="text-lg font-bold text-gray-900">Validating Referral Code...</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Checking code: <span className="font-mono font-medium">{urlCode}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success state */}
        {referralInfo && !loading && (
          <Card>
            <CardContent>
              <div className="space-y-6">
                {/* Success banner */}
                <div className="flex flex-col items-center text-center py-4">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Referral Code Verified!</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Your referral code is valid. Review the details below and proceed to the application.
                  </p>
                </div>

                {/* Referral details */}
                <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Hash size={12} />
                        Referral Code
                      </div>
                      <p className="mt-1 font-mono text-lg font-bold text-gray-900">
                        {referralInfo.referral.code}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Franchise Type
                      </div>
                      <p className="mt-1">
                        <Badge
                          variant={referralInfo.referral.type === 'distributor' ? 'orange' : 'info'}
                          size="md"
                        >
                          {referralInfo.referral.type === 'distributor' ? (
                            <span className="flex items-center gap-1">
                              <Handshake size={12} />
                              Distributor-Linked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Zap size={12} />
                              Direct to ZAPP
                            </span>
                          )}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {referralInfo.distributor && (
                    <div className="rounded-lg border border-green-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Handshake size={12} />
                        Assigned Distributor
                      </div>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        {referralInfo.distributor.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Contact: {referralInfo.distributor.contactPerson} ({referralInfo.distributor.phone})
                      </p>
                    </div>
                  )}

                  {referralInfo.areaSupervisor && (
                    <div className="rounded-lg border border-green-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <User size={12} />
                        Assigned Area Supervisor
                      </div>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        {referralInfo.areaSupervisor.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        Areas: {referralInfo.areaSupervisor.assignedAreas.join(', ')}
                      </p>
                    </div>
                  )}

                  {referralInfo.plant && (
                    <div className="rounded-lg border border-green-200 bg-white p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Building2 size={12} />
                        Assigned Plant
                      </div>
                      <p className="mt-1 text-sm font-bold text-gray-900">
                        {referralInfo.plant.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        <MapPin size={10} className="inline" /> {referralInfo.plant.location} --{' '}
                        {referralInfo.plant.region}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    variant="primary"
                    size="lg"
                    iconRight={<ArrowRight size={18} />}
                    onClick={handleProceedToApplication}
                    className="font-bold"
                  >
                    Proceed to Application
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => navigate('/')}>
                    Back to Home
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && !loading && !referralInfo && (
          <Card>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-col items-center text-center py-4">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                    <AlertCircle size={28} className="text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Invalid Referral Code</h2>
                  <p className="mt-1 text-sm text-gray-500 max-w-sm">{error}</p>
                  {urlCode && (
                    <p className="mt-2 font-mono text-sm text-gray-400">
                      Code tried: {urlCode}
                    </p>
                  )}
                </div>

                {/* Manual entry option */}
                {!showManualInput ? (
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setShowManualInput(true);
                        setError('');
                      }}
                    >
                      Enter Code Manually
                    </Button>
                    <Button variant="ghost" onClick={() => navigate('/')}>
                      Back to Home
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual input form */}
        {(showManualInput || (!urlCode && !loading && !referralInfo)) && (
          <Card className={urlCode && !error ? 'mt-6' : ''}>
            <CardContent>
              <div className="space-y-6">
                {!urlCode && (
                  <div className="text-center py-2">
                    <h2 className="text-xl font-bold text-gray-900">Enter Your Referral Code</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Enter the referral code you received from a ZAPP representative or distributor.
                    </p>
                  </div>
                )}

                {showManualInput && urlCode && (
                  <div className="text-center py-2">
                    <h2 className="text-lg font-bold text-gray-900">Try a Different Code</h2>
                  </div>
                )}

                <div className="flex gap-3">
                  <Input
                    placeholder="Enter referral code (e.g. BICOL-MARCO)"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value);
                      setError('');
                    }}
                    iconLeft={<Hash size={16} />}
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    onClick={() => validateCode(manualCode)}
                    loading={loading}
                    disabled={!manualCode.trim()}
                  >
                    Validate
                  </Button>
                </div>

                {error && showManualInput && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <strong>Don't have a referral code?</strong> Contact a ZAPP Donuts distributor in your
                    area or visit our{' '}
                    <button
                      onClick={() => navigate('/')}
                      className="text-zapp-orange underline hover:no-underline"
                    >
                      homepage
                    </button>{' '}
                    to learn more about franchise opportunities. You can also reach us at{' '}
                    <span className="font-medium text-gray-700">franchising@zappdonuts.com</span>.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
