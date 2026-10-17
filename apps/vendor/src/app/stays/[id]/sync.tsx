// Calendar sync (iCal) for one stay: for each room type, the Prayana calendar
// link other sites import (so a night booked here closes there), and the
// calendars imported from Airbnb, Booking.com and others (so a night booked
// there closes here). The server re-reads imports every 30 minutes; "Sync
// now" reads them straight away. Ported from the web sync page.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share, RefreshControl, KeyboardAvoidingView, Platform, TextInput as RNTextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { Button, LoadingSpinner } from '../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../theme/vendorColors';
import { staysAPI } from '../_components/api';
import { usePalette, ScreenHeader, Chip, ChipRow, FieldLabel } from '../_components/controls';
import { apiError, plural, unitNoun } from '../_components/stayConfig';

const MAX_IMPORTS_PER_ROOM = 10; // same as the server

const CALENDAR_SOURCES = [
  { id: 'Airbnb', match: /airbnb\./i },
  { id: 'Booking.com', match: /booking\.com/i },
  { id: 'MakeMyTrip', match: /makemytrip|goibibo|ingommt/i },
  { id: 'Agoda', match: /agoda\./i },
  { id: 'Other', match: null },
];
const guessSource = (url: string) => CALENDAR_SOURCES.find((s) => s.match && s.match.test(url || ''))?.id || null;
const looksLikeCalendarLink = (url: string) => /^(https|webcal):\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(String(url || '').trim());
const hostOf = (url: string) => {
  const m = String(url || '').replace(/^webcal:\/\//i, 'https://').match(/^https?:\/\/([^/?#]+)/i);
  return m ? m[1].replace(/^www\./, '') : '';
};
function agoLabel(iso?: string | null) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const GUIDES = [
  {
    id: 'airbnb',
    title: 'Airbnb',
    steps: [
      'On Airbnb, open Listings and pick the listing that matches this room type.',
      'Go to Availability (on the app: Calendar, then Availability) and scroll to "Connect calendars" (sometimes "Sync calendars").',
      'Choose "Export calendar" and copy the link Airbnb shows you.',
      'Here, under the room type, pick Airbnb, paste that link and tap "Add calendar".',
      'Back on Airbnb, choose "Import calendar" (or "Connect another website"), paste your Prayana calendar link from this page and name it "Prayana".',
    ],
  },
  {
    id: 'booking',
    title: 'Booking.com',
    steps: [
      'Sign in to the Booking.com Extranet and open Rates & availability, then "Sync calendars".',
      'Pick the room that matches this room type and choose "Export calendar". Copy the link.',
      'Here, under the room type, pick Booking.com, paste that link and tap "Add calendar".',
      'Back on Booking.com, choose "Import calendar" ("Add calendar connection"), paste your Prayana calendar link from this page and name it "Prayana".',
      'Booking.com syncs one room at a time, so repeat this for each room you list there.',
    ],
  },
  {
    id: 'other',
    title: 'MakeMyTrip, Agoda and other sites',
    steps: [
      'Look in the site\'s calendar or availability settings for "iCal", "Calendar sync" or "Export calendar".',
      'Copy their link and add it here under the right room type.',
      'If the site can import a calendar too, give it your Prayana calendar link from this page.',
      "Some sites only sync through a channel manager. If you can't find an iCal option, ask their partner support.",
    ],
  },
];

interface ImportRow {
  _id: string;
  label?: string | null;
  url: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  events?: number | null;
}
interface SyncRoom {
  roomTypeId: string;
  name: string;
  capacity: number;
  kind?: string;
  exportUrl: string | null;
  imports: ImportRow[];
}

function Guide({ guide }: { guide: (typeof GUIDES)[number] }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.guide, { borderTopColor: p.c.border }]}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={styles.guideHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[styles.guideTitle, { color: p.c.text }]}>{guide.title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={p.c.textTertiary} />
      </TouchableOpacity>
      {open
        ? guide.steps.map((s, i) => (
            <View key={s} style={styles.guideStep}>
              <Text style={[styles.guideNum, { color: p.brand }]}>{i + 1}.</Text>
              <Text style={[styles.small, styles.flex, { color: p.c.textSecondary }]}>{s}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

function AddCalendarForm({ room, onAdd, onCancel }: { room: SyncRoom; onAdd: (body: { roomTypeId: string; url: string; label: string }) => Promise<string | null>; onCancel?: () => void }) {
  const p = usePalette();
  const [source, setSource] = useState<string | null>(null);
  const [otherName, setOtherName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeUrl = (value: string) => {
    setUrl(value);
    if (error) setError(null);
    if (!source) {
      const guess = guessSource(value);
      if (guess) setSource(guess);
    }
  };
  const paste = async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (text) changeUrl(text);
      else Toast.show({ type: 'info', text1: 'Nothing to paste', text2: 'Copy the calendar link on the other site first.' });
    } catch {
      // Clipboard not available: the field still takes a long-press paste.
    }
  };
  const submit = async () => {
    const link = url.trim();
    if (!link) return setError('Paste the calendar link');
    if (!looksLikeCalendarLink(link)) return setError('Paste the full link. It starts with https:// or webcal://');
    const label = source === 'Other' ? otherName.trim() || 'Other' : source || guessSource(link) || 'Other';
    setBusy(true);
    setError(null);
    const message = await onAdd({ roomTypeId: room.roomTypeId, url: link, label });
    setBusy(false);
    if (message) setError(message);
    else {
      setUrl('');
      setSource(null);
      setOtherName('');
    }
  };

  return (
    <View style={[styles.addForm, { borderColor: p.c.border }]}>
      <Text style={[styles.h3, { color: p.c.text }]}>Add a calendar</Text>
      <FieldLabel label="Where is it from?" />
      <ChipRow>
        {CALENDAR_SOURCES.map((s) => (
          <Chip key={s.id} label={s.id} selected={source === s.id} onPress={() => setSource(source === s.id ? null : s.id)} disabled={busy} />
        ))}
      </ChipRow>
      {source === 'Other' ? (
        <View>
          <FieldLabel label="Name of the site" optional />
          <RNTextInput
            value={otherName}
            onChangeText={setOtherName}
            maxLength={40}
            placeholder="e.g. Goibibo, Hostelworld"
            placeholderTextColor={p.c.textTertiary}
            style={[styles.input, { color: p.c.text, borderColor: p.c.fieldBorder, backgroundColor: p.c.field }]}
          />
        </View>
      ) : null}
      <View>
        <View style={styles.labelRow}>
          <FieldLabel label="Calendar link (iCal)" />
          <TouchableOpacity onPress={paste} accessibilityRole="button" accessibilityLabel="Paste the link" hitSlop={8}>
            <Text style={[styles.link, { color: p.brand }]}>Paste</Text>
          </TouchableOpacity>
        </View>
        <RNTextInput
          value={url}
          onChangeText={changeUrl}
          placeholder="https://www.airbnb.co.in/calendar/ical/….ics"
          placeholderTextColor={p.c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Calendar link"
          style={[styles.input, { color: p.c.text, borderColor: error ? p.danger : p.c.fieldBorder, backgroundColor: p.c.field }]}
        />
        <Text style={[styles.small, { color: error ? p.danger : p.c.textTertiary }]}>
          {error || "Copy it from the other site's calendar settings. Links starting with webcal:// work too."}
        </Text>
      </View>
      <View style={styles.btnRow}>
        {onCancel ? <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} disabled={busy} style={styles.flex} /> : null}
        <Button title="Add calendar" size="sm" onPress={submit} loading={busy} style={styles.flex} />
      </View>
    </View>
  );
}

function RoomSyncCard({ room, onAdd, onRemove, removingId }: { room: SyncRoom; onAdd: (body: { roomTypeId: string; url: string; label: string }) => Promise<string | null>; onRemove: (imp: ImportRow) => void; removingId: string | null }) {
  const p = usePalette();
  const imports = room.imports || [];
  const [adding, setAdding] = useState(false);
  const full = imports.length >= MAX_IMPORTS_PER_ROOM;
  const showForm = !full && (imports.length === 0 || adding);
  const noun = unitNoun(room);

  const copy = async () => {
    if (!room.exportUrl) return;
    try {
      await Clipboard.setStringAsync(room.exportUrl);
      Toast.show({ type: 'success', text1: 'Link copied' });
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't copy", text2: 'Use Share instead.' });
    }
  };
  const share = () => {
    if (!room.exportUrl) return;
    Share.share({ message: room.exportUrl }).catch(() => {});
  };
  const add = async (body: { roomTypeId: string; url: string; label: string }) => {
    const err = await onAdd(body);
    if (!err) setAdding(false);
    return err;
  };

  return (
    <View style={[styles.card, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
      <View style={[styles.cardHead, { borderBottomColor: p.c.border }]}>
        <Text style={[styles.cardTitle, { color: p.c.text }]} accessibilityRole="header">
          {room.name}
        </Text>
        <Text style={[styles.small, { color: p.c.textTertiary }]}>{plural(room.capacity || 0, noun)}</Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.h3Row}>
          <Ionicons name="link-outline" size={16} color={p.brand} />
          <Text style={[styles.h3, { color: p.c.text }]}>Your Prayana calendar link</Text>
        </View>
        <Text style={[styles.small, { color: p.c.textSecondary }]}>
          Paste this into Airbnb / Booking.com (their "Import calendar") so nights booked on Prayana close there too. Keep it to yourself: anyone with the link can see which nights are booked.
        </Text>
        {room.exportUrl ? (
          <>
            <Text selectable style={[styles.urlBox, { color: p.c.text, borderColor: p.c.border, backgroundColor: p.soft.gray.bg }]} numberOfLines={2}>
              {room.exportUrl}
            </Text>
            <View style={styles.btnRow}>
              <Button title="Copy link" size="sm" variant="outline" onPress={copy} icon={<Ionicons name="copy-outline" size={15} color={colors.primary[500]} />} style={styles.flex} />
              <Button title="Share" size="sm" variant="outline" onPress={share} icon={<Ionicons name="share-outline" size={15} color={colors.primary[500]} />} style={styles.flex} />
            </View>
          </>
        ) : (
          <Text style={[styles.small, { color: p.c.textTertiary }]}>Your link isn't ready yet. Pull down to refresh in a moment.</Text>
        )}

        <Text style={[styles.h3, styles.sectionGap, { color: p.c.text }]}>Calendars from other sites</Text>
        {imports.length === 0 ? (
          <Text style={[styles.small, { color: p.c.textSecondary }]}>
            None yet. Add the calendar link from Airbnb, Booking.com or another site below, and nights booked there close here.
          </Text>
        ) : (
          imports.map((imp) => {
            const synced = agoLabel(imp.lastSyncedAt);
            const host = hostOf(imp.url);
            return (
              <View key={imp._id} style={[styles.importRow, { borderBottomColor: p.c.border }]}>
                <View style={[styles.importIcon, { backgroundColor: p.soft.blue.bg }]}>
                  <Ionicons name="calendar-outline" size={16} color={p.soft.blue.fg} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.importTitle, { color: p.c.text }]} numberOfLines={1}>
                    {imp.label || 'Calendar'}
                    {host ? <Text style={[styles.small, { color: p.c.textTertiary }]}>  {host}</Text> : null}
                  </Text>
                  <Text style={[styles.small, { color: p.c.textSecondary }]}>
                    {[synced ? `Synced ${synced}` : 'Not read yet', imp.events != null ? plural(imp.events, 'booking or block', 'bookings or blocks') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {imp.lastError ? (
                    <Text style={[styles.small, { color: p.danger }]}>Couldn't read it last time: {imp.lastError}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => onRemove(imp)}
                  disabled={removingId === imp._id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove the ${imp.label || ''} calendar`.replace(/\s+/g, ' ')}
                  hitSlop={8}
                  style={styles.removeBtn}
                >
                  <Ionicons name="trash-outline" size={19} color={removingId === imp._id ? p.c.textTertiary : p.danger} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
        {room.capacity > 1 ? (
          <Text style={[styles.small, { color: p.c.textTertiary }]}>
            You have {plural(room.capacity, noun)} of this type. Each booking on an added calendar takes one {noun}, so if you list each {noun} separately on another site, add each one's calendar here (up to {MAX_IMPORTS_PER_ROOM}).
          </Text>
        ) : null}

        {showForm ? (
          <AddCalendarForm room={room} onAdd={add} onCancel={imports.length ? () => setAdding(false) : undefined} />
        ) : full ? (
          <Text style={[styles.small, { color: p.c.textTertiary }]}>That's the most calendars one room type can have. Remove one to add another.</Text>
        ) : (
          <Button title="Add another calendar" size="sm" variant="outline" onPress={() => setAdding(true)} icon={<Ionicons name="add" size={16} color={colors.primary[500]} />} />
        )}
      </View>
    </View>
  );
}

export default function CalendarSyncScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stayId = String(id);
  const router = useRouter();
  const p = usePalette();
  const [rooms, setRooms] = useState<SyncRoom[] | null>(null);
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [stayName, setStayName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await staysAPI.getCalendarSync(stayId);
      if (res?.success === false) throw new Error(res.message);
      setRooms(res?.data?.roomTypes || []);
      setError(null);
    } catch (e) {
      setError(apiError(e, "Couldn't load calendar sync"));
    } finally {
      setRefreshing(false);
    }
  }, [stayId]);

  useEffect(() => {
    load();
    // The property name, and each room type's kind (a dorm syncs beds).
    staysAPI
      .getMine(stayId)
      .then((res) => {
        setStayName(res?.data?.name || null);
        const map: Record<string, string> = {};
        (res?.data?.roomTypes || []).forEach((r: { _id: string; kind: string }) => (map[String(r._id)] = r.kind));
        setKinds(map);
      })
      .catch(() => {});
  }, [load, stayId]);

  const applyRooms = (data: any) => {
    if (Array.isArray(data?.roomTypes)) setRooms(data.roomTypes);
  };

  const add = async (body: { roomTypeId: string; url: string; label: string }): Promise<string | null> => {
    try {
      const res = await staysAPI.addCalendarImport(stayId, body);
      if (res?.success === false) return res.message || "Couldn't add the calendar";
      applyRooms(res?.data);
      const conflicts = Number(res?.data?.conflicts) || 0;
      Toast.show({ type: conflicts ? 'info' : 'success', text1: conflicts ? 'Calendar added — check your bookings' : 'Calendar added', text2: res?.message, visibilityTime: conflicts ? 6000 : 4000 });
      return null;
    } catch (e) {
      return apiError(e, "Couldn't add the calendar. Check the link and try again.");
    }
  };

  const remove = (imp: ImportRow) =>
    Alert.alert('Remove this calendar?', "Nights it marked as booked open again here (unless they're booked on Prayana).", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(imp._id);
          try {
            const res = await staysAPI.removeCalendarImport(stayId, imp._id);
            applyRooms(res?.data);
            Toast.show({ type: 'success', text1: res?.message || 'Calendar removed' });
          } catch (e) {
            Toast.show({ type: 'error', text1: "Couldn't remove it", text2: apiError(e, 'Try again.') });
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await staysAPI.syncCalendarsNow(stayId);
      applyRooms(res?.data);
      const problem = Number(res?.data?.errors) > 0 || Number(res?.data?.conflicts) > 0;
      Toast.show({ type: problem ? 'info' : 'success', text1: res?.message || 'Calendars synced' });
    } catch (e) {
      Toast.show({ type: 'error', text1: "Couldn't sync", text2: apiError(e, 'Try again.') });
    } finally {
      setSyncing(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/stays/${stayId}/calendar`));
  const anyImports = (rooms || []).some((r) => (r.imports || []).length > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: p.c.backgroundSecondary }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Calendar sync" subtitle={stayName} onBack={back} />
      {!rooms && !error ? (
        <LoadingSpinner fullScreen />
      ) : !rooms ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: p.c.text }]}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary[500]} />}
          >
            <Text style={[styles.lead, { color: p.c.textSecondary }]}>
              Selling on Airbnb or Booking.com too? Connect calendars both ways so a night booked on one site closes on the other. We re-read added calendars every 30 minutes.
            </Text>
            {anyImports ? (
              <Button
                title="Sync now"
                variant="outline"
                onPress={syncNow}
                loading={syncing}
                icon={<Ionicons name="sync-outline" size={16} color={colors.primary[500]} />}
                style={styles.syncBtn}
              />
            ) : null}

            <View style={[styles.help, { backgroundColor: p.c.card, borderColor: p.c.border }]}>
              <View style={styles.h3Row}>
                <Ionicons name="help-circle-outline" size={18} color={p.brand} />
                <Text style={[styles.h3, { color: p.c.text }]}>How to connect</Text>
              </View>
              <Text style={[styles.small, styles.helpLead, { color: p.c.textSecondary }]}>
                Connect both ways: their link goes in here, and your Prayana link goes in there. One calendar per listing: each booking on it takes one room.
              </Text>
              {GUIDES.map((g) => (
                <Guide key={g.id} guide={g} />
              ))}
            </View>

            {rooms.length === 0 ? (
              <Text style={[styles.lead, { color: p.c.textSecondary }]}>Add your rooms first; each room type gets its own calendar.</Text>
            ) : (
              rooms.map((r) => (
                <RoomSyncCard
                  key={String(r.roomTypeId)}
                  room={{ ...r, roomTypeId: String(r.roomTypeId), kind: kinds[String(r.roomTypeId)] }}
                  onAdd={add}
                  onRemove={remove}
                  removingId={removingId}
                />
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing['2xl'] },
  errorText: { fontSize: fontSize.md, fontWeight: fontWeight.medium, textAlign: 'center' },
  lead: { fontSize: fontSize.sm, lineHeight: 19 },
  syncBtn: { alignSelf: 'flex-start' },
  small: { fontSize: fontSize.xs, lineHeight: 16 },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  h3: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  h3Row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionGap: { marginTop: spacing.md },

  help: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md },
  helpLead: { marginTop: 4, marginBottom: spacing.sm },
  guide: { borderTopWidth: StyleSheet.hairlineWidth },
  guideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  guideTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  guideStep: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
  guideNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, width: 16 },

  card: { borderWidth: 1, borderRadius: borderRadius.xl, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1 },
  cardTitle: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  urlBox: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: fontSize.xs, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  importRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  importIcon: { width: 32, height: 32, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  importTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  addForm: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, marginTop: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, minHeight: 44, fontSize: fontSize.sm },
});
