import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, fontSize, fontWeight, shadow, useTheme } from '@prayana/shared-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_SCROLL_SPEED = 1;
const AUTO_SCROLL_INTERVAL = 50;

interface EmbeddedChatWidgetProps {
  locationName: string;
}

export const EmbeddedChatWidget: React.FC<EmbeddedChatWidgetProps> = ({
  locationName,
}) => {
  const { isDarkMode, themeColors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [inputValue, setInputValue] = useState('');
  const scrollPositionRef = useRef(0);
  const maxScrollRef = useRef(0);
  const isPausedRef = useRef(false);

  // 10 contextual suggestions
  const suggestions = useMemo(
    () => [
      `Build a trip to ${locationName} with AI`,
      `Best time to visit ${locationName}?`,
      `Where can I stay in ${locationName}?`,
      `Local food specialties of ${locationName}`,
      `How to reach ${locationName}?`,
      `Budget for ${locationName} trip`,
      `Hidden gems in ${locationName}`,
      `${locationName} in 3 days itinerary`,
      `Shopping in ${locationName}`,
      `Safety tips for ${locationName}`,
    ],
    [locationName]
  );

  // Duplicate for seamless looping
  const duplicatedSuggestions = useMemo(
    () => [...suggestions, ...suggestions],
    [suggestions]
  );

  // Auto-scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPausedRef.current) return;

      scrollPositionRef.current += AUTO_SCROLL_SPEED;

      // Reset to beginning when we've scrolled through the first set
      if (
        maxScrollRef.current > 0 &&
        scrollPositionRef.current >= maxScrollRef.current / 2
      ) {
        scrollPositionRef.current = 0;
      }

      scrollRef.current?.scrollTo({
        x: scrollPositionRef.current,
        animated: false,
      });
    }, AUTO_SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const handleTouchStart = useCallback(() => {
    isPausedRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Resume after a brief pause to allow for tap interactions
    setTimeout(() => {
      isPausedRef.current = false;
    }, 2000);
  }, []);

  const handleContentSizeChange = useCallback(
    (contentWidth: number) => {
      maxScrollRef.current = contentWidth;
    },
    []
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollPositionRef.current = event.nativeEvent.contentOffset.x;
    },
    []
  );

  const navigateToChat = useCallback(
    (message: string) => {
      router.push({
        pathname: '/chat',
        params: {
          initialMessage: message,
          context: locationName,
        },
      });
    },
    [router, locationName]
  );

  const handleSuggestionPress = useCallback(
    (suggestion: string) => {
      navigateToChat(suggestion);
    },
    [navigateToChat]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    navigateToChat(trimmed);
    setInputValue('');
  }, [inputValue, navigateToChat]);

  const hasInput = inputValue.trim().length > 0;

  return (
    <View style={[styles.outerContainer, { paddingHorizontal: spacing.lg }]}>
      {/* Gradient Border Effect */}
      <LinearGradient
        colors={[colors.primary[500], colors.primary[700]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View
          style={[
            styles.container,
            { backgroundColor: themeColors.card },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={[colors.primary[500], colors.primary[600]]}
              style={styles.sparkleIcon}
            >
              <Ionicons name="sparkles" size={18} color="#ffffff" />
            </LinearGradient>

            <View style={styles.headerTextContainer}>
              <Text
                style={[styles.headerTitle, { color: themeColors.text }]}
                numberOfLines={1}
              >
                Ask about {locationName}
              </Text>
            </View>

            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI</Text>
            </View>
          </View>

          {/* Suggestion Pills - Auto-scrolling */}
          <View style={styles.suggestionsContainer}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onContentSizeChange={handleContentSizeChange}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.suggestionsContent}
            >
              {duplicatedSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`suggestion-${index}`}
                  onPress={() => handleSuggestionPress(suggestion)}
                  style={[
                    styles.suggestionPill,
                    {
                      backgroundColor: isDarkMode
                        ? '#1F2937'
                        : '#F3F4F6',
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.suggestionText,
                      { color: themeColors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Area */}
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                borderColor: themeColors.border,
              },
            ]}
          >
            <TextInput
              style={[
                styles.textInput,
                { color: themeColors.text },
              ]}
              placeholder={`Ask anything about ${locationName}...`}
              placeholderTextColor={themeColors.textTertiary}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
              multiline={false}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!hasInput}
              style={[
                styles.sendButton,
                hasInput
                  ? styles.sendButtonActive
                  : [
                      styles.sendButtonInactive,
                      {
                        backgroundColor: isDarkMode
                          ? '#374151'
                          : '#E5E7EB',
                      },
                    ],
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={hasInput ? '#ffffff' : themeColors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingVertical: spacing.lg,
  },
  gradientBorder: {
    borderRadius: 18,
    padding: 2,
    ...shadow.lg,
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sparkleIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  aiBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  aiBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  suggestionsContainer: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
  },
  suggestionsContent: {
    paddingHorizontal: spacing.lg,
    gap: 8,
  },
  suggestionPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 0, // gap handles spacing
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.md,
    paddingVertical: 8,
    minHeight: 36,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary[500],
  },
  sendButtonInactive: {},
});

export default EmbeddedChatWidget;
