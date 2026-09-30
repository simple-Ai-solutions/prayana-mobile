import React from 'react';
import { ViewStyle } from 'react-native';
import { Badge } from './Badge';
import { BookedViaLike } from './bookingDisplay';

interface PartnerPointBadgeProps {
  /** The booking's `bookedVia` block. Renders nothing unless channel === 'reseller'. */
  bookedVia?: BookedViaLike | null;
  label?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

/** Small "Booked via Partner Point" pill for bookings a reseller shop sold. */
export function PartnerPointBadge({
  bookedVia,
  label = 'Booked via Partner Point',
  size = 'sm',
  style,
}: PartnerPointBadgeProps) {
  if (bookedVia?.channel !== 'reseller') return null;
  return <Badge label={label} variant="info" size={size} style={style} />;
}
