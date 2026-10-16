// The full itinerary opened inside the chat: a trip summary, then one card per
// day with a photo of its first sight, "DAY n" and the day's title on it. Each
// day has its morning / afternoon / evening stops (entry fees, hours, tips and
// meals), the route through them, and bookable tickets for its stops. Parsed
// from the markdown /itinerary/generate-markdown returns, as on the web.
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { makeAPICall } from '@prayana/shared-services';
import { openInApp } from '../../lib/openInApp';
import { useIsha, type IshaPalette } from './ishaTheme';
import { OutlineButton } from './ui';
import type { Place } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const SLOT_ICONS: Record<string, IconName> = { morning: 'partly-sunny-outline', afternoon: 'sunny-outline', evening: 'moon-outline' };

type Item = { meal?: boolean; name: string; desc?: string; tip?: string; fee?: string; timings?: string; where?: string };
type Slot = { name: string; items: Item[] };
type Day = { n: number; title: string; subtitle: string; highlights: Item[]; slots: Slot[] };
type Plan = { title: string; tagline: string; meta: Record<string, string>; days: Day[] };
type Ticket = { id: string; title: string; image?: string; rating?: number; reviews?: number; price?: number; currency?: string; url?: string };

/** "Monday: 8 AM – 6 PM • Tuesday: 8 AM – 6 PM …" → "8 AM – 6 PM" when every day is the same. */
function simplifyTimings(t: string) {
  if (!t) return '';
  const parts = t.split('•').map((p) => p.replace(/^\s*\w+day:\s*/i, '').trim()).filter(Boolean);
  if (parts.length > 1) return parts.every((p) => p === parts[0]) ? parts[0] : '';
  return parts[0] || '';
}
const known = (v: unknown) => (/^n\/?a$/i.test(String(v || '').trim()) ? '' : String(v || '').trim());

