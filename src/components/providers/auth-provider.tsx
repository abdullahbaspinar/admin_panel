"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";

import { canEditContent, normalizeRole } from "@/lib/auth/roles";
import type { StaffRole } from "@/lib/domain/types";
import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";

type AuthStatus = "loading" | "unauthenticated" | "authenticated" | "forbidden" | "misconfigured";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  role: StaffRole | null;
  canEdit: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readRole(user: User): Promise<StaffRole | null> {
  const token = await user.getIdTokenResult(true);
  return normalizeRole(token.claims.role);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    isFirebaseConfigured() ? "loading" : "misconfigured",
  );
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);

  const applyUser = useCallback(async (next: User | null) => {
    if (!next) {
      setUser(null);
      setRole(null);
      setStatus("unauthenticated");
      return;
    }
    const nextRole = await readRole(next);
    setUser(next);
    setRole(nextRole);
    if (!canEditContent(nextRole) && nextRole !== "moderator") {
      setStatus("forbidden");
      return;
    }
    setStatus("authenticated");
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (next) => {
      void applyUser(next);
    });
  }, [applyUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getClientAuth();
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await applyUser(cred.user);
  }, [applyUser]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(getClientAuth());
    setUser(null);
    setRole(null);
    setStatus("unauthenticated");
  }, []);

  const refreshClaims = useCallback(async () => {
    if (!user) return;
    await applyUser(user);
  }, [applyUser, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      role,
      canEdit: canEditContent(role),
      signIn,
      signOut,
      refreshClaims,
    }),
    [status, user, role, signIn, signOut, refreshClaims],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
