// Step 1 — the property: where it is (the phone's location drops the map pin
// and fills the address; or find the pin from a typed address), its name and
// type, how guests stay (homes), star rating (hotels), a short description and
// the contact guests get after booking. The web version finds the place on
// Google Maps instead; there's no map picker in the vendor app.

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { Button, TextInput } from '../../../../components/ui';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import { usePalette, Section, Banner, OptionCard, Segmented, SelectField, SwitchRow } from '../controls';
import {
  CATEGORY_GROUP_LABEL,
  INDIAN_STATES,
  PROPERTY_TYPES,
  StayLocation,
  StepProps,
  newRoomType,
  stateByName,
  typesIn,
} from '../stayConfig';

const DESCRIPTION_HINTS: Record<string, string> = {
  hotel: "What's nearby, what the rooms are like, and what guests love about staying here.",
  home: "What the home is like, who's around (family, caretaker), food, and what's nearby.",
  unique: 'What makes the stay special, what is included, and what guests should expect.',
};

const TYPE_OPTIONS = (['hotel', 'home', 'unique'] as const).flatMap((c) =>
  typesIn(c).map((t) => ({ value: t.id, label: t.label, group: CATEGORY_GROUP_LABEL[c], hint: t.hint })),
);

/** What the phone's geocoder found, in the listing's address fields. */
function placeToLocation(pl: Location.LocationGeocodedAddress): Partial<StayLocation> {
  const street = [pl.streetNumber, pl.street].filter(Boolean).join(' ');
  const firstLine = [pl.name && pl.name !== street && pl.name !== pl.streetNumber ? pl.name : null, street || null]
    .filter(Boolean)
    .join(', ');
  const state = stateByName(pl.region)?.name || pl.region || null;
  const pincode = (pl.postalCode || '').replace(/\D/g, '').slice(0, 6) || null;
  const city = pl.city || pl.subregion || null;
  const locality = pl.district && pl.district !== city ? pl.district : null;
  const formatted = pl.formattedAddress || [firstLine, locality, city, state, pincode].filter(Boolean).join(', ');
  return { address: firstLine || formatted || null, formattedAddress: formatted || null, locality, city, state, pincode };
}