/** The itinerary markdown as { title, tagline, meta, days[] }, or null if it has no days. */
export function parseItinerary(md?: string | null): Plan | null {
  if (typeof md !== 'string' || !md.includes('## Day')) return null;
  const lines = md.split('\n');
  const title = (lines.find((l) => /^# /.test(l)) || '').replace(/^# /, '').trim();
  const tagline = (lines.find((l) => /^> /.test(l)) || '').replace(/^> /, '').trim();
  const meta: Record<string, string> = {};
  for (const l of lines) {
    const m = l.match(/^\*\*(Budget|Best Time|Duration):\*\*\s*(.+)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  const days: Day[] = [];
  let day: Day | null = null;
  let slot: Slot | null = null;
  let item: Item | null = null;
  let extras = false;
  for (const raw of lines) {
    const l = raw.trim();
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^## Day\s*(\d+)\s*[:\-–—]?\s*(.*)$/i))) {
      day = { n: Number(m[1]), title: m[2].trim(), subtitle: '', highlights: [], slots: [] };
      days.push(day);
      slot = item = null;
      extras = false;
      continue;
    }
    if (/^#{1,2} /.test(l)) {
      day = slot = item = null;
      continue;
    }
    if (!day) continue;
    if ((m = l.match(/^### (.+)$/))) {
      slot = { name: m[1].trim(), items: [] };
      day.slots.push(slot);
      item = null;
      extras = false;
      continue;
    }
    if (/^\*\*(Local Experiences|Highlights):\*\*$/i.test(l) || /^_Things to try:_$/i.test(l)) {
      extras = !/Highlights/i.test(l);
      item = null;
      continue;
    }
    if (!slot) {
      if (!day.subtitle && (m = l.match(/^\*([^*].*[^*])\*$/))) day.subtitle = m[1];
      else if ((m = l.match(/^-\s+(.+?)\s+[—–]\s+(.+)$/))) day.highlights.push({ name: m[1].replace(/\*\*/g, ''), desc: m[2] });
      continue;
    }
    if (extras) continue;
    if ((m = l.match(/^🍽\s*\*\*(.+?)\*\*\s*(?:@\s*(.+))?$/))) {
      item = { meal: true, name: m[1], where: (m[2] || '').trim(), desc: '' };
      slot.items.push(item);
      continue;
    }
    if ((m = l.match(/^\*\*(.+?)\*\*$/))) {
      item = { name: m[1], desc: '', tip: '', fee: '', timings: '' };
      slot.items.push(item);
      continue;
    }
    if (!item || !l || l === '---') continue;
    if ((m = l.match(/^Tip:\s*(.+)$/i))) item.tip = m[1];
    else if ((m = l.match(/^Entry Fee:\s*(.+)$/i))) item.fee = known(m[1]);
    else if ((m = l.match(/^Timings?:\s*(.+)$/i))) item.timings = known(simplifyTimings(m[1]));
    else if (!item.desc) item.desc = l;
  }
  for (const d of days) if (!d.slots.length && d.highlights.length) d.slots = [{ name: 'Highlights', items: d.highlights }];
  return days.length ? { title, tagline, meta, days } : null;
}

/** A day's sights in order (meals left out). */
const sights = (day: Day) => day.slots.flatMap((s) => s.items).filter((i) => !i.meal && i.name).map((i) => i.name);
const leadStop = (day: Day) => day.slots.flatMap((s) => s.items).find((i) => !i.meal)?.name || day.highlights[0]?.name || null;

function money(value?: number, currency?: string) {
  if (value == null) return '';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency || ''} ${Math.round(value)}`.trim();
  }
}

/** Google Maps directions through the day's stops (opens the Maps app). */
function routeUrl(day: Day, destination?: string | null) {
  const stops = sights(day).map((n) => `${n}, ${destination || ''}`.replace(/,\s*$/, ''));
  if (!stops.length) return null;
  const q = encodeURIComponent;
  if (stops.length === 1) return `https://www.google.com/maps/search/?api=1&query=${q(stops[0])}`;
  const route = stops.slice(0, 10);
  const waypoints = route.slice(1, -1).map(q).join('%7C');
  return `https://www.google.com/maps/dir/?api=1&origin=${q(route[0])}&destination=${q(route[route.length - 1])}${waypoints ? `&waypoints=${waypoints}` : ''}`;
}

function TicketRow({ ticket, t, compact = false, more = 0, onMore }: { ticket: Ticket; t: IshaPalette; compact?: boolean; more?: number; onMore?: () => void }) {
  return (
    <View style={[compact ? styles.ticketCompact : styles.ticket, { borderColor: t.border, backgroundColor: compact ? t.surfaceMuted : t.surface }]}>
      <View style={[compact ? styles.ticketThumbSm : styles.ticketThumb, { backgroundColor: t.sunken }]}>
        {!!ticket.image && <Image source={{ uri: ticket.image }} style={StyleSheet.absoluteFill} contentFit="cover" />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[compact ? styles.ticketTitleSm : styles.ticketTitle, { color: t.text }]} numberOfLines={2}>
          {ticket.title}
        </Text>
        <View style={styles.ticketMeta}>
          {!!ticket.rating && (
            <View style={styles.inline}>
              <Ionicons name="star" size={11} color={t.star} />
              <Text style={[styles.small, { color: t.muted }]}>
                {Number(ticket.rating).toFixed(1)}
                {ticket.reviews ? ` (${ticket.reviews})` : ''}
              </Text>
            </View>
          )}
          {ticket.price != null && <Text style={[styles.small, { color: t.text, fontWeight: '700' }]}>{money(ticket.price, ticket.currency)}</Text>}
          {more > 0 && (
            <Text onPress={onMore} style={[styles.small, { color: t.muted, textDecorationLine: 'underline' }]}>
              +{more} more
            </Text>
          )}
        </View>
      </View>
      {!!ticket.url && (
        <Pressable
          onPress={() => openInApp(ticket.url as string)}
          accessibilityRole="link"
          accessibilityLabel={`Book ${ticket.title}`}
          hitSlop={6}
          style={[styles.book, { backgroundColor: t.ink }]}
        >
          <Text style={[styles.bookText, { color: t.onInk }]}>Book</Text>
          <Ionicons name="open-outline" size={12} color={t.onInk} />
        </Pressable>
      )}
    </View>
  );
}

function DayCard({ day, photo, destination, tickets }: { day: Day; photo?: string; destination?: string | null; tickets?: Record<string, Ticket[]> }) {
  const t = useIsha();
  const [tab, setTab] = useState<'plan' | 'route' | 'tickets'>('plan');
  const route = routeUrl(day, destination);
  const ticketCount = Object.values(tickets || {}).reduce((n, l) => n + l.length, 0);
  const tabs: Array<{ id: 'plan' | 'route' | 'tickets'; label: string; icon: IconName }> = [
    { id: 'plan', label: 'Plan', icon: 'list-outline' },
    ...(route ? [{ id: 'route' as const, label: 'Route', icon: 'map-outline' as IconName }] : []),
    ...(ticketCount ? [{ id: 'tickets' as const, label: `Tickets (${ticketCount})`, icon: 'ticket-outline' as IconName }] : []),
  ];

  return (
    <View style={[styles.day, { borderColor: t.border, backgroundColor: t.surface }]}>
      <View style={styles.dayCover}>
        {photo ? (
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={leadStop(day) || day.title} />
        ) : (
          <LinearGradient colors={['#57534e', '#1c1917']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.75)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>DAY {day.n}</Text>
        </View>
        <View style={styles.dayCoverText}>
          <Text style={styles.dayTitle} numberOfLines={2}>
            {day.title}
          </Text>
          {!!day.subtitle && (
            <Text style={styles.daySub} numberOfLines={1}>
              {day.subtitle}
            </Text>
          )}
        </View>
      </View>

      {tabs.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { borderBottomColor: t.divider }]} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
          {tabs.map((x) => {
            const on = tab === x.id;
            return (
              <Pressable
                key={x.id}
                onPress={() => setTab(x.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.tab, { borderBottomColor: on ? t.ink : 'transparent' }]}
              >
                <Ionicons name={x.icon} size={14} color={on ? t.text : t.muted} />
                <Text style={[styles.tabText, { color: on ? t.text : t.muted }]}>{x.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {tab === 'route' && route && (
        <View style={styles.pad}>
          <Text style={[styles.routeText, { color: t.body }]}>{sights(day).join('  →  ')}</Text>
          <OutlineButton label="Open route in Maps" icon="navigate-outline" onPress={() => Linking.openURL(route).catch(() => {})} style={{ alignSelf: 'flex-start', marginTop: 12 }} />
        </View>
      )}

      {tab === 'tickets' && ticketCount > 0 && (
        <View style={[styles.pad, { gap: 16 }]}>
          {Object.entries(tickets || {}).map(([stop, list]) => (
            <View key={stop} style={{ gap: 8 }}>
              <Text style={[styles.overline, { color: t.muted }]}>{stop}</Text>
              {list.map((tk) => (
                <TicketRow key={tk.id} ticket={tk} t={t} />
              ))}
            </View>
          ))}
        </View>
      )}

      {tab === 'plan' && (
        <View style={[styles.pad, { gap: 16 }]}>
          {day.slots.map((slot) => (
            <View key={slot.name} style={styles.slot}>
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.slotIcon, { backgroundColor: t.sunken }]}>
                  <Ionicons name={SLOT_ICONS[slot.name.toLowerCase()] || 'sparkles-outline'} size={16} color={t.body} />
                </View>
                <View style={[styles.slotLine, { backgroundColor: t.border }]} />
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                <Text style={[styles.overline, { color: t.muted }]}>{slot.name}</Text>
                <View style={{ marginTop: 6, gap: 10 }}>
                  {slot.items.map((it, k) =>
                    it.meal ? (
                      <View key={k} style={[styles.meal, { backgroundColor: t.surfaceMuted }]}>
                        <Ionicons name="restaurant-outline" size={15} color={t.muted} style={{ marginTop: 1 }} />
                        <Text style={[styles.mealText, { color: t.muted }]}>
                          <Text style={{ color: t.text, fontWeight: '600' }}>{it.name}</Text>
                          {it.where ? ` at ${it.where}` : ''}
                        </Text>
                      </View>
                    ) : (
                      <View key={k}>
                        <Text style={[styles.stop, { color: t.text }]}>{it.name}</Text>
                        {!!it.desc && (
                          <Text style={[styles.stopDesc, { color: t.muted }]} numberOfLines={2}>
                            {it.desc}
                          </Text>
                        )}
                        {(!!it.fee || !!it.timings) && (
                          <View style={styles.facts}>
                            {!!it.fee && (
                              <View style={[styles.fact, { backgroundColor: t.sunken }]}>
                                <Ionicons name="ticket-outline" size={11} color={t.body} />
                                <Text style={[styles.factText, { color: t.body }]}>{it.fee}</Text>
                              </View>
                            )}
                            {!!it.timings && (
                              <View style={[styles.fact, { backgroundColor: t.sunken }]}>
                                <Ionicons name="time-outline" size={11} color={t.body} />
                                <Text style={[styles.factText, { color: t.body }]}>{it.timings}</Text>
                              </View>
                            )}
                          </View>
                        )}
                        {!!it.tip && (
                          <View style={styles.tip}>
                            <Ionicons name="bulb-outline" size={13} color={t.muted} style={{ marginTop: 1 }} />
                            <Text style={[styles.tipText, { color: t.muted }]}>{it.tip}</Text>
                          </View>
                        )}
                        {/* A bookable ticket for this stop, right under it */}
                        {!!tickets?.[it.name]?.[0] && (
                          <View style={{ marginTop: 8 }}>
                            <TicketRow ticket={tickets[it.name][0]} t={t} compact more={tickets[it.name].length - 1} onMore={() => setTab('tickets')} />
                          </View>
                        )}
                      </View>
                    ),
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// A stable empty list: a fresh [] default would re-run the photo lookup every render
const NO_PLACES: Place[] = [];

/**
 * markdown: the itinerary markdown. destination: for photo and ticket lookups.
 * fallbackPlaces: the destination's place cards (their photos are used first).
 */
export default function ItineraryDayCards({
  markdown,
  destination,
  duration,
  fallbackPlaces = NO_PLACES,
  onClose,
}: {
  markdown: string | null;
  destination?: string | null;
  duration?: number | string | null;
  fallbackPlaces?: Place[];
  onClose?: () => void;
}) {
  const t = useIsha();
  const router = useRouter();
  const plan = useMemo(() => parseItinerary(markdown), [markdown]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [tickets, setTickets] = useState<Record<number, Record<string, Ticket[]>>>({});

  // Bookable tickets for each day's stops
  useEffect(() => {
    if (!plan || !destination) return undefined;
    let alive = true;
    plan.days.forEach((day) => {
      const stops = sights(day);
      if (!stops.length) return;
      const q = `place=${encodeURIComponent(destination)}&stops=${encodeURIComponent(stops.join('|'))}&limit=2`;
      makeAPICall(`/activities/itinerary-tickets?${q}`, { timeout: 15000 })
        .then((j: any) => {
          if (alive && j?.data && Object.keys(j.data).length) setTickets((x) => ({ ...x, [day.n]: j.data }));
        })
        .catch(() => {});
    });
    return () => {
      alive = false;
    };
  }, [plan, destination]);

  // One photo per day, of its first sight: the destination's place cards first
  useEffect(() => {
    if (!plan) return undefined;
    const fromCards: Record<string, string> = {};
    const byName = new Map(
      (fallbackPlaces || [])
        .filter((p) => p?.name && (p.image || p.imageUrl))
        .map((p) => [p.name.toLowerCase(), (p.image || p.imageUrl) as string]),
    );
    const wanted = plan.days.map(leadStop).filter((n): n is string => !!n);
    for (const name of wanted) if (byName.has(name.toLowerCase())) fromCards[name] = byName.get(name.toLowerCase()) as string;
    setPhotos(fromCards);
    const missing = [...new Set(wanted.filter((n) => !fromCards[n]))];
    if (!missing.length) return undefined;
    let alive = true;
    // Small batches, so one slow lookup can't hold up every photo
    for (let i = 0; i < missing.length; i += 8) {
      const chunk = missing.slice(i, i + 8).map((placeName) => ({ placeName, location: destination || '', count: 1 }));
      makeAPICall('/destinations/place-images-batch', { method: 'POST', timeout: 25000, body: JSON.stringify({ places: chunk }) })
        .then((res: any) => {
          if (!alive) return;
          const found: Record<string, string> = {};
          for (const r of res?.data || []) {
            const url = r?.data?.[0]?.url;
            if (r?.ok && url && !String(url).includes('pexels.com')) found[r.placeName] = url;
          }
          if (Object.keys(found).length) setPhotos((p) => ({ ...p, ...found }));
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [plan, destination, fallbackPlaces]);

  if (!plan) {
    return (
      <Text style={[styles.empty, { color: t.muted }]}>This itinerary couldn't be shown here. Ask Isha to plan the trip again.</Text>
    );
  }

  const openFull = () =>
    router.push({
      pathname: '/trip/itinerary',
      params: {
        markdown: markdown || '',
        destination: destination || '',
        duration: String(duration || plan.days.length),
        title: plan.title || `${destination} trip`,
      },
    } as never);

  return (
    <View style={{ marginTop: 14, gap: 12 }}>
      <View style={[styles.summary, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}>
        <View style={styles.inline}>
          <Ionicons name="location-outline" size={13} color={t.muted} />
          <Text style={[styles.overline, { color: t.muted }]}>Your itinerary</Text>
        </View>
        <Text style={[styles.planTitle, { color: t.text }]}>{plan.title || `${destination} trip`}</Text>
        {!!plan.tagline && <Text style={[styles.tagline, { color: t.muted }]}>{plan.tagline}</Text>}
        <View style={styles.metaRow}>
          <MetaChip icon="calendar-outline" t={t}>
            {plan.days.length} days
          </MetaChip>
          {!!plan.meta['Best Time'] && (
            <MetaChip icon="partly-sunny-outline" t={t}>
              {plan.meta['Best Time'].replace(/\s*\(.*\)\s*$/, '')}
            </MetaChip>
          )}
          {!!plan.meta.Budget && (
            <MetaChip icon="wallet-outline" t={t}>
              {plan.meta.Budget.replace(/\s*\(.*\)\s*$/, '')}
            </MetaChip>
          )}
        </View>
      </View>

      {plan.days.map((day) => (
        <DayCard key={day.n} day={day} photo={photos[leadStop(day) || '']} destination={destination} tickets={tickets[day.n]} />
      ))}

      <View style={styles.footer}>
        {onClose && <OutlineButton label="Hide itinerary" icon="chevron-up" onPress={onClose} style={{ flex: 1, height: 42 }} />}
        <OutlineButton label="Full screen" icon="expand-outline" onPress={openFull} style={{ flex: 1, height: 42 }} />
      </View>
    </View>
  );
}

function MetaChip({ icon, t, children }: { icon: IconName; t: IshaPalette; children: React.ReactNode }) {
  return (
    <View style={[styles.metaChip, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : '#ffffff', borderColor: t.border }]}>
      <Ionicons name={icon} size={13} color={t.muted} />
      <Text style={[styles.metaText, { color: t.body }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { marginTop: 12, fontSize: 14 },
  summary: { borderWidth: 1, borderRadius: 16, padding: 16 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  planTitle: { fontSize: 18, fontWeight: '800', lineHeight: 24, marginTop: 4 },
  tagline: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4, maxWidth: '100%' },
  metaText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  day: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  dayCover: { height: 148 },
  dayBadge: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  dayBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#1c1917' },
  dayCoverText: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16 },
  dayTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 23 },
  daySub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: 8, flexGrow: 0 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 8, borderBottomWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '600' },
  pad: { padding: 16 },
  routeText: { fontSize: 13, lineHeight: 20 },
  slot: { flexDirection: 'row', gap: 12 },
  slotIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  slotLine: { width: 1, flex: 1, marginTop: 4 },
  meal: { flexDirection: 'row', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  mealText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stop: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  stopDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  factText: { fontSize: 11, fontWeight: '500' },
  tip: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 17 },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 8 },
  ticketCompact: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 6, paddingRight: 8 },
  ticketThumb: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden' },
  ticketThumbSm: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden' },
  ticketTitle: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  ticketTitleSm: { fontSize: 12, fontWeight: '600', lineHeight: 15 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { fontSize: 11.5 },
  book: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  bookText: { fontSize: 12, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 8 },
});
