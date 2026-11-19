// "Good evening, Tejas · ⛅ 24° Bengaluru" — a glass pill at the top of the
// hero. The greeting follows the time of day and the first name on the
// account (just "Good evening" for guests). The weather is live from
// Open-Meteo (free, no key; the trip screens use it too) for the city the
// app already detected; it's left out when there's no city or no answer,
// never guessed.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@prayana/shared-hooks';
import { locationDetectionService } from '@prayana/shared-services';

type Weather = { temp: number; icon: any; city: string };

const ICONS: [number[], any][] = [
  [[0], 'sunny'],
  [[1, 2], 'partly-sunny'],
  [[3, 45, 48], 'cloudy'],
  [[51, 53, 55, 61, 63, 65, 80, 81], 'rainy'],
  [[71, 73, 75], 'snow'],
  [[82, 95, 96, 99], 'thunderstorm'],
];
function iconFor(code: number, isDay: boolean): any {
  const hit = ICONS.find(([codes]) => codes.includes(code))?.[1] || 'partly-sunny';
  if (!isDay && (hit === 'sunny' || hit === 'partly-sunny')) return hit === 'sunny' ? 'moon' : 'cloudy-night';
  return hit;
}

// One lookup per app session.
let cached: Promise<Weather | null> | null = null;
function loadWeather(): Promise<Weather | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const loc: any = await locationDetectionService.detectUserCountry();
        const city: string | undefined = loc?.city;
        if (!city) return null;
        const geo = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`,
        ).then((r) => r.json());
        const g = geo?.results?.[0];
        if (!g) return null;
        const w = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,weather_code,is_day`,
        ).then((r) => r.json());
        const c = w?.current;
        if (typeof c?.temperature_2m !== 'number') return null;
        return { temp: Math.round(c.temperature_2m), icon: iconFor(c.weather_code, c.is_day === 1), city };
      } catch {
        cached = null; // try again next time home mounts
        return null;
      }
    })();
  }
  return cached;
}

function greetingFor(h: number) {
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeGreeting() {
  const { user } = useAuth();
  const [weather, setWeather] = useState<Weather | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    loadWeather().then((w) => alive && setWeather(w));
    Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    return () => { alive = false; };
  }, [fade]);

  const first =
    user && user.uid !== 'guest-user' && user.displayName ? String(user.displayName).trim().split(/\s+/)[0] : '';
  const hello = `${greetingFor(new Date().getHours())}${first ? `, ${first}` : ''}`;

  return (
    <Animated.View
      style={[styles.pill, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}
      accessibilityRole="text"
      accessibilityLabel={weather ? `${hello}. ${weather.temp} degrees in ${weather.city}` : hello}
    >
      <Text style={styles.hello} numberOfLines={1}>{hello} 👋</Text>
      {weather && (
        <>
          <View style={styles.sep} />
          <Ionicons name={weather.icon} size={14} color="#FCD34D" />
          <Text style={styles.weather} numberOfLines={1}>{weather.temp}° {weather.city}</Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    marginBottom: 14,
  },
  hello: { color: '#fff', fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  sep: { width: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.35)', marginHorizontal: 2 },
  weather: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '600' },
});

export default HomeGreeting;
