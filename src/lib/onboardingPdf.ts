// ============================================================
// ZAPP Donuts ERP - Onboarding PDF copy (Partner Onboarding Phase 2)
// ============================================================
//
// Generates a system-generated PDF copy of a self-service onboarding
// application. Used two ways at submit time:
//   1. uploaded to zapp-private as a durable record (persisted as pdfUrl), and
//   2. offered to the applicant as a download on the success screen.
//
// jsPDF is DYNAMICALLY imported so its ~350KB bundle code-splits and is only
// fetched the first time an application is actually submitted (same pattern as
// exceljs in billingStatementExcel.ts).

import type { SubmissionMetadata } from './submissionMetadata';

export interface OnboardingPdfData {
  applicationNumber: string;
  submittedAt: string; // ISO
  fullName: string;
  mobile: string;
  email: string;
  storeName: string;
  businessAddress: string;
  residentialAddress: string;
  facebookLink?: string;
  operatingHours: string;
  referralCode: string;
  referralType: string;
  lat: number;
  lng: number;
  agreementVersion: string;
  acceptedConsignmentAt?: string;
  acceptedPrivacyAt?: string;
  acceptedTermsAt?: string;
  certifiedAt?: string;
  idScannedName?: string;
  idNumber?: string;
  metadata: SubmissionMetadata;
}

const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

export async function buildOnboardingPdfBlob(data: OnboardingPdfData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const M = 48; // page margin
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const contentW = W - M * 2;
  let y = M;

  const ensure = (needed: number) => {
    if (y + needed > H - M) {
      doc.addPage();
      y = M;
    }
  };

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('ZAPP DONUTS', M, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text('Partner Onboarding Application', M, y);
  y += 12;
  doc.setDrawColor(230, 230, 230);
  doc.line(M, y, W - M, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(`Application No.: ${data.applicationNumber}`, M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Submitted: ${fmt(data.submittedAt)}`, M, y + 14);
  y += 36;

  // ── Layout helpers ──────────────────────────────────────────────────
  const section = (title: string) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(210, 90, 20);
    doc.text(title.toUpperCase(), M, y);
    y += 6;
    doc.setDrawColor(240, 240, 240);
    doc.line(M, y, W - M, y);
    y += 14;
  };

  const row = (label: string, value: string) => {
    const lines = doc.splitTextToSize(value || '—', contentW - 150);
    ensure(Math.max(16, lines.length * 12));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(label, M, y);
    doc.setTextColor(30, 30, 30);
    doc.text(lines, M + 150, y);
    y += Math.max(16, lines.length * 12);
  };

  // ── Sections ────────────────────────────────────────────────────────
  section('Applicant');
  row('Full Name', data.fullName);
  row('Mobile', data.mobile);
  row('Email', data.email);

  section('Business');
  row('Store Name', data.storeName);
  row('Business Address', data.businessAddress);
  row('Residential Address', data.residentialAddress);
  row('Operating Hours', data.operatingHours);
  if (data.facebookLink) row('Facebook', data.facebookLink);
  row('Store Pin', `${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`);

  if (data.idScannedName || data.idNumber) {
    section('Government ID (scanned)');
    row('Name on ID', data.idScannedName ?? '—');
    row('ID Number', data.idNumber ?? '—');
  }

  section('Channel');
  row('Referral Code', data.referralCode);
  row('Channel Type', data.referralType.replace(/_/g, ' '));

  section(`Accepted Agreements (v${data.agreementVersion})`);
  row('Consignment Agreement', fmt(data.acceptedConsignmentAt));
  row('Privacy Notice', fmt(data.acceptedPrivacyAt));
  row('Website Terms of Use', fmt(data.acceptedTermsAt));
  row('Certification', fmt(data.certifiedAt));

  section('Submission Metadata');
  row('IP Address', data.metadata.submittedIp ?? '—');
  row('Device', data.metadata.deviceInfo ?? '—');
  row(
    'GPS (device)',
    data.metadata.gpsLat != null && data.metadata.gpsLng != null
      ? `${data.metadata.gpsLat.toFixed(6)}, ${data.metadata.gpsLng.toFixed(6)}`
      : '—',
  );
  row('User Agent', data.metadata.userAgent ?? '—');

  // ── Footer ──────────────────────────────────────────────────────────
  ensure(40);
  y += 10;
  doc.setDrawColor(240, 240, 240);
  doc.line(M, y, W - M, y);
  y += 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'System-generated copy of the onboarding application submitted to ZAPP Donuts. All values were entered by the applicant.',
    M,
    y,
    { maxWidth: contentW },
  );

  return doc.output('blob');
}
