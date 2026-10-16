// /monuments/ticket/[orderId] — one ONDC monument ticket (entry pass).
// Mobile port of web app/monuments/ticket/[orderId]/page.js + its
// QRTicketDisplay. Same data path as the web: GET /ondc/my-tickets
// (ondcAPI.getMyTickets), matched on ondcOrderId OR transactionId; complaints
// from GET /ondc/my-issues filtered to this transaction; "Refresh status"
// fires POST /ondc/status (ondcAPI.checkStatus) and reloads after 3s.
//
// Entry passes: a seller sends either a base64 PNG of the QR (drawn as an
// image) or the code itself. The web draws a QR from that code with
// qrcode.react; the app has no QR library, so a text code is shown as text
// (with copy) rather than adding a native dependency.
//
// Not ported yet: Cancel ticket (web CancelTicketPanel, two-step quote/confirm)
// and raising/following a complaint (web ComplaintPanel). Existing complaints
// are listed read-only.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, Image, Linking, Share, Platform } from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { ondcAPI, makeAPICall, getAuthHeaders } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { goBack } from '../../../lib/goBack';

const SAFFRON = '#E38B29';

const STATUS_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  pending: { icon: 'time-outline', color: '#EAB308', label: 'Pending' },
  issued: { icon: 'checkmark-circle', color: '#22C55E', label: 'Active' },
  used: { icon: 'checkmark-circle', color: '#6B7280', label: 'Used' },
  expired: { icon: 'close-circle', color: '#EF4444', label: 'Expired' },
  cancelled: { icon: 'close-circle', color: '#EF4444', label: 'Cancelled' },
};

const ISSUE_STATUS: Record<string, string> = {
  OPEN: 'Sent to the seller',
  PROCESSING: 'Seller working on it',
  RESOLVED: 'Resolved — waiting for you',
  CLOSED: 'Closed',
};

type Pass = { token?: string; fulfillmentId?: string; status?: string };
type Ticket = {
  transactionId: string;
  ondcOrderId?: string;
  status?: string;
  ticketStatus?: string;
  qrCode?: string;
  ticketData?: { passes?: Pass[]; documentUrl?: string };
  payment?: { amount?: number; currency?: string };
  order?: any;
  selection?: { visitDate?: string };
  searchIntent?: { monumentName?: string; city?: string };
  monumentName?: string;
  visitors?: Array<{ name?: string; category?: string }>;
  cancellation?: { phase?: string; unsolicited?: boolean; refundAmount?: number; chargesAmount?: number };
};
type Issue = { issueId: string; transactionId?: string; status?: string; description?: string; infoRequest?: any };

