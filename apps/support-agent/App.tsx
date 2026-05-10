import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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

export default function App() {
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
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#0f172a" },
            headerTintColor: "#f1f5f9",
            headerTitleStyle: { fontWeight: "600" },
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
    </SafeAreaProvider>
  );
}
