import React from 'react';
import { Badge } from './Badge';
import { ViewStyle } from 'react-native';

type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'refunded';

const statusConfig: Record<BookingStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'info' },
  cancelled: { label: 'Cancelled', variant: 'error' },
  no_show: { label: 'No Show', variant: 'error' },
  refunded: { label: 'Refunded', variant: 'default' },
};

interface StatusBadgeProps {
  status: BookingStatus | string;
  style?: ViewStyle;
}

export function StatusBadge({ status, style }: StatusBadgeProps) {
  const config = statusConfig[status as BookingStatus] || { label: status, variant: 'default' as const };
  return <Badge label={config.label} variant={config.variant} style={style} />;
}
