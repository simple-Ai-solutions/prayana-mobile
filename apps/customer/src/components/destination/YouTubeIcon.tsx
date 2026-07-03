// Official YouTube logo mark (rounded red rect + white play triangle).
// Used in the destination "Videos" tab to match the PWA exactly.
import React from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string; // tint for the rounded-rect body
}

export const YouTubeIcon: React.FC<Props> = ({ size = 18, color = '#FF0000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Rounded rectangle body */}
    <Path
      d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8z"
      fill={color}
    />
    {/* White play triangle */}
    <Polygon points="9.55 15.57 15.82 12 9.55 8.43" fill="#FFFFFF" />
  </Svg>
);

export default YouTubeIcon;
