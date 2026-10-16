// The Isha composer. It stays usable while Isha answers: anything sent then
// waits and goes when she's done. Stop cancels the reply in flight.
import React, { forwardRef, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsha } from './ishaTheme';
import { MAX_MESSAGE_LENGTH, useChatStore } from './useChatStore';
import type { ChatContext } from './types';

// What the page chip calls the page the user came from
function pageLabel(context: ChatContext) {
  const entity = context?.pageEntity;
  if (entity?.name) return entity.kind === 'destination' ? entity.name : `this ${entity.kind}`;
  return null;
}

const ChatInput = forwardRef<TextInput, { isOnline: boolean }>(function ChatInput({ isOnline }, ref) {
  const t = useIsha();
  const inputMessage = useChatStore((s) => s.inputMessage);
  const setInputMessage = useChatStore((s) => s.setInputMessage);
  const isSending = useChatStore((s) => s.isSending);
  const queuedMessage = useChatStore((s) => s.queuedMessage);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const mode = useChatStore((s) => s.mode);
  const agentName = useChatStore((s) => s.assignedAgent?.name || null);
  const chatContext = useChatStore((s) => s.chatContext);
  const shareContext = useChatStore((s) => s.shareContext);
  const [focused, setFocused] = useState(false);

  const tooLong = inputMessage.length > MAX_MESSAGE_LENGTH;
  const hasContent = inputMessage.trim().length > 0;
  const canSend = hasContent && !tooLong;
  const withPerson = mode === 'human' || mode === 'queued';
  const page = pageLabel(chatContext);

  const submit = useCallback(() => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    useChatStore.getState().sendMessage(inputMessage);
  }, [canSend, inputMessage]);

  const placeholder = withPerson
    ? `Message ${agentName || 'the Prayana team'}`
    : !isOnline
      ? "Keep typing. It sends when you're back."
      : hasMessages
        ? 'Ask a follow-up…'
        : 'Ask about places, plans, cabs, eSIMs…';

  // One line of status under the text, most important first
  let status: React.ReactNode = null;
  if (queuedMessage || (isSending && hasContent)) {
    status = (
      <View style={styles.status}>
        <Ionicons name="time-outline" size={14} color={t.muted} />
        <Text style={[styles.statusText, { color: t.muted }]}>Sends when Isha finishes</Text>
      </View>
    );
  } else if (!isOnline) {
    status = (
      <View style={styles.status}>
        <Ionicons name="cloud-offline-outline" size={14} color={t.warnIcon} />
        <Text style={[styles.statusText, { color: t.warnText }]}>Offline. Messages wait until you're back.</Text>
      </View>
    );
  } else if (page && !withPerson) {
    status = shareContext ? (
      <View style={[styles.pageChip, { backgroundColor: t.sunken }]}>
        <Ionicons name="eye-outline" size={14} color={t.body} />
        <Text style={[styles.statusText, { color: t.body, flexShrink: 1 }]} numberOfLines={1}>
          Isha can see {page}
        </Text>
        <Pressable
          onPress={() => useChatStore.getState().setShareContext(false)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Stop sharing this page with Isha"
          style={styles.pageChipX}
        >
          <Ionicons name="close" size={13} color={t.muted} />
        </Pressable>
      </View>
    ) : (
      <Pressable onPress={() => useChatStore.getState().setShareContext(true)} accessibilityRole="button" style={styles.status} hitSlop={6}>
        <Ionicons name="eye-off-outline" size={14} color={t.muted} />
        <Text style={[styles.statusText, { color: t.muted }]}>Page hidden from Isha · Share it</Text>
      </Pressable>
    );
  }

  const showCount = inputMessage.length > MAX_MESSAGE_LENGTH - 100;
  // Nothing under the text: one line, with the send button beside it
  const compact = !status && !showCount && !isSending;

  const sendButton = (!isSending || hasContent) && (
    <Pressable
      onPress={submit}
      disabled={!canSend}
      accessibilityRole="button"
      accessibilityLabel={isSending ? 'Send when Isha finishes' : 'Send message'}
      accessibilityState={{ disabled: !canSend }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.send,
        { backgroundColor: canSend ? t.ink : t.inkDisabledBg },
        pressed && canSend && { opacity: 0.85, transform: [{ scale: 0.94 }] },
      ]}
    >
      <Ionicons name="arrow-up" size={19} color={canSend ? t.onInk : t.inkDisabledText} />
    </Pressable>
  );

  const stopButton = isSending && (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        useChatStore.getState().stopGenerating();
      }}
      accessibilityRole="button"
      accessibilityLabel="Stop Isha's reply"
      style={({ pressed }) => [styles.stop, { backgroundColor: t.ink }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.stopSquare, { backgroundColor: t.onInk }]} />
      <Text style={[styles.stopText, { color: t.onInk }]}>Stop</Text>
    </Pressable>
  );

  return (
    <View>
      <View
        style={[
          styles.box,
          {
            backgroundColor: t.surface,
            borderColor: tooLong ? t.danger : focused ? t.faint : t.borderStrong,
            shadowColor: t.shadow,
          },
          compact ? styles.boxCompact : styles.boxFull,
        ]}
      >
        <TextInput
          ref={ref}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder={placeholder}
          placeholderTextColor={t.placeholder}
          multiline
          maxLength={2000}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Message Isha"
          textAlignVertical="center"
          style={[styles.input, { color: t.text }, compact ? styles.inputCompact : styles.inputFull]}
        />
        {compact ? (
          sendButton
        ) : (
          <View style={styles.bar}>
            <View style={{ flex: 1, minWidth: 0 }}>{status}</View>
            {showCount && (
              <Text style={[styles.count, { color: tooLong ? t.danger : t.faint, fontWeight: tooLong ? '600' : '400' }]}>
                {inputMessage.length}/{MAX_MESSAGE_LENGTH}
              </Text>
            )}
            {stopButton}
            {sendButton}
          </View>
        )}
      </View>
      {tooLong && (
        <Text accessibilityRole="alert" style={[styles.limit, { color: t.danger }]}>
          Keep it under {MAX_MESSAGE_LENGTH} characters, or send it in two parts.
        </Text>
      )}
    </View>
  );
});

export default ChatInput;

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  boxCompact: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  boxFull: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  input: { fontSize: 16, lineHeight: 22, maxHeight: 132, padding: 0 },
  inputCompact: { flex: 1, minHeight: 36, paddingTop: 7, paddingBottom: 7 },
  inputFull: { minHeight: 26 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 12 },
  pageChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingLeft: 8, paddingRight: 4, borderRadius: 999, alignSelf: 'flex-start', maxWidth: '100%' },
  pageChipX: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 12, fontVariant: ['tabular-nums'] },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: 12, paddingRight: 14, borderRadius: 18 },
  stopSquare: { width: 10, height: 10, borderRadius: 2 },
  stopText: { fontSize: 13, fontWeight: '500' },
  limit: { fontSize: 12, marginTop: 6, paddingHorizontal: 4 },
});
