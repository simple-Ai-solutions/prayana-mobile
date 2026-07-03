import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';

interface WeatherBadgeProps {
  destinationName: string;
}

interface WeatherData {
  temperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
}

// Open-Meteo weather codes to icon/label
const WEATHER_CODES: Record<number, { icon: string; label: string }> = {
  0: { icon: 'sunny', label: 'Clear' },
  1: { icon: 'partly-sunny', label: 'Mostly Clear' },
  2: { icon: 'partly-sunny', label: 'Partly Cloudy' },
  3: { icon: 'cloudy', label: 'Overcast' },
  45: { icon: 'cloudy', label: 'Foggy' },
  48: { icon: 'cloudy', label: 'Rime Fog' },
  51: { icon: 'rainy', label: 'Light Drizzle' },
  53: { icon: 'rainy', label: 'Drizzle' },
  55: { icon: 'rainy', label: 'Heavy Drizzle' },
  61: { icon: 'rainy', label: 'Light Rain' },
  63: { icon: 'rainy', label: 'Rain' },
  65: { icon: 'rainy', label: 'Heavy Rain' },
  71: { icon: 'snow', label: 'Light Snow' },
  73: { icon: 'snow', label: 'Snow' },
  75: { icon: 'snow', label: 'Heavy Snow' },
  80: { icon: 'rainy', label: 'Rain Showers' },
  81: { icon: 'rainy', label: 'Moderate Showers' },
  82: { icon: 'thunderstorm', label: 'Heavy Showers' },
  95: { icon: 'thunderstorm', label: 'Thunderstorm' },
  96: { icon: 'thunderstorm', label: 'Hail Storm' },
  99: { icon: 'thunderstorm', label: 'Heavy Hail' },
};

// Cache: destination → weather data + timestamp
const weatherCache = new Map<string, { data: WeatherData; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 min

const WeatherBadge: React.FC<WeatherBadgeProps> = ({ destinationName }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!destinationName) {
      setLoading(false);
      return;
    }

    const cached = weatherCache.get(destinationName);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setWeather(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchWeather = async () => {
      try {
        // Step 1: Geocode destination using Open-Meteo geocoding
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(destinationName)}&count=1&language=en`
        );
        const geoData = await geoRes.json();

        if (!geoData.results?.[0]) throw new Error('Location not found');

        const { latitude, longitude } = geoData.results[0];

        // Step 2: Fetch current weather
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`
        );
        const weatherData = await weatherRes.json();

        if (cancelled) return;

        const current = weatherData.current;
        const data: WeatherData = {
          temperature: Math.round(current.temperature_2m),
          weatherCode: current.weather_code,
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          feelsLike: Math.round(current.apparent_temperature),
        };

        setWeather(data);
        weatherCache.set(destinationName, { data, ts: Date.now() });
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWeather();
    return () => { cancelled = true; };
  }, [destinationName]);

  const weatherInfo = useMemo(() => {
    if (!weather) return null;
    return WEATHER_CODES[weather.weatherCode] || { icon: 'partly-sunny', label: 'Unknown' };
  }, [weather]);

  if (loading || !weather || !weatherInfo) return null;

  return (
    <TouchableOpacity
      style={[styles.badge, expanded && styles.badgeExpanded]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <Ionicons name={weatherInfo.icon as any} size={14} color={colors.primary[600]} />
      <Text style={styles.tempText}>{weather.temperature}°</Text>
      {expanded && (
        <View style={styles.expandedInfo}>
          <Text style={styles.weatherLabel}>{weatherInfo.label}</Text>
          <Text style={styles.detailText}>Feels {weather.feelsLike}° | {weather.humidity}% | {weather.windSpeed}km/h</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  badgeExpanded: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    ...shadow.lg,
  },
  tempText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  expandedInfo: {
    gap: 2,
    marginTop: spacing.xs,
  },
  weatherLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  detailText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
});

export default React.memo(WeatherBadge);
