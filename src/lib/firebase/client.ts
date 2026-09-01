import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

/**
 * Same Firebase project as HMGS mobile (`quiz-apps-a4b59`).
 * Web app: "Admin" — public client config (safe to ship in the browser).
 * Override via NEXT_PUBLIC_FIREBASE_* in `.env.local` if needed.
 */
const HMGS_ADMIN_WEB = {
  apiKey: "AIzaSyASAx0vJiz1ukDX8Aop-7XnDMIOQhqc_7c",
  authDomain: "quiz-apps-a4b59.firebaseapp.com",
  projectId: "quiz-apps-a4b59",
  storageBucket: "quiz-apps-a4b59.firebasestorage.app",
  messagingSenderId: "584873420814",
  appId: "1:584873420814:web:e637d8887b04caff74b45f",
} as const;

function envOrDefault(
  name: keyof typeof HMGS_ADMIN_WEB,
  envKey: string,
): string {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return HMGS_ADMIN_WEB[name];
}

export function getFirebaseConfig() {
  return {
    apiKey: envOrDefault("apiKey", "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: envOrDefault("authDomain", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: envOrDefault("projectId", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: envOrDefault(
      "storageBucket",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    ),
    messagingSenderId: envOrDefault(
      "messagingSenderId",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    ),
    appId: envOrDefault("appId", "NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(config.apiKey && config.appId && config.projectId);
}

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps()[0] ?? initializeApp(getFirebaseConfig());
  }
  return app;
}

export function getClientAuth(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) storage = getStorage(getFirebaseApp());
  return storage;
}
