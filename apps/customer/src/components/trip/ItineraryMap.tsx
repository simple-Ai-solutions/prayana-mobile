import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, shadow } from '@prayana/shared-ui';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Place {
  name: string;
  description?: string;
  coordinates?: { lat: number; lng: number };
  time?: string;
  visitDuration?: string;
}

interface ItineraryMapProps {
  places: Place[];
  visible: boolean;
  onClose: () => void;
  dayTitle?: string;
  /** Render inline (no modal) */
  inline?: boolean;
  /** Height when inline (default 300) */
  height?: number;
  /** Destination name for context display */
  destinationName?: string;
}

const MARKER_COLORS = ['#FF6B6B', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];

function isValidCoord(p: Place) {
  return (
    p.coordinates &&
    p.coordinates.lat !== 0 &&
    p.coordinates.lng !== 0 &&
    !isNaN(p.coordinates.lat) &&
    !isNaN(p.coordinates.lng)
  );
}

export const ItineraryMap: React.FC<ItineraryMapProps> = ({
  places,
  visible,
  onClose,
  dayTitle,
  inline = false,
  height = 300,
  destinationName,
}) => {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const validPlaces = useMemo(
    () => places.filter(isValidCoord),
    [places]
  );

  const pendingPlaces = useMemo(
    () => places.filter((p) => !isValidCoord(p)),
    [places]
  );

  const hasAnyCoords = validPlaces.length > 0;
  const allFetching = places.length > 0 && validPlaces.length === 0;

  const initialRegion = useMemo(() => {
    if (validPlaces.length === 0) {
      return { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 10, longitudeDelta: 10 };
    }

    const lats = validPlaces.map((p) => p.coordinates!.lat);
    const lngs = validPlaces.map((p) => p.coordinates!.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.02) * 1.5,
      longitudeDelta: Math.max(maxLng - minLng, 0.02) * 1.5,
    };
  }, [validPlaces]);

  useEffect(() => {
    if (!mapReady) return;
    const shouldFit = inline ? validPlaces.length > 1 : visible && validPlaces.length > 1;
    if (shouldFit && mapRef.current) {
      const coords = validPlaces.map((p) => ({
        latitude: p.coordinates!.lat,
        longitude: p.coordinates!.lng,
      }));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 40, bottom: 40, left: 40 },
          animated: true,
        });
      }, 500);
    }
  }, [visible, validPlaces, inline, mapReady]);

  // ─── Pending Places Banner ───
  const renderPendingBanner = () => {
    if (pendingPlaces.length === 0) return null;
    return (
      <View style={styles.pendingBanner}>
        <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginRight: 6 }} />
        <Text style={styles.pendingBannerText}>
          Fetching coordinates for {pendingPlaces.length} place{pendingPlaces.length > 1 ? 's' : ''}…
        </Text>
      </View>
    );
  };

  // ─── No Coordinates State (all places pending) ───
  const renderFetchingState = () => (
    <View style={styles.fetchingContainer}>
      <ActivityIndicator size="large" color={colors.primary[500]} />
      <Text style={styles.fetchingTitle}>Locating Places on Map</Text>
      <Text style={styles.fetchingSubtitle}>
        Fetching coordinates for {places.length} place{places.length > 1 ? 's' : ''}
        {destinationName ? ` in ${destinationName}` : ''}…
      </Text>
      <View style={styles.fetchingList}>
        {places.slice(0, 6).map((p, i) => (
          <View key={i} style={styles.fetchingListItem}>
            <View style={[styles.fetchingDot, { backgroundColor: MARKER_COLORS[i % MARKER_COLORS.length] }]} />
            <Text style={styles.fetchingListText} numberOfLines={1}>{p.name}</Text>
            <ActivityIndicator size="small" color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
          </View>
        ))}
        {places.length > 6 && (
          <Text style={styles.fetchingMore}>+{places.length - 6} more</Text>
        )}
      </View>
    </View>
  );

  // ─── Inline Mode ───
  if (inline) {
    return (
      <View style={[styles.inlineContainer, { height }]}>
        {allFetching ? (
          renderFetchingState()
        ) : hasAnyCoords ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              showsUserLocation
              showsCompass
              onMapReady={() => setMapReady(true)}
            >
              {validPlaces.map((place, index) => (
                <Marker
                  key={`marker-${index}`}
                  coordinate={{
                    latitude: place.coordinates!.lat,
                    longitude: place.coordinates!.lng,
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerBadge, { backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length] }]}>
                      <Text style={styles.markerNumber}>{index + 1}</Text>
                    </View>
                  </View>
                  <Callout tooltip>
                    <View style={[styles.calloutContainer, shadow.lg]}>
                      <Text style={styles.calloutTitle}>{place.name}</Text>
                      {place.description && (
                        <Text style={styles.calloutDescription} numberOfLines={2}>
                          {place.description}
                        </Text>
                      )}
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>
            {renderPendingBanner()}
          </>
        ) : (
          <View style={styles.inlineEmpty}>
            <Ionicons name="map-outline" size={32} color={colors.gray[300]} />
            <Text style={styles.inlineEmptyText}>No coordinates available yet</Text>
          </View>
        )}
      </View>
    );
  }

  // ─── Full-screen Modal Mode ───
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, shadow.md]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {dayTitle || 'Itinerary Map'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {validPlaces.length} of {places.length} {places.length === 1 ? 'place' : 'places'} located
            </Text>
          </View>
        </View>

        {/* Map or Fetching State */}
        {allFetching ? (
          renderFetchingState()
        ) : hasAnyCoords ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={initialRegion}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              showsUserLocation
              showsMyLocationButton
              showsCompass
              onMapReady={() => setMapReady(true)}
            >
              {validPlaces.map((place, index) => (
                <Marker
                  key={`marker-${index}`}
                  coordinate={{
                    latitude: place.coordinates!.lat,
                    longitude: place.coordinates!.lng,
                  }}
                  pinColor={MARKER_COLORS[index % MARKER_COLORS.length]}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.markerBadge, { backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length] }]}>
                      <Text style={styles.markerNumber}>{index + 1}</Text>
                    </View>
                  </View>
                  <Callout tooltip>
                    <View style={[styles.calloutContainer, shadow.lg]}>
                      <Text style={styles.calloutTitle}>{place.name}</Text>
                      {place.time && (
                        <Text style={styles.calloutTime}>{place.time}</Text>
                      )}
                      {place.description && (
                        <Text style={styles.calloutDescription} numberOfLines={2}>
                          {place.description}
                        </Text>
                      )}
                    </View>
                  </Callout>
                </Marker>
              ))}
            </MapView>

            {/* Pending banner overlay */}
            {renderPendingBanner()}

            {/* Place Legend */}
            <View style={[styles.legend, shadow.lg]}>
              {validPlaces.slice(0, 6).map((place, index) => (
                <View key={`legend-${index}`} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: MARKER_COLORS[index % MARKER_COLORS.length] }]}>
                    <Text style={styles.legendDotText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.legendText} numberOfLines={1}>
                    {place.name}
                  </Text>
                </View>
              ))}
              {validPlaces.length > 6 && (
                <Text style={styles.legendMore}>+{validPlaces.length - 6} more</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Coordinates Available</Text>
            <Text style={styles.emptySubtitle}>
              Places in this day don't have location data yet.
              Try generating the structured timeline first.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Inline
  inlineContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[50],
    gap: spacing.sm,
  },
  inlineEmptyText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },

  // Map
  map: {
    flex: 1,
  },

  // Pending banner (overlays map bottom)
  pendingBanner: {
    position: 'absolute',
    top: 12,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  pendingBannerText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    flex: 1,
  },

  // Fetching state (full screen / full inline)
  fetchingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    backgroundColor: colors.gray[50],
  },
  fetchingTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  fetchingSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  fetchingList: {
    width: '100%',
    gap: spacing.sm,
  },
  fetchingListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fetchingDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  fetchingListText: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  fetchingMore: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Markers
  markerContainer: {
    alignItems: 'center',
  },
  markerBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  markerNumber: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // Callout
  calloutContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: spacing.md,
    minWidth: 150,
    maxWidth: 220,
  },
  calloutTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: 2,
  },
  calloutTime: {
    fontSize: fontSize.xs,
    color: '#FF6B6B',
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  calloutDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Legend
  legend: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendDotText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  legendText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: fontWeight.medium,
    maxWidth: 100,
  },
  legendMore: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});

export default ItineraryMap;
