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
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { CaptainProfile } from "@/lib/types";
import { postCaptainEmail } from "@/lib/client-notifications";
import type { AccountRole, PortalKind, SignupRole } from "@/lib/account-role";
import { parseAccountRole, parseSignupRole, resolvePortalKind } from "@/lib/account-role";
import {
  ADMIN_PERMISSIONS,
  hasAdminPermission,
  type AdminPermission,
  type ResolvedAdminAccess,
} from "@/lib/admin-permissions";
import { isClientAdminEmail } from "@/lib/admin-client";
import { isSuperAdminEmail } from "@/lib/super-admin";

export type ClientAccess = ResolvedAdminAccess & {
  loading: boolean;
  accountRole: AccountRole;
  portalKind: PortalKind;
  joinStatus: "none" | "pending" | "approved" | "rejected";
  linkedTeamId: string | null;
};

const EMPTY_ACCESS: ClientAccess = {
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  isEnvAdmin: false,
  permissions: [],
  accountRole: "captain",
  portalKind: "captain",
  joinStatus: "none",
  linkedTeamId: null,
};

function applyPortal(access: ClientAccess): ClientAccess {
  const portalKind = resolvePortalKind({
    isAdmin: access.isAdmin,
    accountRole: access.accountRole,
  });
  return {
    ...access,
    portalKind,
    accountRole: portalKind === "admin" ? "admin" : parseAccountRole(access.accountRole),
  };
}

function optimisticAccess(email: string | null | undefined): ClientAccess {
  const superAdmin = isSuperAdminEmail(email ?? undefined);
  const envAdmin = isClientAdminEmail(email);
  const isAdmin = superAdmin || envAdmin;
  return applyPortal({
    loading: true,
    isAdmin,
    isSuperAdmin: superAdmin,
    isEnvAdmin: envAdmin && !superAdmin,
    permissions: isAdmin ? [...ADMIN_PERMISSIONS] : [],
    accountRole: isAdmin ? "admin" : "captain",
    portalKind: isAdmin ? "admin" : "captain",
    joinStatus: "none",
    linkedTeamId: null,
  });
}

