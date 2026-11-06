"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Modal from "./modal";

// The short-lived access token and a copy of the signed-in user live in localStorage.
// The long-lived refresh token is an httpOnly cookie the page's JavaScript never sees.
const ACCESS_KEY = "tf_access_token";
const USER_KEY = "tf_user";
const CHANGE_EVENT = "tf-auth-change";

export type User = { UserID: number; FName: string; LName: string; Email: string; roles: string[] };
type Session = { accessToken: string; user: User };

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function store(session: Session | null) {
  try {
    if (session) {
      localStorage.setItem(ACCESS_KEY, session.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    } else {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // Storage blocked (private mode): the session lasts only as long as the cookie-based refresh.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function updateStoredUser(user: User) {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

let refreshing: Promise<boolean> | null = null;

/** Gets a new access token using the refresh cookie. Concurrent callers share one request. */
export function refreshSession() {
  refreshing ??= (async () => {
    const before = read(ACCESS_KEY);
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (response.ok) {
        store((await response.json()) as Session);
        return true;
      }
      // Another tab may have refreshed at the same moment; its new token is already in storage.
      const after = read(ACCESS_KEY);
      if (after && after !== before) return true;
      if (response.status === 401) store(null);
      return false;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** fetch() that sends the access token and, if it has expired, refreshes once and retries. */
export async function apiFetch(url: string, init: RequestInit = {}) {
  const send = () => {
    const token = read(ACCESS_KEY);
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(url, { ...init, headers, credentials: "same-origin" });
  };
  const response = await send();
  if (response.status !== 401 || !read(USER_KEY)) return response;
  return (await refreshSession()) ? send() : response;
}

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  hasRole: (...roles: string[]) => boolean;
  promptLogin: (mode?: "login" | "register") => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs logging in or out
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = useSyncExternalStore(subscribe, () => read(USER_KEY), () => null);
  const user = useMemo(() => {
    try { return stored ? (JSON.parse(stored) as User) : null; } catch { return null; }
  }, [stored]);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState<"login" | "register" | null>(null);

  // On load, trade the refresh cookie for a fresh access token (also picks up role changes).
  useEffect(() => {
    refreshSession().finally(() => setReady(true));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    store(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    ready,
    hasRole: (...roles) => Boolean(user && roles.some((role) => user.roles.includes(role))),
    promptLogin: (mode = "login") => setPrompt(mode),
    logout,
  }), [user, ready, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {prompt && <AuthDialog mode={prompt} setMode={setPrompt} onClose={() => setPrompt(null)} />}
    </AuthContext.Provider>
  );
}

function AuthDialog({ mode, setMode, onClose }: { mode: "login" | "register"; setMode: (mode: "login" | "register") => void; onClose: () => void }) {
  const [form, setForm] = useState({ FName: "", LName: "", Email: "", Password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (name: keyof typeof form, value: string) => setForm((current) => ({ ...current, [name]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = mode === "login" ? { Email: form.Email, Password: form.Password } : form;
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body),
      });
      const result = (await response.json()) as Session & { error?: string };
      if (!response.ok) throw new Error(result.error);
      store(result);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={mode === "login" ? "Log in" : "Create an account"} onClose={onClose}>
      <form className="record-form" onSubmit={submit}>
        {error && <p className="error">{error}</p>}
        {mode === "register" && (
          <div className="field-pair">
            <label><span>First name</span><input required maxLength={50} autoComplete="given-name" value={form.FName} onChange={(e) => set("FName", e.target.value)} /></label>
            <label><span>Last name</span><input required maxLength={50} autoComplete="family-name" value={form.LName} onChange={(e) => set("LName", e.target.value)} /></label>
          </div>
        )}
        <label><span>Email</span><input required type="email" maxLength={100} autoComplete="email" value={form.Email} onChange={(e) => set("Email", e.target.value)} /></label>
        <label><span>Password{mode === "register" && " (at least 8 characters)"}</span>
          <input required type="password" minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.Password} onChange={(e) => set("Password", e.target.value)} /></label>
        <div className="modal-actions auth-actions">
          <button type="button" className="text-link" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
          </button>
          <button className="primary-button" disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}</button>
        </div>
      </form>
    </Modal>
  );
}
