import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { colors, fontWeight } from './theme';

interface RequiredLabelProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

// A field label that flags a required field with a red asterisk. Use it in place
// of a plain <Text> label and keep the label text itself asterisk-free — the "*"
// is appended here so it's always the theme's error red, matching TextInput's
// own required-mark handling.
export function RequiredLabel({ children, style }: RequiredLabelProps) {
  return (
    <Text style={style}>
      {children}
      <Text style={{ color: colors.error, fontWeight: fontWeight.bold }}> *</Text>
    </Text>
  );
}
