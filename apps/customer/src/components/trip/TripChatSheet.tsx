import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import BottomModal, { BottomModalRef } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { socketService } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import { useCreateTripStore } from '@prayana/shared-stores';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
}

interface TripChatSheetProps {
  sheetRef: React.RefObject<BottomModalRef | null>;
}

const USER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

const TripChatSheet: React.FC<TripChatSheetProps> = ({ sheetRef }) => {
  const { user } = useAuth();
  const tripId = useCreateTripStore((s) => s.tripId);
  const tempTripId = useCreateTripStore((s) => s.tempTripId);
  const activeTripId = tripId || tempTripId;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const isOpenRef = useRef(false);

  // Listen for chat messages
  useEffect(() => {
    if (!activeTripId) return;

    const handleMessage = (data: any) => {
      const msg: ChatMessage = {
        id: `${data.userId}-${Date.now()}-${Math.random()}`,
        userId: data.userId,
        userName: data.userName || data.displayName || 'Anonymous',
        message: data.message,
        timestamp: data.timestamp || Date.now(),
      };

      setMessages((prev) => [...prev, msg]);

      if (!isOpenRef.current) {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socketService.on('chat-message', handleMessage);

    return () => {
      socketService.off('chat-message', handleMessage);
    };
  }, [activeTripId]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !activeTripId || !user) return;

    const message = inputText.trim();
    setInputText('');

    // Send via socket
    socketService.sendChatMessage(activeTripId, message);

    // Add locally immediately
    const localMsg: ChatMessage = {
      id: `${user.uid}-${Date.now()}`,
      userId: user.uid,
      userName: user.displayName || 'You',
      message,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, localMsg]);

    // Auto-scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, activeTripId, user]);

  const handleSheetChange = useCallback((index: number) => {
    isOpenRef.current = index >= 0;
    if (index >= 0) {
      setUnreadCount(0);
    }
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.userId === user?.uid;

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={[styles.msgAvatar, { backgroundColor: getUserColor(item.userId) }]}>
            <Text style={styles.msgAvatarText}>
              {item.userName[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.msgSender}>{item.userName}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>
            {item.message}
          </Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      {/* Chat FAB with unread badge */}
      <TouchableOpacity
        style={styles.chatFab}
        onPress={() => sheetRef.current?.expand()}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubbles" size={20} color="#ffffff" />
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <BottomModal ref={sheetRef} onChange={handleSheetChange}>
        <View style={styles.header}>
          <Ionicons name="chatbubbles" size={20} color={colors.primary[500]} />
          <Text style={styles.headerTitle}>Trip Chat</Text>
          <TouchableOpacity onPress={() => sheetRef.current?.close()}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.gray[300]} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSubtext}>
                Start a conversation with your travel companions
              </Text>
            </View>
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim()}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={18}
                color={inputText.trim() ? '#ffffff' : colors.gray[400]}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </BottomModal>
    </>
  );
};

const styles = StyleSheet.create({
  chatFab: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.lg,
    zIndex: 50,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  messagesList: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  bubbleMe: {
    backgroundColor: colors.primary[500],
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: 4,
  },
  msgSender: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  msgText: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 20,
  },
  msgTextMe: {
    color: '#ffffff',
  },
  msgTime: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  msgTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyChatText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  emptyChatSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray[200],
  },
});

export default TripChatSheet;
