import { Badge } from './Badge';

/* ------------------------------------------------------------------ */
/*  Status configuration maps                                          */
/* ------------------------------------------------------------------ */

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';

interface StatusConfig {
  label: string;
  variant: BadgeVariant;
}

const applicationStatuses: Record<string, StatusConfig> = {
  pending:        { label: 'Pending',        variant: 'warning' },
  approved:       { label: 'Approved',       variant: 'success' },
  declined:       { label: 'Declined',       variant: 'danger' },
  needs_more_info:{ label: 'Needs More Info', variant: 'info' },
};

const deliveryStatuses: Record<string, StatusConfig> = {
  scheduled:   { label: 'Scheduled',   variant: 'info' },
  in_transit:  { label: 'In Transit',  variant: 'warning' },
  delivered:   { label: 'Delivered',   variant: 'success' },
  reconciled:  { label: 'Reconciled',  variant: 'neutral' },
};

const paymentStatuses: Record<string, StatusConfig> = {
  submitted: { label: 'Submitted', variant: 'warning' },
  collected: { label: 'Collected', variant: 'info' },
  verified:  { label: 'Verified',  variant: 'success' },
  rejected:  { label: 'Rejected',  variant: 'danger' },
};

const billingStatuses: Record<string, StatusConfig> = {
  pending: { label: 'Pending', variant: 'warning' },
  issued:  { label: 'Issued',  variant: 'info' },
  paid:    { label: 'Paid',    variant: 'success' },
  overdue: { label: 'Overdue', variant: 'danger' },
};

const storeStatuses: Record<string, StatusConfig> = {
  active:   { label: 'Active',   variant: 'success' },
  inactive: { label: 'Inactive', variant: 'neutral' },
  pending:  { label: 'Pending',  variant: 'warning' },
  blocked:  { label: 'Blocked',  variant: 'danger' },
};

const inventoryReviewStatuses: Record<string, StatusConfig> = {
  pending_review:      { label: 'Pending Review',      variant: 'info' },
  needs_review:        { label: 'Needs Review',        variant: 'warning' },
  correction_required: { label: 'Correction Required', variant: 'danger' },
  approved:            { label: 'Approved',            variant: 'success' },
  // Legacy compatibility: prior data may carry these values
  pending:   { label: 'Pending',  variant: 'warning' },
  confirmed: { label: 'Approved', variant: 'success' },
};

const categoryMap: Record<string, Record<string, StatusConfig>> = {
  application: applicationStatuses,
  delivery: deliveryStatuses,
  payment: paymentStatuses,
  billing: billingStatuses,
  store: storeStatuses,
  inventory_review: inventoryReviewStatuses,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type StatusCategory = 'application' | 'delivery' | 'payment' | 'billing' | 'store' | 'inventory_review';

interface StatusBadgeProps {
  category: StatusCategory;
  status: string;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ category, status, dot = true, size = 'md', className }: StatusBadgeProps) {
  const config = categoryMap[category]?.[status];

  if (!config) {
    return (
      <Badge variant="neutral" size={size} dot={dot} className={className}>
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} size={size} dot={dot} className={className}>
      {config.label}
    </Badge>
  );
}