export default function PropertyStep({ draft, update }: StepProps) {
  const p = usePalette();
  const loc = draft.location || {};
  const lat = loc.coordinates?.lat;
  const lng = loc.coordinates?.lng;
  const hasPin = lat != null && lng != null;
  const [locating, setLocating] = useState<'here' | 'address' | null>(null);
  const type = PROPERTY_TYPES[draft.propertyType];
  const category = type?.category;

  const setLocation = (patch: Partial<StayLocation>) => update((d) => ({ location: { ...(d.location || {}), ...patch } }));

  const askPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location is off', 'Allow location access in Settings to drop the map pin, or ask a team member at the property to do it.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return false;
    }
    return true;
  };

  // Standing at the property: the phone's position is the pin, and its address
  // fills the empty fields (or all of them, if the owner says so).
  const useHere = async () => {
    setLocating('here');
    try {
      if (!(await askPermission())) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coordinates = { lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) };
      let found: Partial<StayLocation> = {};
      try {
        const [first] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        if (first) found = placeToLocation(first);
      } catch {
        // The address is a bonus; the pin is what matters.
      }
      const hadAddress = !!(loc.address || loc.formattedAddress || loc.city);
      const fillEmpty = () =>
        update((d) => {
          const cur = d.location || {};
          const merged: StayLocation = { ...cur, coordinates };
          (Object.keys(found) as (keyof StayLocation)[]).forEach((k) => {
            const v = found[k];
            if (v && !cur[k]) (merged as Record<string, unknown>)[k] = v;
          });
          return { location: merged };
        });
      if (hadAddress && (found.city || found.address)) {
        Alert.alert(
          'Use the address your phone found?',
          [found.address, found.locality, found.city, found.state, found.pincode].filter(Boolean).join(', '),
          [
            { text: 'Keep mine', style: 'cancel', onPress: fillEmpty },
            { text: 'Use it', onPress: () => update((d) => ({ location: { ...(d.location || {}), ...found, coordinates } })) },
          ],
        );
      } else {
        fillEmpty();
      }
      Toast.show({ type: 'success', text1: 'Map pin set', text2: 'Check the address below.' });
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't get your location", text2: 'Check that location is on and try again outdoors.' });
    } finally {
      setLocating(null);
    }
  };

  // Not at the property: find the pin from the typed address.
  const pinFromAddress = async () => {
    const query = [loc.address || loc.formattedAddress, loc.locality, loc.city, loc.state, loc.pincode, 'India'].filter(Boolean).join(', ');
    if (!loc.city && !loc.pincode) {
      Toast.show({ type: 'error', text1: 'Add the city or PIN code first' });
      return;
    }
    setLocating('address');
    try {
      if (!(await askPermission())) return;
      const results = await Location.geocodeAsync(query);
      const first = results[0];
      if (!first) throw new Error('not found');
      setLocation({ coordinates: { lat: Number(first.latitude.toFixed(6)), lng: Number(first.longitude.toFixed(6)) } });
      Toast.show({ type: 'success', text1: 'Pin set from the address', text2: 'Check it on the map; it may be a little off.' });
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't find that address", text2: 'Add the area and PIN code, or use your location at the property.' });
    } finally {
      setLocating(null);
    }
  };

  const openMap = () => {
    if (!hasPin) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {});
  };

  const changeRentalMode = (mode: string) => {
    if (mode === draft.rentalMode) return;
    const apply = () => update({ rentalMode: mode, roomTypes: [newRoomType(mode === 'entire_place' ? 'entire_place' : 'private')] });
    const priced = (draft.roomTypes || []).some((r) => Number(r.price?.perNight) > 0);
    if (!priced) return apply();
    Alert.alert('Start the rooms again?', "This replaces the rooms you've added with a fresh setup.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace rooms', style: 'destructive', onPress: apply },
    ]);
  };

  const stateOptions = [
    ...INDIAN_STATES.map((s) => ({ value: s.name, label: s.name })),
    ...(loc.state && !INDIAN_STATES.some((s) => s.name === loc.state) ? [{ value: loc.state, label: loc.state }] : []),
  ];
  const descLen = (draft.description || '').length;
  const stars = Number(draft.starRating) || 0;

  return (
    <View>
      <Section title="Where is it?" hint="Standing at the entrance? Use your location: it drops the map pin and fills in the address. Guests get the full address after they book.">
        <Button
          title={hasPin ? 'Update pin to my current location' : 'Use my current location'}
          onPress={useHere}
          loading={locating === 'here'}
          disabled={!!locating}
          icon={<Ionicons name="locate" size={18} color="#fff" />}
          fullWidth
        />
        {hasPin ? (
          <View style={[styles.pinRow, { backgroundColor: p.soft.green.bg, borderColor: p.soft.green.border }]}>
            <Ionicons name="location" size={18} color={p.soft.green.fg} />
            <View style={styles.flex}>
              <Text style={[styles.pinTitle, { color: p.soft.green.fg }]}>Map pin set</Text>
              <Text style={[styles.pinCoords, { color: p.soft.green.fg }]}>
                {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
              </Text>
            </View>
            <TouchableOpacity onPress={openMap} accessibilityRole="link" accessibilityLabel="Check the pin on Google Maps" hitSlop={8}>
              <Text style={[styles.pinLink, { color: p.brand }]}>Check on map</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Banner tone="amber">Guests need a map pin to find you. Use your location at the property, or type the address and find the pin from it.</Banner>
        )}
      </Section>

      <Section title="Address">
        <TextInput
          label="Street address"
          value={loc.address || loc.formattedAddress || ''}
          onChangeText={(t) => setLocation({ address: t, formattedAddress: t })}
          placeholder="Building, street, landmark"
          maxLength={300}
          autoComplete="street-address"
        />
        <TextInput
          label="Area / locality"
          value={loc.locality || ''}
          onChangeText={(t) => setLocation({ locality: t })}
          placeholder="e.g. Virupapur Gadde"
          maxLength={120}
        />
        <TextInput
          label="City / town *"
          value={loc.city || ''}
          onChangeText={(t) => setLocation({ city: t })}
          placeholder="e.g. Hampi"
          maxLength={120}
        />
        <SelectField label="State" value={loc.state || ''} options={stateOptions} onChange={(v) => setLocation({ state: v })} placeholder="Choose state" />
        <TextInput
          label="PIN code"
          value={loc.pincode || ''}
          onChangeText={(t) => setLocation({ pincode: t.replace(/[^\d]/g, '').slice(0, 6) })}
          placeholder="6 digits"
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="postal-code"
        />
        <Button
          title={hasPin ? 'Move the pin to this address' : 'Find the pin from this address'}
          variant="outline"
          onPress={pinFromAddress}
          loading={locating === 'address'}
          disabled={!!locating}
          icon={<Ionicons name="search" size={16} color={colors.primary[500]} />}
          fullWidth
        />
      </Section>

      <Section title="Property name" hint="The name guests see. Use the name on your signboard.">
        <TextInput
          value={draft.name || ''}
          onChangeText={(t) => update({ name: t })}
          maxLength={80}
          placeholder="e.g. Boulders Edge Homestay"
          hint={`${(draft.name || '').length}/80`}
          accessibilityLabel="Property name"
          containerStyle={styles.noGap}
        />
      </Section>

      <Section title="Type of property">
        <SelectField
          value={draft.propertyType}
          options={TYPE_OPTIONS}
          onChange={(v) => update({ propertyType: v })}
          sheetTitle="Type of property"
          compact
        />
      </Section>

      {category === 'home' ? (
        <Section title="How do guests stay?">
          <View style={styles.cards} accessibilityRole="radiogroup">
            <OptionCard
              selected={draft.rentalMode === 'entire_place'}
              onPress={() => changeRentalMode('entire_place')}
              title="The whole place"
              hint="Guests have the entire villa, flat or cottage to themselves."
            />
            <OptionCard
              selected={draft.rentalMode === 'rooms'}
              onPress={() => changeRentalMode('rooms')}
              title="Private rooms"
              hint="Guests book rooms; you or others may share the home."
            />
          </View>
          {draft.propertyType === 'homestay' ? (
            <View style={[styles.hostRow, { backgroundColor: p.soft.gray.bg }]}>
              <Text style={[styles.hostText, { color: p.c.text }]}>Do you or your family live here?</Text>
              <Segmented
                size="sm"
                label="Host lives on site"
                value={draft.hostOnSite === true ? 'yes' : draft.hostOnSite === false ? 'no' : null}
                onChange={(v) => update({ hostOnSite: v === 'yes' })}
                options={[
                  { id: 'yes', label: 'Yes' },
                  { id: 'no', label: 'No' },
                ]}
              />
            </View>
          ) : null}
        </Section>
      ) : null}

      {category === 'hotel' ? (
        <Section title="Star rating" hint="Only if your property is classified, or you're confident guests would agree. Leave it if not.">
          <View style={styles.starsRow} accessibilityRole="radiogroup" accessibilityLabel="Star rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => update({ starRating: stars === n ? 0 : n })}
                accessibilityRole="radio"
                accessibilityState={{ checked: stars === n }}
                accessibilityLabel={`${n} star`}
                hitSlop={4}
                style={styles.starBtn}
              >
                <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={30} color="#f59e0b" />
              </TouchableOpacity>
            ))}
            <Text style={[styles.starText, { color: p.c.textSecondary }]}>{stars > 0 ? `${stars} star` : 'Not rated'}</Text>
          </View>
        </Section>
      ) : null}

      <Section title="Describe your place" hint={DESCRIPTION_HINTS[category || 'hotel']}>
        <TextInput
          value={draft.description || ''}
          onChangeText={(t) => update({ description: t })}
          maxLength={3000}
          multiline
          textAlignVertical="top"
          style={styles.textarea}
          placeholder="e.g. A family-run homestay across the river from Hampi's temples. Rooms open onto a paddy field, breakfast is home-cooked, and the bus stand is a 5-minute walk."
          hint={`${descLen < 80 ? '2–3 lines is enough. ' : ''}${descLen}/3000`}
          accessibilityLabel="Description"
          containerStyle={styles.noGap}
        />
      </Section>

      <Section title="Contact for guests" hint="Shared with guests only after they book, for directions and check-in.">
        <TextInput
          label="Phone number *"
          value={draft.guestContact?.phone || ''}
          onChangeText={(t) => update((d) => ({ guestContact: { ...(d.guestContact || {}), phone: t } }))}
          placeholder="+91 98450 12345"
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={20}
        />
        <TextInput
          label="Email (optional)"
          value={draft.guestContact?.email || ''}
          onChangeText={(t) => update((d) => ({ guestContact: { ...(d.guestContact || {}), email: t } }))}
          placeholder="frontdesk@yourstay.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          maxLength={120}
        />
        <SwitchRow
          label="Guests can reach this number on WhatsApp"
          value={draft.guestContact?.whatsapp !== false}
          onChange={(v) => update((d) => ({ guestContact: { ...(d.guestContact || {}), whatsapp: v } }))}
        />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  noGap: { marginBottom: 0 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md },
  pinTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  pinCoords: { fontSize: fontSize.xs, marginTop: 1 },
  pinLink: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  cards: { gap: spacing.sm },
  hostRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md },
  hostText: { flex: 1, minWidth: 160, fontSize: fontSize.sm },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap' },
  starBtn: { padding: 4 },
  starText: { marginLeft: spacing.sm, fontSize: fontSize.sm },
  textarea: { minHeight: 130 },
});
