// Isha's Ink colours, as on the website: near-black for actions and picks
// (white in dark mode), warm greys for the rest, and the logo's flame only as
// the dot on the best months to go.
export function inkColors(isDark: boolean) {
  return {
    ink: isDark ? '#FAFAF9' : '#0C0A09',
    onInk: isDark ? '#0C0A09' : '#FFFFFF',
    text: isDark ? '#FAFAF9' : '#1C1917',
    label: isDark ? '#D6D3D1' : '#292524',
    muted: isDark ? '#A8A29E' : '#57534E',
    surface: isDark ? '#1C1917' : '#FFFFFF',
    border: isDark ? '#292524' : '#E7E5E4',
    track: isDark ? '#292524' : '#F5F5F4',
    optionBorder: isDark ? '#44403C' : '#E7E5E4',
    input: isDark ? '#0C0A09' : '#FFFFFF',
    inputBorder: isDark ? '#44403C' : '#D6D3D1',
    best: isDark ? '#FB923C' : '#EA580C',
  };
}
