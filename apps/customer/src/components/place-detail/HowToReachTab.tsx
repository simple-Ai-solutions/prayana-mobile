import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, useTheme } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';

interface HowToReachTabProps {
  placeName: string;
  location: string;
  coordinates?: { lat: number; lng: number } | null;
}

// Color themes per transport section — matches PWA
const SECTION_THEMES = {
  airports: { bg: '#EFF6FF', border: '#3B82F6', icon: '#3B82F6', darkBg: '#1E293B' },
  railways: { bg: '#ECFDF5', border: '#10B981', icon: '#10B981', darkBg: '#1E293B' },
  road: { bg: '#FFF7ED', border: '#F97316', icon: '#F97316', darkBg: '#1E293B' },
  local: { bg: '#F5F3FF', border: '#8B5CF6', icon: '#8B5CF6', darkBg: '#1E293B' },
  water: { bg: '#F0F9FF', border: '#06B6D4', icon: '#06B6D4', darkBg: '#1E293B' },
};

export const HowToReachTab: React.FC<HowToReachTabProps> = ({
  placeName,
  location,
  coordinates,
}) => {
  const { themeColors, isDarkMode } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['airports']));

  useEffect(() => {
    const fetchTransport = async () => {
      try {
        setLoading(true);
        // Use destination-transportation endpoint (same as PWA) for rich structured data
        const res = await makeAPICall('/destinations/destination-transportation', {
          method: 'POST',
          body: JSON.stringify({ location: location.trim() }),
          timeout: 60000,
        });

        const responseData = res?.data || res;
        if (responseData && typeof responseData === 'object' && responseData.success !== false) {
          // The endpoint returns { success, data, metadata }
          // data contains: airports[], railways[], roadAccess{}, localTransport{}, waterTransport[]
          const transportData = responseData.data || responseData;
          setData(transportData);
          console.log('[HowToReach] Data loaded — airports:', transportData.airports?.length || 0,
            'railways:', transportData.railways?.length || 0);
        } else {
          // Fallback to legacy transportation endpoint
          console.warn('[HowToReach] destination-transportation failed, trying fallback');
          const fallback = await makeAPICall('/destinations/transportation', {
            method: 'POST',
            body: JSON.stringify({ placeName: placeName.trim(), location: location.trim() }),
            timeout: 60000,
          });
          const fbData = fallback?.data || fallback;
          if (fbData && typeof fbData === 'object') {
            setData(fbData.transportation || fbData.data?.transportation || fbData.data || fbData);
          } else {
            setError('No transportation data available');
          }
        }
      } catch (err: any) {
        console.warn('[HowToReach] Error:', err.message);
        setError('Could not load transportation info');
      } finally {
        setLoading(false);
      }
    };
    fetchTransport();
  }, [placeName, location]);

  const openInMaps = () => {
    if (coordinates) {
      Linking.openURL(`https://maps.google.com/?q=${coordinates.lat},${coordinates.lng}`);
    } else {
      Linking.openURL(
        `https://maps.google.com/?q=${encodeURIComponent(placeName + ' ' + location)}`
      );
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Loading transportation info...
        </Text>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <View style={[styles.errorCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
          <Ionicons name="alert-circle-outline" size={24} color={themeColors.textSecondary} />
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
            {error || 'No transportation information available'}
          </Text>
        </View>
        <TouchableOpacity style={styles.mapsButton} onPress={openInMaps} activeOpacity={0.8}>
          <Ionicons name="navigate" size={20} color="#ffffff" />
          <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const airports = data.airports || [];
  const railways = data.railways || [];
  const roadAccess = data.roadAccess || {};
  const localTransport = data.localTransport || {};
  const waterTransport = data.waterTransport || [];

  const hasAirports = airports.length > 0;
  const hasRailways = railways.length > 0;
  const hasRoad = roadAccess.majorRoutes?.length > 0 || roadAccess.busServices?.length > 0 || roadAccess.nationalHighways?.length > 0;
  const hasLocal = localTransport.buses?.available || localTransport.autoRickshaw?.available || localTransport.taxi?.available || localTransport.metro?.available;
  const hasWater = waterTransport.length > 0;

  const renderSectionHeader = (
    key: string,
    icon: string,
    title: string,
    subtitle: string,
    theme: typeof SECTION_THEMES.airports,
    count?: number,
  ) => {
    const isExpanded = expandedSections.has(key);
    return (
      <TouchableOpacity
        style={[
          styles.sectionCard,
          {
            backgroundColor: isDarkMode ? theme.darkBg : theme.bg,
            borderColor: isExpanded ? theme.border : isDarkMode ? '#374151' : '#E5E7EB',
          },
        ]}
        onPress={() => toggleSection(key)}
        activeOpacity={0.8}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: `${theme.icon}15` }]}>
            <Ionicons name={icon as any} size={22} color={theme.icon} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
            <Text style={[styles.sectionSubtitle, { color: themeColors.textTertiary }]}>{subtitle}</Text>
          </View>
          {count !== undefined && count > 0 && (
            <View style={[styles.countPill, { backgroundColor: `${theme.icon}20` }]}>
              <Text style={[styles.countPillText, { color: theme.icon }]}>{count}</Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={themeColors.textTertiary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderInfoRow = (label: string, value: string | undefined, icon?: string) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        {icon && <Ionicons name={icon as any} size={14} color={themeColors.textTertiary} />}
        <Text style={[styles.infoLabel, { color: themeColors.textTertiary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: themeColors.text }]}>{value}</Text>
      </View>
    );
  };

  const renderPills = (items: string[], color: string) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.pillsRow}>
        {items.slice(0, 6).map((item, i) => (
          <View key={i} style={[styles.pill, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
            <Text style={[styles.pillText, { color }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="navigate" size={20} color={colors.primary[500]} />
        <Text style={[styles.mainTitle, { color: themeColors.text }]}>How to Reach</Text>
      </View>

      {data.city && (
        <Text style={[styles.cityLabel, { color: themeColors.textSecondary }]}>
          Transportation options for {data.city}{data.state ? `, ${data.state}` : ''}
        </Text>
      )}

      {/* ===== AIRPORTS ===== */}
      {hasAirports && (
        <>
          {renderSectionHeader('airports', 'airplane', 'By Air', 'Nearest airports', SECTION_THEMES.airports, airports.length)}
          {expandedSections.has('airports') && (
            <View style={[styles.sectionContent, { borderColor: isDarkMode ? '#374151' : SECTION_THEMES.airports.border + '30' }]}>
              {airports.map((airport: any, idx: number) => (
                <View key={idx} style={[styles.itemCard, idx > 0 && styles.itemCardBorder, { borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemName, { color: themeColors.text }]}>
                      {airport.name}
                    </Text>
                    {airport.code && (
                      <View style={[styles.codeBadge, { backgroundColor: SECTION_THEMES.airports.icon + '15' }]}>
                        <Text style={[styles.codeText, { color: SECTION_THEMES.airports.icon }]}>{airport.code}</Text>
                      </View>
                    )}
                  </View>
                  {airport.type && (
                    <Text style={[styles.itemType, { color: themeColors.textTertiary }]}>
                      {airport.type.charAt(0).toUpperCase() + airport.type.slice(1)} Airport
                    </Text>
                  )}
                  {renderInfoRow('Distance', airport.distanceFromCity, 'location-outline')}
                  {renderInfoRow('Travel Time', airport.travelTimeToCity, 'time-outline')}
                  {airport.averageCost?.airportTaxi && renderInfoRow('Taxi', airport.averageCost.airportTaxi, 'car-outline')}
                  {airport.averageCost?.airportBus && renderInfoRow('Bus', airport.averageCost.airportBus, 'bus-outline')}
                  {airport.majorAirlines?.length > 0 && (
                    <View style={styles.subsection}>
                      <Text style={[styles.subsectionLabel, { color: themeColors.textTertiary }]}>Airlines</Text>
                      {renderPills(airport.majorAirlines.slice(0, 4), SECTION_THEMES.airports.icon)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* ===== RAILWAYS ===== */}
      {hasRailways && (
        <>
          {renderSectionHeader('railways', 'train', 'By Train', 'Railway stations', SECTION_THEMES.railways, railways.length)}
          {expandedSections.has('railways') && (
            <View style={[styles.sectionContent, { borderColor: isDarkMode ? '#374151' : SECTION_THEMES.railways.border + '30' }]}>
              {railways.map((station: any, idx: number) => (
                <View key={idx} style={[styles.itemCard, idx > 0 && styles.itemCardBorder, { borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemName, { color: themeColors.text }]}>
                      {station.stationName || station.name}
                    </Text>
                    {station.stationCode && (
                      <View style={[styles.codeBadge, { backgroundColor: SECTION_THEMES.railways.icon + '15' }]}>
                        <Text style={[styles.codeText, { color: SECTION_THEMES.railways.icon }]}>{station.stationCode}</Text>
                      </View>
                    )}
                  </View>
                  {station.type && (
                    <Text style={[styles.itemType, { color: themeColors.textTertiary }]}>
                      {station.type.charAt(0).toUpperCase() + station.type.slice(1)} Station
                    </Text>
                  )}
                  {renderInfoRow('Distance', station.distanceFromCity, 'location-outline')}
                  {/* Fare classes */}
                  {station.averageCost && (
                    <View style={styles.fareGrid}>
                      {station.averageCost.sleeper && (
                        <View style={[styles.fareCard, { backgroundColor: isDarkMode ? '#374151' : '#F0FDF4' }]}>
                          <Text style={[styles.fareLabel, { color: themeColors.textTertiary }]}>Sleeper</Text>
                          <Text style={[styles.fareValue, { color: SECTION_THEMES.railways.icon }]}>{station.averageCost.sleeper}</Text>
                        </View>
                      )}
                      {station.averageCost.ac3tier && (
                        <View style={[styles.fareCard, { backgroundColor: isDarkMode ? '#374151' : '#F0FDF4' }]}>
                          <Text style={[styles.fareLabel, { color: themeColors.textTertiary }]}>AC 3-Tier</Text>
                          <Text style={[styles.fareValue, { color: SECTION_THEMES.railways.icon }]}>{station.averageCost.ac3tier}</Text>
                        </View>
                      )}
                      {station.averageCost.ac2tier && (
                        <View style={[styles.fareCard, { backgroundColor: isDarkMode ? '#374151' : '#F0FDF4' }]}>
                          <Text style={[styles.fareLabel, { color: themeColors.textTertiary }]}>AC 2-Tier</Text>
                          <Text style={[styles.fareValue, { color: SECTION_THEMES.railways.icon }]}>{station.averageCost.ac2tier}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* Connectivity */}
                  {station.connectivity?.length > 0 && (
                    <View style={styles.subsection}>
                      <Text style={[styles.subsectionLabel, { color: themeColors.textTertiary }]}>Connected Cities</Text>
                      {renderPills(station.connectivity.slice(0, 6), SECTION_THEMES.railways.icon)}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* ===== ROAD ACCESS ===== */}
      {hasRoad && (
        <>
          {renderSectionHeader('road', 'car', 'By Road', 'Highways & bus services', SECTION_THEMES.road)}
          {expandedSections.has('road') && (
            <View style={[styles.sectionContent, { borderColor: isDarkMode ? '#374151' : SECTION_THEMES.road.border + '30' }]}>
              {/* National Highways */}
              {roadAccess.nationalHighways?.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionLabel, { color: themeColors.textTertiary }]}>National Highways</Text>
                  {renderPills(roadAccess.nationalHighways, SECTION_THEMES.road.icon)}
                </View>
              )}

              {/* Major Routes */}
              {roadAccess.majorRoutes?.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionLabel, { color: themeColors.textTertiary }]}>Major Routes</Text>
                  {roadAccess.majorRoutes.slice(0, 4).map((route: any, idx: number) => (
                    <View key={idx} style={[styles.routeCard, { backgroundColor: isDarkMode ? '#374151' : '#FFF7ED' }]}>
                      <View style={styles.routeHeader}>
                        <Text style={[styles.routeDest, { color: themeColors.text }]}>
                          {route.destination}
                        </Text>
                        <Text style={[styles.routeDistance, { color: SECTION_THEMES.road.icon }]}>
                          {route.distance}
                        </Text>
                      </View>
                      <View style={styles.routeDetails}>
                        {route.travelTime && (
                          <View style={styles.routeDetailItem}>
                            <Ionicons name="time-outline" size={12} color={themeColors.textTertiary} />
                            <Text style={[styles.routeDetailText, { color: themeColors.textSecondary }]}>{route.travelTime}</Text>
                          </View>
                        )}
                        {route.tollCost && (
                          <View style={styles.routeDetailItem}>
                            <Ionicons name="cash-outline" size={12} color={themeColors.textTertiary} />
                            <Text style={[styles.routeDetailText, { color: themeColors.textSecondary }]}>{route.tollCost}</Text>
                          </View>
                        )}
                        {route.roadCondition && (
                          <View style={styles.routeDetailItem}>
                            <Ionicons name="shield-checkmark-outline" size={12} color={themeColors.textTertiary} />
                            <Text style={[styles.routeDetailText, { color: themeColors.textSecondary }]}>{route.roadCondition}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Bus Services */}
              {roadAccess.busServices?.length > 0 && (
                <View style={styles.subsection}>
                  <Text style={[styles.subsectionLabel, { color: themeColors.textTertiary }]}>Bus Services</Text>
                  {roadAccess.busServices.map((bus: any, idx: number) => (
                    <View key={idx} style={[styles.busCard, { backgroundColor: isDarkMode ? '#374151' : '#FFF7ED' }]}>
                      <Text style={[styles.busOperator, { color: themeColors.text }]}>
                        {bus.operator} {bus.type ? `(${bus.type})` : ''}
                      </Text>
                      {bus.averageCost && (
                        <Text style={[styles.busCost, { color: SECTION_THEMES.road.icon }]}>{bus.averageCost}</Text>
                      )}
                      {bus.frequency && (
                        <Text style={[styles.busFrequency, { color: themeColors.textTertiary }]}>{bus.frequency}</Text>
                      )}
                      {bus.connectivity?.length > 0 && renderPills(bus.connectivity.slice(0, 4), SECTION_THEMES.road.icon)}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {/* ===== LOCAL TRANSPORT ===== */}
      {hasLocal && (
        <>
          {renderSectionHeader('local', 'bus', 'Local Transport', 'Getting around the city', SECTION_THEMES.local)}
          {expandedSections.has('local') && (
            <View style={[styles.sectionContent, { borderColor: isDarkMode ? '#374151' : SECTION_THEMES.local.border + '30' }]}>
              <View style={styles.localGrid}>
                {/* Metro */}
                {localTransport.metro?.available && (
                  <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#F5F3FF' }]}>
                    <Ionicons name="subway-outline" size={20} color={SECTION_THEMES.local.icon} />
                    <Text style={[styles.localTitle, { color: themeColors.text }]}>Metro</Text>
                    {localTransport.metro.operatorName && (
                      <Text style={[styles.localDetail, { color: themeColors.textSecondary }]}>{localTransport.metro.operatorName}</Text>
                    )}
                    {localTransport.metro.totalStations > 0 && (
                      <Text style={[styles.localDetail, { color: themeColors.textTertiary }]}>{localTransport.metro.totalStations} stations</Text>
                    )}
                    {localTransport.metro.fareRange && (
                      <Text style={[styles.localFare, { color: SECTION_THEMES.local.icon }]}>{localTransport.metro.fareRange}</Text>
                    )}
                  </View>
                )}

                {/* Buses */}
                {localTransport.buses?.available && (
                  <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#F5F3FF' }]}>
                    <Ionicons name="bus-outline" size={20} color={SECTION_THEMES.local.icon} />
                    <Text style={[styles.localTitle, { color: themeColors.text }]}>Buses</Text>
                    {localTransport.buses.operators?.length > 0 && (
                      <Text style={[styles.localDetail, { color: themeColors.textSecondary }]}>{localTransport.buses.operators.join(', ')}</Text>
                    )}
                    {localTransport.buses.fareRange && (
                      <Text style={[styles.localFare, { color: SECTION_THEMES.local.icon }]}>{localTransport.buses.fareRange}</Text>
                    )}
                  </View>
                )}

                {/* Auto Rickshaw */}
                {localTransport.autoRickshaw?.available && (
                  <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#F5F3FF' }]}>
                    <Ionicons name="car-sport-outline" size={20} color={SECTION_THEMES.local.icon} />
                    <Text style={[styles.localTitle, { color: themeColors.text }]}>Auto Rickshaw</Text>
                    {localTransport.autoRickshaw.averageCostPerKm && (
                      <Text style={[styles.localDetail, { color: themeColors.textSecondary }]}>{localTransport.autoRickshaw.averageCostPerKm}</Text>
                    )}
                    {localTransport.autoRickshaw.minimumFare && (
                      <Text style={[styles.localFare, { color: SECTION_THEMES.local.icon }]}>Min: {localTransport.autoRickshaw.minimumFare}</Text>
                    )}
                  </View>
                )}

                {/* Taxi */}
                {localTransport.taxi?.available && (
                  <View style={[styles.localCard, { backgroundColor: isDarkMode ? '#374151' : '#F5F3FF' }]}>
                    <Ionicons name="car-outline" size={20} color={SECTION_THEMES.local.icon} />
                    <Text style={[styles.localTitle, { color: themeColors.text }]}>Taxi / Cab</Text>
                    {localTransport.taxi.services?.length > 0 && (
                      <Text style={[styles.localDetail, { color: themeColors.textSecondary }]}>{localTransport.taxi.services.slice(0, 3).join(', ')}</Text>
                    )}
                    {localTransport.taxi.averageCostPerKm && (
                      <Text style={[styles.localDetail, { color: themeColors.textTertiary }]}>{localTransport.taxi.averageCostPerKm}</Text>
                    )}
                    {localTransport.taxi.minimumFare && (
                      <Text style={[styles.localFare, { color: SECTION_THEMES.local.icon }]}>Min: {localTransport.taxi.minimumFare}</Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        </>
      )}

      {/* ===== WATER TRANSPORT ===== */}
      {hasWater && (
        <>
          {renderSectionHeader('water', 'boat', 'By Water', 'Ferries & boat services', SECTION_THEMES.water, waterTransport.length)}
          {expandedSections.has('water') && (
            <View style={[styles.sectionContent, { borderColor: isDarkMode ? '#374151' : SECTION_THEMES.water.border + '30' }]}>
              {waterTransport.map((ferry: any, idx: number) => (
                <View key={idx} style={[styles.itemCard, idx > 0 && styles.itemCardBorder, { borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <Text style={[styles.itemName, { color: themeColors.text }]}>{ferry.name}</Text>
                  {ferry.route && <Text style={[styles.itemType, { color: themeColors.textTertiary }]}>{ferry.route}</Text>}
                  {renderInfoRow('Operator', ferry.operator, 'business-outline')}
                  {renderInfoRow('Duration', ferry.duration, 'time-outline')}
                  {renderInfoRow('Frequency', ferry.frequency, 'repeat-outline')}
                  {renderInfoRow('Cost', ferry.cost, 'cash-outline')}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* No transport data at all */}
      {!hasAirports && !hasRailways && !hasRoad && !hasLocal && !hasWater && (
        <View style={[styles.errorCard, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB', borderColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
          <Ionicons name="information-circle-outline" size={24} color={themeColors.textSecondary} />
          <Text style={[styles.errorText, { color: themeColors.textSecondary }]}>
            Detailed transportation info is being prepared. Try again later.
          </Text>
        </View>
      )}

      {/* Open in Maps */}
      <TouchableOpacity style={styles.mapsButton} onPress={openInMaps} activeOpacity={0.8}>
        <Ionicons name="navigate" size={20} color="#ffffff" />
        <Text style={styles.mapsButtonText}>Open in Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  loadingContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.md },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mainTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  cityLabel: { fontSize: fontSize.sm, marginBottom: spacing.lg },

  // Section card (expandable header)
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionSubtitle: { fontSize: fontSize.xs, marginTop: 1 },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countPillText: { fontSize: 11, fontWeight: fontWeight.bold },

  // Section content (expanded)
  sectionContent: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  // Item cards (airport, railway station, etc.)
  itemCard: {
    paddingVertical: spacing.sm,
  },
  itemCardBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  itemName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1 },
  itemType: { fontSize: fontSize.xs, marginBottom: spacing.sm, textTransform: 'capitalize' },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: { fontSize: 11, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, width: 70 },
  infoValue: { fontSize: fontSize.sm, flex: 1 },

  // Subsections
  subsection: { marginTop: spacing.sm },
  subsectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // Pills
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontSize: 11, fontWeight: fontWeight.medium },

  // Fare grid
  fareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  fareCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 90,
  },
  fareLabel: { fontSize: 10, fontWeight: fontWeight.medium, marginBottom: 2 },
  fareValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Road routes
  routeCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: 8,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  routeDest: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  routeDistance: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  routeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  routeDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  routeDetailText: { fontSize: fontSize.xs },

  // Bus cards
  busCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: 8,
  },
  busOperator: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: 4 },
  busCost: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: 2 },
  busFrequency: { fontSize: fontSize.xs, marginBottom: 6 },

  // Local transport grid
  localGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  localCard: {
    width: '48%' as any,
    padding: spacing.md,
    borderRadius: 12,
    gap: 4,
  },
  localTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginTop: 2 },
  localDetail: { fontSize: fontSize.xs },
  localFare: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 2 },

  // Error & maps
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  errorText: { flex: 1, fontSize: fontSize.md },

  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.md + 2,
    borderRadius: 14,
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  mapsButtonText: { color: '#ffffff', fontWeight: fontWeight.semibold, fontSize: fontSize.md },
});

export default HowToReachTab;
