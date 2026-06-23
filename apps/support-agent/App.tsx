import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useTheme } from "@prayana/shared-ui";

import LoginScreen from "./src/screens/LoginScreen";
import InboxScreen from "./src/screens/InboxScreen";
import ChatScreen from "./src/screens/ChatScreen";
import { useAgentStore } from "./src/state/agentStore";

export type RootStackParamList = {
  Login: undefined;
  Inbox: undefined;
  Chat: { sessionId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Inner component so we can read themeColors from inside the ThemeProvider.
function AppNavigator() {
  const { isDarkMode, themeColors } = useTheme();
  const isAuthenticated = useAgentStore((s) => s.isAuthenticated);
  const restoreOnlinePreference = useAgentStore((s) => s.restoreOnlinePreference);

  // Once Firebase auth restores a session and the store flips
  // isAuthenticated → true, attempt to reconnect the agent socket if the
  // agent was online when they last closed the app.
  useEffect(() => {
    if (isAuthenticated) {
      restoreOnlinePreference();
    }
  }, [isAuthenticated, restoreOnlinePreference]);

  return (
    <>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <NavigationContainer>
        <Stack.Navigator
          id={undefined}
          screenOptions={{
            headerStyle: { backgroundColor: themeColors.surface },
            headerTintColor: themeColors.text,
            headerTitleStyle: { fontWeight: "600" as const },
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          ) : (
            <>
              <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: "Support Inbox" }} />
              <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Conversation" }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