const isImageToken = (t?: string) => typeof t === 'string' && (t.startsWith('data:image') || t.startsWith('iVBOR'));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Oct 2026" in Asia/Kolkata — formatted by hand; Intl time zones are unreliable on Hermes. */
function formatVisitDate(v?: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} ${ist.getUTCFullYear()}`;
}

const inr = (n: number) => Number(n || 0).toLocaleString('en-IN');

export default function TicketDetailScreen() {
  const { themeColors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const meUid = (user as any)?.uid;
  const signedIn = !!meUid && meUid !== 'guest-user';
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [complaints, setComplaints] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadComplaints = useCallback(async (transactionId: string) => {
    try {
      const res: any = await makeAPICall('/ondc/my-issues', { headers: await getAuthHeaders() });
      setComplaints((res?.issues || []).filter((i: Issue) => i.transactionId === transactionId));
    } catch {
      // complaints are secondary; leave the list as it was
    }
  }, []);

  const load = useCallback(async () => {
    if (!signedIn) { setLoading(false); return; }
    try {
      const res: any = await ondcAPI.getMyTickets();
      if (res?.success) {
        const found: Ticket | undefined = (res.tickets || []).find(
          (t: Ticket) => t.ondcOrderId === orderId || t.transactionId === orderId,
        );
        setTicket(found || null);
        if (found) loadComplaints(found.transactionId);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load ticket' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [signedIn, orderId, loadComplaints]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const refreshStatus = async () => {
    if (!ticket) return;
    try {
      await ondcAPI.checkStatus({ transactionId: ticket.transactionId });
      Toast.show({ type: 'success', text1: 'Status check sent' });
      setTimeout(load, 3000);
    } catch {
      Toast.show({ type: 'error', text1: 'Status check failed' });
    }
  };

  const header = (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={() => goBack('/monuments/my-tickets')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={24} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Ticket</Text>
      <View style={{ width: 24 }} />
    </View>
  );

  if (loading || !signedIn || !ticket) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.center}>
          {loading ? (
            <ActivityIndicator size="large" color={SAFFRON} />
          ) : !signedIn ? (
            <>
              <Ionicons name="ticket-outline" size={44} color={themeColors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Sign in to see your ticket</Text>
              <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON }]} onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.ctaText}>Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="warning-outline" size={56} color={themeColors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Ticket Not Found</Text>
              <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                This ticket doesn't exist or you don't have access.
              </Text>
              <TouchableOpacity style={[styles.cta, { backgroundColor: SAFFRON }]} onPress={() => router.replace('/monuments/my-tickets' as any)}>
                <Text style={styles.ctaText}>View My Tickets</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const monumentName =
    ticket.monumentName || ticket.searchIntent?.monumentName || ticket.order?.items?.[0]?.descriptor?.name || 'Monument';
  const visitDate = formatVisitDate(ticket.selection?.visitDate || ticket.order?.fulfillments?.[0]?.stops?.[0]?.time?.timestamp);
  const status = STATUS_CONFIG[ticket.ticketStatus || ''] || STATUS_CONFIG.pending;
  const passes: Pass[] = ticket.ticketData?.passes?.length
    ? ticket.ticketData.passes
    : ticket.qrCode ? [{ token: ticket.qrCode }] : [];
  const visitors = ticket.visitors || [];
  const amount = ticket.payment?.amount;
  const cancelled = ['cancelled', 'partially_cancelled'].includes(ticket.cancellation?.phase || '');

  const share = async () => {
    try {
      await Share.share({
        title: `Monument Ticket - ${monumentName}`,
        message: `Entry pass for ${monumentName}${visitDate ? ` on ${visitDate}` : ''}. Order: ${ticket.ondcOrderId || ticket.transactionId}`,
      });
    } catch {
      // user dismissed
    }
  };

  const card = { backgroundColor: themeColors.surface, borderColor: themeColors.border };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={SAFFRON} />}
      >
        {/* Entry pass */}
        <View style={[styles.pass, card]}>
          <View style={[styles.passHead, { backgroundColor: '#F97316' }]}>
            <View style={styles.passKicker}>
              <Ionicons name="ticket-outline" size={18} color="#fff" />
              <Text style={styles.passKickerText}>ENTRY PASS</Text>
            </View>
            <Text style={styles.passTitle}>{monumentName || 'Monument Ticket'}</Text>
          </View>

          <View style={styles.badgeWrap}>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
              <Ionicons name={status.icon} size={15} color={status.color} />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          {/* One code per entry pass */}
          <View style={styles.passes}>
            {passes.length ? (
              passes.map((p, i) => (
                <View key={`${p.fulfillmentId}-${i}`} style={{ alignItems: 'center' }}>
                  <View style={[styles.qrFrame, { backgroundColor: isDarkMode ? '#fff' : '#F9FAFB' }]}>
                    <PassCode token={p.token} />
                  </View>
                  {passes.length > 1 || p.status === 'CLAIMED' ? (
                    <Text style={[styles.passNote, { color: themeColors.textSecondary }]}>
                      {passes.length > 1 ? `Pass ${i + 1}` : ''}
                      {p.status === 'CLAIMED' ? `${passes.length > 1 ? ' · ' : ''}Used` : ''}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={[styles.qrPending, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
                <Text style={{ color: themeColors.textSecondary, fontSize: fontSize.sm }}>QR Code Pending...</Text>
              </View>
            )}
          </View>

          {/* Details */}
          <View style={styles.grid}>
            {ticket.ondcOrderId ? <Detail c={themeColors} label="Order ID" value={ticket.ondcOrderId} mono /> : null}
            {visitDate ? <Detail c={themeColors} label="Visit Date" value={visitDate} /> : null}
            {visitors.length > 0 ? (
              <Detail c={themeColors} label="Visitors" value={`${visitors.length} ${visitors.length === 1 ? 'person' : 'people'}`} />
            ) : null}
            {amount != null && amount > 0 ? <Detail c={themeColors} label="Amount" value={`₹${amount}`} color={SAFFRON} /> : null}
          </View>

          {visitors.length > 0 ? (
            <View style={[styles.visitors, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.25)' : '#F9FAFB' }]}>
              <Text style={styles.detailLabel}>VISITORS</Text>
              {visitors.map((v, i) => (
                <Text key={i} style={[styles.visitor, { color: themeColors.text }]}>
                  {v.name} ({v.category})
                </Text>
              ))}
            </View>
          ) : null}

          {ticket.ticketData?.documentUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(ticket.ticketData!.documentUrl!)} style={{ paddingBottom: spacing.lg }}>
              <Text style={[styles.docLink, { color: SAFFRON }]}>View Full Ticket Document</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.passActions}>
            <TouchableOpacity
              onPress={share}
              style={[styles.actionBtn, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
            >
              <Ionicons name="share-outline" size={16} color={themeColors.text} />
              <Text style={[styles.actionText, { color: themeColors.text }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cancellation outcome */}
        {cancelled ? (
          <View style={[styles.box, card]}>
            <Text style={[styles.boxTitle, { color: themeColors.text }]}>
              {ticket.cancellation!.phase === 'partially_cancelled'
                ? 'Some tickets were cancelled'
                : ticket.cancellation!.unsolicited
                  ? 'Cancelled by the seller'
                  : 'Cancelled'}
            </Text>
            <Text style={[styles.boxText, { color: themeColors.textSecondary }]}>
              Refund ₹{inr(ticket.cancellation!.refundAmount || 0)}
              {(ticket.cancellation!.chargesAmount || 0) > 0
                ? ` (after ₹${inr(ticket.cancellation!.chargesAmount!)} cancellation charges)`
                : ''}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <TouchableOpacity
          onPress={refreshStatus}
          style={[styles.actionBtn, styles.wide, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
        >
          <Ionicons name="refresh" size={16} color={themeColors.text} />
          <Text style={[styles.actionText, { color: themeColors.text }]}>Refresh Status</Text>
        </TouchableOpacity>

        {/* Complaints (ONDC IGM) — read-only list for now */}
        {complaints.length > 0 ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Help with this booking</Text>
            {complaints.map((c) => (
              <View key={c.issueId} style={[styles.box, card]}>
                <Text style={[styles.boxTitle, { color: themeColors.text }]}>
                  {ISSUE_STATUS[c.status || ''] || c.status}
                  {c.infoRequest ? ' · the seller has a question' : ''}
                </Text>
                {c.description ? (
                  <Text style={[styles.boxText, { color: themeColors.textSecondary }]} numberOfLines={1}>{c.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** A pass: the seller's QR image, or (no QR library in the app) the code as text. */
function PassCode({ token }: { token?: string }) {
  if (!token) return null;
  if (isImageToken(token)) {
    const uri = token.startsWith('data:') ? token : `data:image/png;base64,${token}`;
    return <Image source={{ uri }} style={styles.qrImg} resizeMode="contain" />;
  }
  if (/^https?:\/\//.test(token)) {
    return <Image source={{ uri: token }} style={styles.qrImg} resizeMode="contain" />;
  }
  const copy = async () => {
    await Clipboard.setStringAsync(String(token));
    Toast.show({ type: 'success', text1: 'Entry code copied' });
  };
  return (
    <TouchableOpacity onPress={copy} style={styles.codeBox} accessibilityLabel="Entry code, tap to copy">
      <Text style={styles.codeLabel}>ENTRY CODE</Text>
      <Text style={styles.codeText} selectable>{String(token)}</Text>
      <View style={styles.copyRow}>
        <Ionicons name="copy-outline" size={13} color="#6B7280" />
        <Text style={styles.copyText}>Tap to copy · show at the gate</Text>
      </View>
    </TouchableOpacity>
  );
}

function Detail({ c, label, value, mono, color }: { c: any; label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.detailValue, { color: color || c.text }, mono && styles.mono]} selectable>{value}</Text>
    </View>
  );
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptySub: { fontSize: fontSize.sm, textAlign: 'center', maxWidth: 280 },
  cta: { borderRadius: 999, alignItems: 'center', paddingVertical: 13, paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  ctaText: { color: '#fff', fontWeight: fontWeight.bold, fontSize: fontSize.md },

  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  pass: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  passHead: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center' },
  passKicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  passKickerText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, letterSpacing: 1.5 },
  passTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  badgeWrap: { alignItems: 'center', marginTop: -14 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  statusText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  passes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  qrFrame: { padding: spacing.md, borderRadius: borderRadius.xl },
  qrImg: { width: 192, height: 192 },
  qrPending: { width: 192, height: 192, borderRadius: borderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  passNote: { fontSize: fontSize.xs, marginTop: 6 },
  codeBox: { width: 220, alignItems: 'center', paddingVertical: spacing.md, gap: 6 },
  codeLabel: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 1.2, color: '#9CA3AF' },
  codeText: { fontFamily: MONO, fontSize: 18, fontWeight: fontWeight.bold, color: '#111827', textAlign: 'center' },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: fontSize.xs, color: '#6B7280' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.xl, rowGap: spacing.md },
  detail: { width: '50%', paddingRight: spacing.sm },
  detailLabel: { fontSize: 11, letterSpacing: 1, color: '#9CA3AF', fontWeight: fontWeight.semibold },
  detailValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  mono: { fontFamily: MONO },
  visitors: { marginHorizontal: spacing.xl, marginTop: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md, gap: 2 },
  visitor: { fontSize: fontSize.sm },
  docLink: { textAlign: 'center', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: spacing.md },

  passActions: { flexDirection: 'row', gap: spacing.md, padding: spacing.xl, paddingTop: spacing.lg },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: borderRadius.lg, paddingVertical: 13 },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  wide: { flex: 0, alignSelf: 'stretch' },

  box: { borderWidth: 1, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 4 },
  boxTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  boxText: { fontSize: fontSize.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
