// stores/useChatStore.js - COMPLETE VERSION with Solution 1
// NOTE: Browser-specific APIs (navigator.geolocation, window, localStorage) have been
// replaced with platform-agnostic stubs. In React Native, inject location/storage via
// the app layer or use expo-location / react-native-mmkv.

import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useChatStore = create()(
  devtools(
    (set, get) => ({
      // ===== CHAT UI STATE =====

      isChatOpen: false,
      isFullScreen: false,
      chatMode: "floating",
      messages: [],
      currentSessionId: null,
      inputMessage: "",
      isTyping: false,
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
      suggestions: [],
      activeSuggestions: [],
      chatContext: {
        destination: null,
        searchResults: [],
        itineraryId: null,
        currentView: "home",
        userLocation: null, // { lat, lng, city, country }
      },
      isConnected: false,
      connectionStatus: "disconnected",

      // ===== CONVERSATION HISTORY =====
      conversationHistory: [], // Array of saved conversations
      currentConversationId: null,

      // ===== GUEST USER TRACKING =====
      guestMessageCount: 0, // Track messages sent by guest users
      showLoginPrompt: false, // Show login prompt after 3 messages
      maxGuestMessages: 3, // Maximum messages before prompting login

      // ===== AI CHAT SERVICE LOADER =====
      // In React Native, this should be injected or set from the app layer
      _aiChatServiceLoader: null,

      setAIChatServiceLoader: (loader) =>
        set({ _aiChatServiceLoader: loader }, false, "setAIChatServiceLoader"),

      _loadAIChatService: async () => {
        const state = get();
        if (state._aiChatServiceLoader) {
          return state._aiChatServiceLoader();
        }
        throw new Error("AI Chat service loader not configured. Call setAIChatServiceLoader() first.");
      },

      // ===== CHAT ACTIONS =====

      openChat: async (mode = "floating", context = {}) => {
        set((state) => ({
          isChatOpen: true,
          chatMode: mode,
          chatContext: { ...state.chatContext, ...context },
          connectionStatus: "connecting",
        }), false, "openChat");

        try {
          // Try to get user location in the background
          get().getUserLocation().catch(err => {
            console.warn('Could not get user location, continuing without it:', err);
          });

          const { aiChatService } = await get()._loadAIChatService();

          const newContext = { ...get().chatContext, ...context };

          const sessionId = await aiChatService.startSession(newContext);

          set({
            currentSessionId: sessionId,
            connectionStatus: "connected",
            isConnected: true,
            activeSuggestions: get().generateSuggestions(mode, newContext),
          }, false, "chatConnected");

          console.log("Chat session started:", sessionId);

        } catch (error) {
          console.error("Failed to initialize chat:", error);

          const errorMessage = error.message || "Unknown error";
          console.error("Error details:", {
            name: error.name,
            message: errorMessage,
          });

          set({
            connectionStatus: "error",
            isConnected: false,
          }, false, "chatConnectionFailed");
        }
      },

      closeChat: async () => {
        const state = get();

        // Save conversation to history if there are messages
        if (state.messages.length > 0) {
          get().saveConversation();
        }

        if (state.currentSessionId) {
          try {
            const { aiChatService } = await get()._loadAIChatService();
            await aiChatService.endSession();
          } catch (error) {
            console.warn("Failed to end session properly:", error);
          }
        }

        set({
          isChatOpen: false,
          isFullScreen: false,
          currentSessionId: null,
          connectionStatus: "disconnected",
          isConnected: false,
          messages: [], // Clear messages when closing chat
          currentConversationId: null,
        }, false, "closeChat");
      },

      toggleChat: () => {
        const state = get();
        if (state.isChatOpen) {
          get().closeChat();
        } else {
          get().openChat(state.chatMode, state.chatContext);
        }
      },

      toggleFullScreen: () =>
        set((state) => ({
          isFullScreen: !state.isFullScreen
        }), false, "toggleFullScreen"),

      setFullScreen: (value) =>
        set({
          isFullScreen: value
        }, false, "setFullScreen"),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, {
            id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: message.timestamp || new Date().toISOString(),
            ...message,
          }],
        }), false, "addMessage"),

      updateLastMessage: (updates) =>
        set((state) => {
          if (state.messages.length === 0) return state;

          const updatedMessages = [...state.messages];
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            ...updates,
          };

          return { messages: updatedMessages };
        }, false, "updateLastMessage"),

      clearMessages: () =>
        set({
          messages: [],
        }, false, "clearMessages"),

      removeMessage: (messageId) =>
        set((state) => ({
          messages: state.messages.filter(msg => msg.id !== messageId),
        }), false, "removeMessage"),

      setInputMessage: (message) =>
        set({ inputMessage: message }, false, "setInputMessage"),

      setIsTyping: (typing) =>
        set({ isTyping: typing }, false, "setIsTyping"),

      setIsSending: (sending) =>
        set({ isSending: sending }, false, "setIsSending"),

      setIsStreaming: (streaming, messageId = null) =>
        set({ isStreaming: streaming, streamingMessageId: messageId }, false, "setIsStreaming"),

      // Stream text into a message progressively
      streamTextIntoMessage: (messageId, fullText, speed = 20) => {
        return new Promise((resolve) => {
          const state = get();
          let currentIndex = 0;

          // Set streaming state
          state.setIsStreaming(true, messageId);

          const streamInterval = setInterval(() => {
            const state = get();

            // Find the message
            const messageIndex = state.messages.findIndex(m => m.id === messageId);
            if (messageIndex === -1) {
              clearInterval(streamInterval);
              state.setIsStreaming(false, null);
              resolve();
              return;
            }

            // Calculate next chunk (stream 1-3 characters at a time for natural feel)
            const chunkSize = Math.floor(Math.random() * 3) + 1;
            currentIndex = Math.min(currentIndex + chunkSize, fullText.length);
            const displayedText = fullText.substring(0, currentIndex);

            // Update the message with streamed text
            const updatedMessages = [...state.messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: displayedText,
              isStreaming: currentIndex < fullText.length,
            };

            set({ messages: updatedMessages }, false, "streamText");

            // Check if done
            if (currentIndex >= fullText.length) {
              clearInterval(streamInterval);
              state.setIsStreaming(false, null);

              // Mark message as complete
              const finalMessages = [...get().messages];
              const finalMessageIndex = finalMessages.findIndex(m => m.id === messageId);
              if (finalMessageIndex !== -1) {
                finalMessages[finalMessageIndex] = {
                  ...finalMessages[finalMessageIndex],
                  isStreaming: false,
                };
                set({ messages: finalMessages }, false, "streamComplete");
              }

              resolve();
            }
          }, speed);
        });
      },

      updateChatContext: async (contextUpdates) => {
        set((state) => ({
          chatContext: { ...state.chatContext, ...contextUpdates },
          activeSuggestions: get().generateSuggestions(state.chatMode, {
            ...state.chatContext,
            ...contextUpdates,
          }),
        }), false, "updateChatContext");

        const state = get();
        if (state.currentSessionId && state.isConnected) {
          try {
            const { aiChatService } = await get()._loadAIChatService();
            await aiChatService.updateContext(contextUpdates);
          } catch (error) {
            console.warn("Failed to update backend context:", error);
          }
        }
      },

      setChatMode: (mode) =>
        set((state) => ({
          chatMode: mode,
          activeSuggestions: get().generateSuggestions(mode, state.chatContext),
        }), false, "setChatMode"),

      // Get user's current location
      // NOTE: In React Native, use expo-location or react-native-geolocation-service.
      // This is a stub that should be overridden from the app layer.
      getUserLocation: async () => {
        console.warn('getUserLocation: Not implemented for React Native. Override from app layer.');
        return null;
      },

      startNewSession: async () => {
        const state = get();

        try {
          const { aiChatService } = await get()._loadAIChatService();
          const sessionId = await aiChatService.startSession(state.chatContext);

          set({
            currentSessionId: sessionId,
            messages: [],
            connectionStatus: "connected",
            isConnected: true,
          }, false, "startNewSession");

          return sessionId;
        } catch (error) {
          console.error("Failed to start new session:", error);
          set({
            connectionStatus: "error",
            isConnected: false,
          }, false, "sessionStartFailed");
          throw error;
        }
      },

      setConnectionStatus: (status) =>
        set({
          connectionStatus: status,
          isConnected: status === "connected",
        }, false, "setConnectionStatus"),

      // ===== TRIP PLANNING ACTIONS =====

      showTripPlannerForm: () => {
        console.log('showTripPlannerForm called');
        const state = get();
        state.addMessage({
          role: "assistant",
          type: "trip_planner_form",
          content: "Let me help you plan an amazing trip!",
        });
      },

      // Generate itinerary - Show card as soon as markdown succeeds, then fetch structured data
      // NOTE: In React Native, the API import path will differ.
      // The makeItineraryAPICall should be injected or imported from shared-services.
      generateTripItinerary: async (formData) => {
        const state = get();

        state.setIsSending(true);

        // Add user message
        state.addMessage({
          role: "user",
          content: `Plan a ${formData.duration}-day trip to ${formData.destination}`,
        });

        // Add loading message
        state.addMessage({
          role: "assistant",
          type: "loading",
          content: "Creating your personalized travel guide...",
          isTemporary: true,
        });

        // Generate unique message ID for the itinerary card (so we can update it later)
        const itineraryMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
          // TODO: Import API from React Native services layer
          console.warn("generateTripItinerary: API import not configured for React Native yet");
          throw new Error("API not configured for React Native");
        } catch (error) {
          console.error("Itinerary generation failed:", error);

          const currentState = get();
          currentState.updateLastMessage({
            type: "error",
            content: `Sorry, I couldn't generate your itinerary. ${error.message}`,
            isTemporary: false,
          });

          set({ isSending: false });
        }
      },

      navigateToFullItinerary: (itineraryData, requestData) => {
        console.log('Navigating to full itinerary:', { itineraryData, requestData });

        // Extract both markdown and structured, but prioritize markdown for display
        const markdownData = itineraryData?.markdown || itineraryData;
        const structuredData = itineraryData?.structured || null;

        console.log('Markdown data:', markdownData);
        console.log('Structured data:', structuredData);

        // NOTE: In React Native, use navigation instead of window.dispatchEvent
        // This should be overridden from the app layer with React Navigation
        console.warn("navigateToFullItinerary: Navigation not configured for React Native yet");
      },

      // ===== SUGGESTION SYSTEM =====

      generateSuggestions: (mode, context) => {
        const baseSuggestions = {
          floating: [
            { id: "plan_trip", text: "Plan a trip", icon: "map", action: "plan_trip" },
            { id: "explore", text: "Explore destinations", icon: "globe", action: "explore_destinations" },
            { id: "popular", text: "Popular places", icon: "star", action: "show_popular" },
            { id: "weather", text: "Check weather", icon: "cloud", action: "check_weather" },
          ],

          contextual: [
            { id: "about_results", text: "About these places", icon: "pin", action: "explain_results" },
            { id: "compare", text: "Compare options", icon: "scale", action: "compare_places" },
            { id: "plan_here", text: "Plan trip here", icon: "map", action: "plan_trip_destination" },
            { id: "similar", text: "Find similar places", icon: "search", action: "find_similar" },
          ],

          itinerary: [
            { id: "modify_trip", text: "Modify this trip", icon: "edit", action: "modify_itinerary" },
            { id: "add_places", text: "Add more places", icon: "plus", action: "add_places" },
            { id: "transportation", text: "Transportation options", icon: "car", action: "show_transport" },
          ],
        };

        let suggestions = baseSuggestions[mode] || baseSuggestions.floating;

        if (context.destination) {
          suggestions = suggestions.map(s => {
            if (s.action === "check_weather") {
              return { ...s, text: `Weather in ${context.destination}` };
            }
            if (s.action === "plan_trip_destination") {
              return { ...s, text: `Plan trip to ${context.destination}` };
            }
            return s;
          });
        }

        return suggestions;
      },

      handleSuggestionClick: async (suggestion) => {
        const state = get();

        if (state.isSending) return;

        // Special handling for "Plan a trip"
        if (suggestion.action === "plan_trip" || suggestion.text.includes("Plan a trip")) {
          state.showTripPlannerForm();
          return;
        }

        // Special handling for "Travel tips"
        if (suggestion.action === "travel_tips") {
          await state.handleTravelTips();
          return;
        }

        state.addMessage({
          role: "user",
          content: suggestion.text,
          type: "suggestion",
          suggestionId: suggestion.id,
        });

        // Add a placeholder message for streaming
        const streamingMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        state.addMessage({
          id: streamingMessageId,
          role: "assistant",
          content: "",
          type: "response",
          isStreaming: true,
          isTemporary: false,
        });

        state.setIsSending(true);

        try {
          const { aiChatService } = await get()._loadAIChatService();

          const response = await aiChatService.handleSuggestionAction(
            suggestion.action,
            state.chatContext
          );

          // Stream the response text progressively
          await state.streamTextIntoMessage(streamingMessageId, response.message, 15);

          // After streaming is complete, update with additional data
          const messages = get().messages;
          const messageIndex = messages.findIndex(m => m.id === streamingMessageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              actions: response.actions || [],
              relatedPlaces: response.relatedPlaces || [],
              topPlaces: response.topPlaces || [],
              images: response.images || [],
              suggestions: response.suggestions || [],
              destinationData: response.destinationData || null,
            };
            set({ messages: updatedMessages }, false, "addSuggestionResponseData");
          }

          if (response.contextUpdates) {
            state.updateChatContext(response.contextUpdates);
          }

        } catch (error) {
          console.error("Suggestion handling error:", error);

          // Update the streaming message with error
          const messages = get().messages;
          const messageIndex = messages.findIndex(m => m.id === streamingMessageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: "I'm having trouble processing that request. Please try again or type a message.",
              type: "error",
              isStreaming: false,
            };
            set({ messages: updatedMessages }, false, "errorSuggestionResponse");
          }
        } finally {
          state.setIsSending(false);
        }
      },

      // ===== NEW FEATURE HANDLERS =====


      handleTravelTips: async () => {
        const state = get();

        if (state.isSending) return;

        state.setIsSending(true);

        // Use user's location or context destination
        const destination = state.chatContext.userLocation?.city || state.chatContext.destination || "your destination";

        // Add user message
        state.addMessage({
          role: "user",
          content: "Give me travel tips",
          type: "suggestion",
        });

        // Add loading message
        state.addMessage({
          role: "assistant",
          content: `Getting travel tips for ${destination}...`,
          type: "loading",
          isTemporary: true,
        });

        try {
          const { aiChatService } = await get()._loadAIChatService();

          // Send message to AI for travel tips
          const response = await aiChatService.sendMessage(
            `Give me essential travel tips and recommendations for ${destination}. Include: safety tips, cultural etiquette, best time to visit, local transportation, budget advice, and must-know information for travelers.`,
            state.chatContext,
            state.currentSessionId
          );

          // Remove loading message and add response
          const messages = state.messages.filter(m => m.type !== "loading");

          set({
            messages: [...messages, {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              role: "assistant",
              type: "response",
              content: response.message,
              suggestions: response.suggestions || [],
              timestamp: new Date().toISOString(),
            }],
            isSending: false,
          });

          console.log(`Loaded travel tips for ${destination}`);

        } catch (error) {
          console.error("Failed to get travel tips:", error);

          state.updateLastMessage({
            type: "error",
            content: "Sorry, I couldn't load travel tips. Please try again.",
            isTemporary: false,
          });

          state.setIsSending(false);
        }
      },

      sendMessage: async (message, isAuthenticated = false) => {
        const state = get();

        if (!message.trim() || state.isSending) return;

        // Check if guest user has reached message limit
        if (!isAuthenticated) {
          const currentCount = state.guestMessageCount;

          // Show login prompt if limit reached
          if (currentCount >= state.maxGuestMessages) {
            set({ showLoginPrompt: true }, false, "showLoginPrompt");
            return; // Don't send message
          }

          // Increment guest message count
          set({ guestMessageCount: currentCount + 1 }, false, "incrementGuestMessages");
        }

        state.setIsSending(true);
        state.setInputMessage("");

        state.addMessage({
          role: "user",
          content: message,
          type: "message",
        });

        // Add a placeholder message for streaming
        const streamingMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        state.addMessage({
          id: streamingMessageId,
          role: "assistant",
          content: "",
          type: "response",
          isStreaming: true,
          isTemporary: false,
        });

        try {
          const { aiChatService } = await get()._loadAIChatService();

          const response = await aiChatService.sendMessage(
            message,
            state.chatContext,
            state.currentSessionId
          );

          // Stream the response text progressively
          await state.streamTextIntoMessage(streamingMessageId, response.message, 15);

          // After streaming is complete, update with additional data
          const messages = get().messages;
          const messageIndex = messages.findIndex(m => m.id === streamingMessageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              actions: response.actions || [],
              relatedPlaces: response.relatedPlaces || [],
              topPlaces: response.topPlaces || [],
              images: response.images || [],
              suggestions: response.suggestions || [],
              destinationData: response.destinationData || null,
              metadata: response.metadata,
            };
            set({ messages: updatedMessages }, false, "addResponseData");
          }

          if (response.contextUpdates) {
            state.updateChatContext(response.contextUpdates);
          }

        } catch (error) {
          console.error("Message sending error:", error);

          // Update the streaming message with error
          const messages = get().messages;
          const messageIndex = messages.findIndex(m => m.id === streamingMessageId);
          if (messageIndex !== -1) {
            const updatedMessages = [...messages];
            updatedMessages[messageIndex] = {
              ...updatedMessages[messageIndex],
              content: "I'm having trouble responding right now. Please try again.",
              type: "error",
              isStreaming: false,
            };
            set({ messages: updatedMessages }, false, "errorResponse");
          }
        } finally {
          state.setIsSending(false);
        }
      },

      getChatStats: () => {
        const state = get();
        return {
          messageCount: state.messages.length,
          sessionId: state.currentSessionId,
          isActive: state.isChatOpen,
          mode: state.chatMode,
          context: state.chatContext,
          connectionStatus: state.connectionStatus,
          isFullScreen: state.isFullScreen,
        };
      },

      shouldShowFloatingButton: () => {
        const state = get();
        return (
          !state.isChatOpen &&
          state.chatContext.currentView === "home" &&
          !state.chatContext.searchResults?.length &&
          !state.chatContext.itineraryId
        );
      },

      shouldShowContextualButton: () => {
        const state = get();
        return (
          state.chatContext.currentView === "search" &&
          state.chatContext.searchResults?.length > 0
        );
      },

      loadMessageHistory: async () => {
        const state = get();

        if (!state.currentSessionId || !state.isConnected) return;

        try {
          const { aiChatService } = await get()._loadAIChatService();
          const history = await aiChatService.getMessageHistory(20);

          const messages = history.map(msg => ({
            id: msg.messageId,
            role: msg.role,
            content: msg.content,
            type: msg.type || "message",
            timestamp: msg.timestamp,
            actions: msg.actions || [],
            relatedPlaces: msg.context?.relatedPlaces || [],
            metadata: msg.aiData || msg.metadata,
          }));

          set({ messages }, false, "loadMessageHistory");

        } catch (error) {
          console.warn("Failed to load message history:", error);
        }
      },

      // ===== CONVERSATION HISTORY MANAGEMENT =====

      saveConversation: () => {
        const state = get();

        if (state.messages.length === 0) return;

        // Generate conversation title from first user message or context
        let title = "New Conversation";
        const firstUserMessage = state.messages.find(m => m.role === "user");

        if (firstUserMessage && firstUserMessage.content) {
          title = firstUserMessage.content.slice(0, 50);
        } else if (state.chatContext.destination) {
          title = `${state.chatContext.destination}`;
        }

        const conversation = {
          id: state.currentConversationId || `conv-${Date.now()}`,
          title,
          subtitle: state.chatContext.destination || state.messages[0]?.content?.slice(0, 30) || "",
          timestamp: new Date().toISOString(),
          messages: [...state.messages],
          context: { ...state.chatContext },
        };

        // Add to conversation history (keep last 10 conversations)
        const updatedHistory = [
          conversation,
          ...state.conversationHistory.filter(c => c.id !== conversation.id)
        ].slice(0, 10);

        set({
          conversationHistory: updatedHistory,
          currentConversationId: conversation.id
        }, false, "saveConversation");

        // NOTE: In React Native, conversation history is managed via MMKV or AsyncStorage
        // from the app layer. No localStorage usage here.
      },

      loadConversation: (conversationId) => {
        const state = get();
        const conversation = state.conversationHistory.find(c => c.id === conversationId);

        if (!conversation) {
          console.warn("Conversation not found:", conversationId);
          return;
        }

        set({
          messages: [...conversation.messages],
          chatContext: { ...state.chatContext, ...conversation.context },
          currentConversationId: conversation.id,
        }, false, "loadConversation");

        console.log("Loaded conversation:", conversation.title);
      },

      loadConversationHistory: () => {
        // NOTE: In React Native, load from MMKV or AsyncStorage.
        // This is a no-op stub. Override from the app layer.
        console.warn("loadConversationHistory: Not implemented for React Native. Override from app layer.");
      },

      deleteConversation: (conversationId) => {
        const state = get();
        const updatedHistory = state.conversationHistory.filter(c => c.id !== conversationId);

        set({ conversationHistory: updatedHistory }, false, "deleteConversation");

        // NOTE: In React Native, persist to MMKV or AsyncStorage from the app layer.
      },

      resetChatState: async () => {
        const state = get();

        if (state.currentSessionId) {
          try {
            const { aiChatService } = await get()._loadAIChatService();
            await aiChatService.endSession();
          } catch (error) {
            console.warn("Failed to end session during reset:", error);
          }
        }

        set({
          isChatOpen: false,
          isFullScreen: false,
          chatMode: "floating",
          messages: [],
          currentSessionId: null,
          inputMessage: "",
          isTyping: false,
          isSending: false,
          suggestions: [],
          activeSuggestions: [],
          chatContext: {
            destination: null,
            searchResults: [],
            itineraryId: null,
            currentView: "home",
          },
          connectionStatus: "disconnected",
          isConnected: false,
        }, false, "resetChatState");
      },

      // ===== GUEST USER MANAGEMENT =====

      setShowLoginPrompt: (show) =>
        set({ showLoginPrompt: show }, false, "setShowLoginPrompt"),

      closeLoginPrompt: () =>
        set({ showLoginPrompt: false }, false, "closeLoginPrompt"),

      resetGuestMessageCount: () =>
        set({ guestMessageCount: 0 }, false, "resetGuestMessageCount"),

      // Reset guest count when user logs in
      handleUserLogin: () => {
        set({
          guestMessageCount: 0,
          showLoginPrompt: false,
        }, false, "handleUserLogin");
      },
    }),
    {
      name: "ChatStore",
    }
  )
);

export { useChatStore };