type AuthState = {
  user: User | null;
  profile: CaptainProfile | null;
  access: ClientAccess;
  loading: boolean;
  firebaseReady: boolean;
  refreshProfile: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  hasAdminPermission: (permission: AdminPermission) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, accountRole?: SignupRole) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  verifyResetCode: (oobCode: string) => Promise<string>;
  confirmResetPassword: (oobCode: string, newPassword: string) => Promise<void>;
  changePasswordWithCurrent: (
    email: string,
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CaptainProfile | null>(null);
  const [access, setAccess] = useState<ClientAccess>(EMPTY_ACCESS);
  const firebaseReady = isFirebaseConfigured();
  const [loading, setLoading] = useState(() => firebaseReady);

  const loadAccess = useCallback(async (u: User) => {
    setAccess((prev) => applyPortal({ ...optimisticAccess(u.email), accountRole: prev.accountRole }));
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/auth/access", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = (await res.json().catch(() => ({}))) as {
        isAdmin?: boolean;
        isSuperAdmin?: boolean;
        isEnvAdmin?: boolean;
        permissions?: AdminPermission[];
        accountRole?: string;
        portalKind?: string;
        joinStatus?: ClientAccess["joinStatus"];
        linkedTeamId?: string | null;
      };
      if (!res.ok) {
        setAccess(applyPortal({ ...optimisticAccess(u.email), loading: false }));
        return;
      }
      setAccess(
        applyPortal({
          loading: false,
          isAdmin: Boolean(j.isAdmin) || j.portalKind === "admin",
          isSuperAdmin: Boolean(j.isSuperAdmin),
          isEnvAdmin: Boolean(j.isEnvAdmin),
          permissions: Array.isArray(j.permissions) ? j.permissions : [],
          accountRole: parseAccountRole(j.accountRole),
          portalKind: "captain",
          joinStatus: j.joinStatus ?? "none",
          linkedTeamId: j.linkedTeamId ?? null,
        })
      );
    } catch {
      setAccess(applyPortal({ ...optimisticAccess(u.email), loading: false }));
    }
  }, []);

  const loadProfile = useCallback(async (u: User) => {
    if (!firebaseReady) return;
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
      const data = snap.data() as CaptainProfile;
      setProfile(data);
      setAccess((prev) =>
        applyPortal({
          ...prev,
          accountRole: parseAccountRole(data.accountRole),
          joinStatus: data.joinStatus ?? prev.joinStatus,
          linkedTeamId: data.linkedTeamId ?? prev.linkedTeamId,
        })
      );
    } else {
      setProfile(null);
    }
  }, [firebaseReady]);

  const syncSessionCookie = useCallback(async (u: User | null) => {
    try {
      if (!u) {
        await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
        return;
      }
      const token = await u.getIdToken(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        console.warn(
          "[ESPORTARENA] Session cookie (/admin):",
          res.status,
          j.code ?? "",
          j.error ?? ""
        );
      }
    } catch {
      /* cookie je best-effort pro Edge middleware */
    }
  }, []);

  useEffect(() => {
    if (!firebaseReady) return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await loadProfile(u);
        await Promise.all([syncSessionCookie(u), loadAccess(u)]);
      } else {
        setProfile(null);
        setAccess({ ...EMPTY_ACCESS, loading: false });
        await syncSessionCookie(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [firebaseReady, loadProfile, syncSessionCookie, loadAccess]);

  const refreshAccess = useCallback(async () => {
    if (user && firebaseReady) await loadAccess(user);
  }, [user, firebaseReady, loadAccess]);

  const refreshProfile = useCallback(async () => {
    if (user && firebaseReady) {
      await loadProfile(user);
      await loadAccess(user);
    }
  }, [user, firebaseReady, loadProfile, loadAccess]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    },
    [firebaseReady]
  );

  const signUp = useCallback(
    async (email: string, password: string, accountRole: SignupRole = "captain") => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      const role = parseSignupRole(accountRole);
      const checkRes = await fetch("/api/auth/check-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const check = (await checkRes.json().catch(() => ({}))) as {
        ok?: boolean;
        allowed?: boolean;
        reason?: string;
        error?: string;
      };
      if (!checkRes.ok || !check.ok) {
        throw new Error(check.error ?? "Registraci teď nelze ověřit.");
      }
      if (check.allowed === false) {
        throw new Error(
          check.reason
            ? `Tento e-mail je zabanovaný: ${check.reason}`
            : "Tento e-mail je zabanovaný a nelze na něj založit účet."
        );
      }

      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email,
        password
      );
      const db = getFirebaseDb();
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        firstName: "",
        lastName: "",
        phone: "",
        discordUsername: "",
        faceitNickname: "",
        steamNickname: "",
        riotId: "",
        brawlPlayerTag: "",
        eaAccount: "",
        isAdult: false,
        profileComplete: false,
        accountRole: role,
        joinStatus: "none",
        linkedTeamId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const token = await cred.user.getIdToken(true);
      await fetch("/api/notifications/admin-new-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: cred.user.email, accountRole: role }),
      }).catch(() => {});
      if (role === "captain") {
        const welcome = await postCaptainEmail(token, {
          kind: "welcome",
          displayName: (cred.user.email ?? "kapitán").split("@")[0],
        });
        if (!welcome.ok) {
          console.warn(
            "[captain-email] welcome:",
            welcome.error,
            "— zkontroluj RESEND_API_KEY a RESEND_FROM na hostingu."
          );
        }
      }
    },
    [firebaseReady]
  );

  const signOut = useCallback(async () => {
    if (!firebaseReady) return;
    try {
      await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
    } catch {
      /* */
    }
    await firebaseSignOut(getFirebaseAuth());
  }, [firebaseReady]);

  const sendPasswordReset = useCallback(
    async (email: string) => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      const auth = getFirebaseAuth();
      // Apex doména — www musí být v Authorized domains, ale continue URL držíme stabilní
      const origin =
        typeof window !== "undefined" &&
        window.location.hostname.endsWith("studentskyturnaj.cz")
          ? "https://studentskyturnaj.cz"
          : window.location.origin;
      await sendPasswordResetEmail(auth, email.trim(), {
        url: `${origin}/heslo/akce`,
        handleCodeInApp: false,
      });
    },
    [firebaseReady]
  );

  const verifyResetCode = useCallback(
    async (oobCode: string) => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      return verifyPasswordResetCode(getFirebaseAuth(), oobCode);
    },
    [firebaseReady]
  );

  const confirmResetPassword = useCallback(
    async (oobCode: string, newPassword: string) => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      await confirmPasswordReset(getFirebaseAuth(), oobCode, newPassword);
    },
    [firebaseReady]
  );

  const changePasswordWithCurrent = useCallback(
    async (email: string, currentPassword: string, newPassword: string) => {
      if (!firebaseReady) throw new Error("Firebase není nakonfigurováno.");
      const auth = getFirebaseAuth();
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        currentPassword
      );
      await updatePassword(cred.user, newPassword);
      try {
        await fetch("/api/auth/session", {
          method: "DELETE",
          credentials: "include",
        });
      } catch {
        /* */
      }
      await firebaseSignOut(auth);
    },
    [firebaseReady]
  );

  const hasPermissionFn = useCallback(
    (permission: AdminPermission) => hasAdminPermission(access, permission),
    [access]
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      access,
      loading,
      firebaseReady,
      refreshProfile,
      refreshAccess,
      hasAdminPermission: hasPermissionFn,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      verifyResetCode,
      confirmResetPassword,
      changePasswordWithCurrent,
    }),
    [
      user,
      profile,
      access,
      loading,
      firebaseReady,
      refreshProfile,
      refreshAccess,
      hasPermissionFn,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      verifyResetCode,
      confirmResetPassword,
      changePasswordWithCurrent,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth mimo AuthProvider");
  return ctx;
}
