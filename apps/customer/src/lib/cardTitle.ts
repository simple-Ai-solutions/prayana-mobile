// A listing title short enough for a card. Vendors write "Name — Region,
// Highlights…", which a two-line card cut off mid-word ("…Birthplace — Ma…").
// On cards we keep the part before the dash when it can stand alone; a short
// lead keeps its dash and the next phrase. The
// activity page still shows the full title.
const MIN_LEAD = 12;

export function cardTitle(title?: string | null): string {
  const t = String(title || '').trim();
  const m = t.match(/^(.+?)\s+([—–-])\s+(.+)$/);
  if (!m) return t;
  if (m[1].length >= MIN_LEAD) return m[1].trim();
  // Short lead: keep what follows the dash up to its first comma
  // ("Chikmagalur — Mullayanagiri, Hebbe Falls…" → "Chikmagalur — Mullayanagiri").
  return `${m[1].trim()} ${m[2]} ${m[3].split(',')[0].trim()}`;
}
