import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useIsha, type IshaPalette } from '../ishaTheme';
import { useChatStore } from '../useChatStore';

type ToolProps = {
  t: IshaPalette;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color?: string;
  label: string;
  onPress: () => void;
  selected?: boolean;
};

function ToolButton({ t, icon, color, label, onPress, selected }: ToolProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={({ pressed }) => [styles.btn, pressed && { backgroundColor: t.sunken }]}
    >
      <Ionicons name={icon} size={17} color={color || t.faint} />
    </Pressable>
  );
}

/** Copy, rate and (on the latest reply) regenerate. */
export default function ReplyToolbar({ content, isLatest }: { content: string; isLatest: boolean }) {
  const t = useIsha();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(content);
      Haptics.selectionAsync().catch(() => {});
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      Toast.show({ type: 'error', text1: "Couldn't copy that" });
    }
  }, [content]);

  const rate = (value: 'up' | 'down') => {
    setFeedback((prev) => (prev === value ? null : value));
    if (feedback !== value) {
      Toast.show({
        type: 'success',
        text1: value === 'up' ? 'Thanks for the feedback' : "Thanks. We'll use this to improve Isha",
        visibilityTime: 2000,
      });
    }
  };

  return (
    <View style={styles.row}>
      <ToolButton t={t}
        icon={copied ? 'checkmark' : 'copy-outline'}
        color={copied ? t.success : undefined}
        label={copied ? 'Copied' : 'Copy reply'}
        onPress={copy}
      />
      <ToolButton t={t}
        icon={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
        color={feedback === 'up' ? t.success : undefined}
        label="Good reply"
        selected={feedback === 'up'}
        onPress={() => rate('up')}
      />
      <ToolButton t={t}
        icon={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
        color={feedback === 'down' ? t.danger : undefined}
        label="Bad reply"
        selected={feedback === 'down'}
        onPress={() => rate('down')}
      />
      {isLatest && (
        <ToolButton t={t} icon="refresh" label="Regenerate reply" onPress={() => useChatStore.getState().regenerateLastResponse()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -8 },
  btn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
