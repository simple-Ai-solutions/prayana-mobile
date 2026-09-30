import React from 'react';
import { Badge } from './Badge';
import { ViewStyle } from 'react-native';
import { humanizeEnum } from './bookingDisplay';

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refunded'
  // eSIM order statuses (server/models/EsimOrder.js) — without these the badge
  // fell back to printing the raw enum, e.g. "pending_payment".
  | 'pending_payment'
  | 'pending_kyc'
  | 'pending_validation'
  | 'processing'
  | 'active'
  | 'failed'
  // Activity bookings (server/models/Booking.js)
  | 'pending_capture'
  | 'payment_pending'
  | 'auto_refunded'
  // Holiday-package bookings (server/models/PackageBooking.js)
  | 'partially_paid'
  | 'modifications_requested'
  | 'in_progress'
  // Payment statuses, when a screen badges payment.status directly
  | 'unpaid'
  | 'paid'
  | 'refund_pending'
  | 'partially_refunded';

const statusConfig: Record<BookingStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  no_show: { label: 'No Show', variant: 'error' },
  refunded: { label: 'Refunded', variant: 'default' },
  pending_payment: { label: 'Payment Pending', variant: 'warning' },
  pending_kyc: { label: 'KYC Pending', variant: 'warning' },
  pending_validation: { label: 'Validating', variant: 'warning' },
  processing: { label: 'Processing', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  pending_capture: { label: 'Processing', variant: 'info' },
  payment_pending: { label: 'Payment Pending', variant: 'warning' },
  auto_refunded: { label: 'Refunded', variant: 'default' },
  partially_paid: { label: 'Partially Paid', variant: 'warning' },
  modifications_requested: { label: 'Changes Requested', variant: 'warning' },
  in_progress: { label: 'In Progress', variant: 'info' },
  unpaid: { label: 'Unpaid', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  refund_pending: { label: 'Refund Pending', variant: 'warning' },
  partially_refunded: { label: 'Partially Refunded', variant: 'info' },
};

interface StatusBadgeProps {
  status: BookingStatus | string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  // Unknown / future statuses get a readable label, never a raw enum or blank.
  const config = statusConfig[status as BookingStatus] || {
    label: humanizeEnum(status) || 'Unknown',
    variant: 'default' as const,
  };
  return <Badge label={config.label} variant={config.variant} style={style} />;
}
