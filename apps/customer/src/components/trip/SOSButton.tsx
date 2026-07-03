import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  Share,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';

interface SOSButtonProps {
  destinationName?: string;
}

interface EmergencyNumbers {
  country: string;
  police: string;
  ambulance: string;
  fire: string;
  tourist?: string;
}

// Country-aware emergency numbers
const EMERGENCY_DB: Record<string, EmergencyNumbers> = {
  india: { country: 'India', police: '100', ambulance: '108', fire: '101', tourist: '1363' },
  thailand: { country: 'Thailand', police: '191', ambulance: '1669', fire: '199', tourist: '1155' },
  japan: { country: 'Japan', police: '110', ambulance: '119', fire: '119' },
  usa: { country: 'USA', police: '911', ambulance: '911', fire: '911' },
  uk: { country: 'UK', police: '999', ambulance: '999', fire: '999' },
  australia: { country: 'Australia', police: '000', ambulance: '000', fire: '000' },
  france: { country: 'France', police: '17', ambulance: '15', fire: '18' },
  germany: { country: 'Germany', police: '110', ambulance: '112', fire: '112' },
  italy: { country: 'Italy', police: '113', ambulance: '118', fire: '115' },
  spain: { country: 'Spain', police: '091', ambulance: '061', fire: '080' },
  singapore: { country: 'Singapore', police: '999', ambulance: '995', fire: '995' },
  malaysia: { country: 'Malaysia', police: '999', ambulance: '999', fire: '994' },
  indonesia: { country: 'Indonesia', police: '110', ambulance: '118', fire: '113' },
  vietnam: { country: 'Vietnam', police: '113', ambulance: '115', fire: '114' },
  nepal: { country: 'Nepal', police: '100', ambulance: '102', fire: '101', tourist: '1144' },
  srilanka: { country: 'Sri Lanka', police: '119', ambulance: '110', fire: '110' },
};

const DEFAULT_NUMBERS: EmergencyNumbers = {
  country: 'International',
  police: '112',
  ambulance: '112',
  fire: '112',
};

function detectCountry(destination?: string): EmergencyNumbers {
  if (!destination) return DEFAULT_NUMBERS;
  const lower = destination.toLowerCase();

  // Check direct matches
  for (const [key, data] of Object.entries(EMERGENCY_DB)) {
    if (lower.includes(key)) return data;
  }

  // Common Indian destinations
  const indianCities = ['mumbai', 'delhi', 'bangalore', 'goa', 'jaipur', 'hampi', 'manali', 'shimla', 'kerala', 'rajasthan', 'varanasi', 'agra', 'kolkata', 'chennai', 'hyderabad', 'udaipur', 'rishikesh', 'darjeeling', 'ooty', 'mysore', 'kochi', 'munnar'];
  if (indianCities.some((c) => lower.includes(c))) return EMERGENCY_DB.india;

  return DEFAULT_NUMBERS;
}

const SOSButton: React.FC<SOSButtonProps> = ({ destinationName }) => {
  const sheetRef = useRef<BottomModalRef>(null);
  const [sharingLocation, setSharingLocation] = useState(false);

  const emergency = useMemo(() => detectCountry(destinationName), [destinationName]);

  const handleCall = useCallback((number: string) => {
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Cannot Call', 'Phone calls are not available on this device')
    );
  }, []);

  const handleShareLocation = useCallback(async () => {
    setSharingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Needed', 'Location permission is required to share your location.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude.toFixed(6);
      const lng = loc.coords.longitude.toFixed(6);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

      await Share.share({
        message: `SOS - I need help!\n\nMy location: ${mapsUrl}\nCoordinates: ${lat}, ${lng}\n${destinationName ? `Destination: ${destinationName}` : ''}\n\nSent via Prayana AI`,
      });
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('Error', 'Could not get your location');
      }
    } finally {
      setSharingLocation(false);
    }
  }, [destinationName]);

  const emergencyServices = [
    { icon: 'shield', label: 'Police', number: emergency.police, color: '#3B82F6' },
    { icon: 'medkit', label: 'Ambulance', number: emergency.ambulance, color: '#EF4444' },
    { icon: 'flame', label: 'Fire', number: emergency.fire, color: '#F59E0B' },
    ...(emergency.tourist ? [{ icon: 'information-circle', label: 'Tourist Helpline', number: emergency.tourist, color: '#10B981' }] : []),
  ];

  return (
    <>
      {/* Floating SOS FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => sheetRef.current?.expand()}
        activeOpacity={0.8}
      >
        <Ionicons name="alert-circle" size={20} color="#ffffff" />
      </TouchableOpacity>

      {/* SOS Bottom Sheet */}
      <BottomModal ref={sheetRef}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="alert-circle" size={22} color="#ffffff" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Emergency SOS</Text>
            <Text style={styles.headerSubtitle}>{emergency.country} emergency numbers</Text>
          </View>
          <TouchableOpacity onPress={() => sheetRef.current?.close()}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <BottomModalScrollView contentContainerStyle={styles.content}>
          {/* Emergency numbers */}
          {emergencyServices.map((svc, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.serviceCard}
              onPress={() => handleCall(svc.number)}
              activeOpacity={0.7}
            >
              <View style={[styles.serviceIcon, { backgroundColor: svc.color + '20' }]}>
                <Ionicons name={svc.icon as any} size={22} color={svc.color} />
              </View>
              <View style={styles.serviceContent}>
                <Text style={styles.serviceLabel}>{svc.label}</Text>
                <Text style={styles.serviceNumber}>{svc.number}</Text>
              </View>
              <View style={[styles.callBtn, { backgroundColor: svc.color }]}>
                <Ionicons name="call" size={16} color="#ffffff" />
              </View>
            </TouchableOpacity>
          ))}

          {/* Share location */}
          <TouchableOpacity
            style={styles.shareLocationBtn}
            onPress={handleShareLocation}
            disabled={sharingLocation}
            activeOpacity={0.8}
          >
            <Ionicons
              name={sharingLocation ? 'hourglass-outline' : 'location'}
              size={18}
              color="#ffffff"
            />
            <Text style={styles.shareLocationText}>
              {sharingLocation ? 'Getting Location...' : 'Share My Location'}
            </Text>
          </TouchableOpacity>
        </BottomModalScrollView>
      </BottomModal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  headerSubtitle: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  serviceContent: { flex: 1 },
  serviceLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  serviceNumber: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: 2 },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  shareLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    marginTop: spacing.sm,
    ...shadow.md,
  },
  shareLocationText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#ffffff' },
});

export default SOSButton;
