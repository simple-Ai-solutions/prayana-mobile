import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors, borderRadius, fontSize, fontWeight } from './theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const avatarColors = [
  colors.primary[500],
  '#8b5cf6',
  '#06B6D4',
  '#ec4899',
  '#10b981',
  '#6366f1',
];

function getColorForName(name?: string): string {
  if (!name) return avatarColors[0];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

export function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
        contentFit="cover"
        transition={200}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getColorForName(name),
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: size * 0.4,
          fontWeight: fontWeight.bold,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
