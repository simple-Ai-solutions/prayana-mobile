// firebase.ts - Firebase initialization for React Native (Expo managed workflow)
// Uses Firebase JS SDK with AsyncStorage persistence (NOT @react-native-firebase)

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase v12 moved `getReactNativePersistence` out of the main types but it
// still works at runtime when imported from 'firebase/auth'. We require it
// dynamically to avoid the TS type mismatch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
};

// Firebase configuration - same project as the web app (prayanaai-d52cc).
// Values come from EXPO_PUBLIC_FIREBASE_* env vars; hardcoded fallbacks keep the
// app booting if a var is missing during early dev. Rotate keys via .env, not code.
const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyCd1UZ-OnKVAF58Hv78-pefICnxUDWkTKE',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'prayanaai-d52cc.firebaseapp.com',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'prayanaai-d52cc',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'prayanaai-d52cc.firebasestorage.app',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '926782873134',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:926782873134:web:77b2ea63b46c90425549bf',
};

// Initialize Firebase app (singleton - prevent re-initialization on hot reload)
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with React Native AsyncStorage persistence.
// This keeps the user signed in across app restarts.
// NOTE: We must use initializeAuth (not getAuth) to set persistence in React Native.
// Calling getAuth() after initializeAuth() on the same app instance is safe and
// returns the already-initialized auth instance.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage) as any,
  });
} catch (error: any) {
  // If auth was already initialized (e.g., hot reload), just get the existing instance.
  // initializeAuth throws if called twice on the same app.
  if (error.code === 'auth/already-initialized') {
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
  } else {
    throw error;
  }
}

export { app, auth };
