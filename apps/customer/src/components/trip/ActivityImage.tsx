import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@prayana/shared-ui';
import { makeAPICall } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';

// In-memory cache: "activityName|destinationName" → resolved URL
const imageCache = new Map<string, string>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const cacheTimestamps = new Map<string, number>();

function getCacheKey(activityName: string, destinationName?: string): string {
  return `${activityName}|${destinationName || ''}`;
}

function getCachedUrl(key: string): string | null {
  const ts = cacheTimestamps.get(key);
  if (ts && Date.now() - ts > CACHE_TTL) {
    imageCache.delete(key);
    cacheTimestamps.delete(key);
    return null;
  }
  return imageCache.get(key) || null;
}

function setCachedUrl(key: string, url: string) {
  imageCache.set(key, url);
  cacheTimestamps.set(key, Date.now());
}

interface ActivityImageProps {
  activity: {
    name: string;
    image?: string;
    imageUrls?: string[];
    images?: any[];
    category?: string;
  };
  destinationName?: string;
  size?: number;
  borderRadius?: number;
  fallbackColor?: string;
  fallbackIconColor?: string;
  style?: any;
}

const ActivityImage: React.FC<ActivityImageProps> = ({
  activity,
  destinationName,
  size = 52,
  borderRadius = 10,
  fallbackColor = colors.gray[100],
  fallbackIconColor = colors.gray[400],
  style,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activity?.name) {
      setLoading(false);
      return;
    }

    const cacheKey = getCacheKey(activity.name, destinationName);

    // 1. Check in-memory cache
    const cached = getCachedUrl(cacheKey);
    if (cached) {
      setImageUrl(cached);
      setLoading(false);
      return;
    }

    // 2. Try extracting from activity data
    const existingUrl =
      getPlaceImageUrl(activity as any) ||
      resolveImageUrl(activity.image) ||
      resolveImageUrl(activity.imageUrls?.[0]) ||
      resolveImageUrl(activity.images?.[0]?.url || activity.images?.[0]) ||
      null;

    if (existingUrl) {
      setImageUrl(existingUrl);
      setCachedUrl(cacheKey, existingUrl);
      setLoading(false);
      return;
    }

    // 3. Fetch from place-images API
    let cancelled = false;
    const fetchImage = async () => {
      try {
        const res = await makeAPICall('/destinations/place-images', {
          method: 'POST',
          body: JSON.stringify({
            placeName: activity.name,
            location: destinationName || '',
            count: 1,
          }),
          timeout: 15000,
        });

        if (cancelled) return;

        const data = res?.data || res;
        const imgArr = Array.isArray(data) ? data : [];
        if (imgArr.length > 0) {
          const imgData = imgArr[0];
          const rawUrl =
            typeof imgData === 'string'
              ? imgData
              : imgData?.url ||
                imgData?.mediumUrl ||
                imgData?.smallUrl ||
                imgData?.s3Url ||
                imgData?.originalUrl ||
                null;
          if (rawUrl) {
            const resolved = resolveImageUrl(rawUrl) || rawUrl;
            setImageUrl(resolved);
            setCachedUrl(cacheKey, resolved);
          }
        }
      } catch (err: any) {
        // Silently fail - will show fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchImage();
    return () => {
      cancelled = true;
    };
  }, [activity?.name, destinationName]);

  const containerStyle = [
    { width: size, height: size, borderRadius },
    style,
  ];

  if (loading) {
    return (
      <View style={[...containerStyle, styles.placeholder, { backgroundColor: fallbackColor }]}>
        <ActivityIndicator size="small" color={colors.gray[300]} />
      </View>
    );
  }

  if (imageUrl && !error) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={containerStyle}
        contentFit="cover"
        transition={200}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback: gradient with icon
  return (
    <LinearGradient
      colors={[fallbackColor, fallbackColor]}
      style={[...containerStyle, styles.placeholder]}
    >
      <Ionicons
        name={getCategoryIcon(activity?.category)}
        size={size * 0.4}
        color={fallbackIconColor}
      />
    </LinearGradient>
  );
};

function getCategoryIcon(category?: string): keyof typeof Ionicons.glyphMap {
  switch (category?.toLowerCase()) {
    case 'temple':
    case 'religious':
      return 'business-outline';
    case 'museum':
    case 'cultural':
      return 'library-outline';
    case 'restaurant':
    case 'food':
    case 'cafe':
      return 'restaurant-outline';
    case 'beach':
      return 'water-outline';
    case 'park':
    case 'nature':
      return 'leaf-outline';
    case 'monument':
    case 'landmark':
      return 'flag-outline';
    case 'market':
    case 'shopping':
      return 'cart-outline';
    case 'adventure':
      return 'bicycle-outline';
    case 'nightlife':
      return 'moon-outline';
    case 'wellness':
    case 'spa':
      return 'heart-outline';
    case 'viewpoint':
      return 'eye-outline';
    default:
      return 'image-outline';
  }
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ActivityImage);
