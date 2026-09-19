import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'vyom_token';
const USER_KEY = 'vyom_user';
const HANDOFF_KEY = 'vyom_tab_handoff';

// Store the session into shared localStorage so a freshly-opened tab
// (target="_blank" + rel="noopener noreferrer") can pick it up.
export function handoffSession(token, user) {
  if (!token) return;
  localStorage.setItem(HANDOFF_KEY, JSON.stringify({ token, user }));
}

// Session persistence: "Remember me" uses localStorage (survives browser restarts),
// otherwise sessionStorage (cleared when the tab/browser closes).
const sessionStore = {
  get: (key) => localStorage.getItem(key) || sessionStorage.getItem(key),
  set: (key, value, remember) => {
    const target = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    target.setItem(key, value);
    other.removeItem(key);
  },
  remove: (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

function storeOf(key) {
  if (localStorage.getItem(key)) return localStorage;
  if (sessionStorage.getItem(key)) return sessionStorage;
  return null;
}

function readStoredAuth() {
  try {
    // A new tab does not inherit sessionStorage, and target="_blank" links use
    // rel="noopener noreferrer" (window.opener is null). The clicking tab instead
    // drops a handoff payload into shared localStorage, which we consume here.
    let handoff = null;
    try {
      handoff = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null');
    } catch {
      handoff = null;
    }
    localStorage.removeItem(HANDOFF_KEY);

    let token = sessionStore.get(TOKEN_KEY);
    let rawUser = sessionStore.get(USER_KEY);
    if (!token && handoff?.token) {
      token = handoff.token;
      rawUser = handoff.user ? JSON.stringify(handoff.user) : null;
      sessionStorage.setItem(TOKEN_KEY, token);
      if (rawUser) sessionStorage.setItem(USER_KEY, rawUser);
    }

    return {
      token: token || null,
      user: rawUser ? JSON.parse(rawUser) : null,
    };
  } catch {
    return { token: null, user: null };
  }
}

const AuthContext = createContext(null);

async function authRequest(path, body) {
  const res = await fetch(`/api/auth${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export function AuthProvider({ children }) {
  const { token: initialToken, user: initialUser } = readStoredAuth();
  const [user, setUser] = useState(initialUser);
  const [token, setToken] = useState(initialToken);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => {
    if (!token) {
      setInitializing(false);
      return undefined;
    }
    // Validate the stored token against the API so stale/expired tokens drop to login.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.user) {
          setUser(data.user);
          const target = storeOf(TOKEN_KEY) || localStorage;
          target.setItem(USER_KEY, JSON.stringify(data.user));
        } else {
          setUser(null);
          setToken(null);
          sessionStore.remove(TOKEN_KEY);
          sessionStore.remove(USER_KEY);
        }
      } catch {
        if (!cancelled) setInitializing(false);
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (email, password, remember = false) => {
    const data = await authRequest('/login', { email, password });
    applyAuth(data, remember);
    return data.user;
  };

  const register = async ({ full_name, email, password, company_name }) => {
    const data = await authRequest('/register', { full_name, email, password, company_name });
    applyAuth(data, true);
    return data.user;
  };

  const acceptInvite = async ({ token, full_name, email, password }) => {
    const data = await authRequest('/accept-invite', { token, full_name, email, password });
    applyAuth(data, true);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStore.remove(TOKEN_KEY);
    sessionStore.remove(USER_KEY);
  };

  function applyAuth(data, remember) {
    sessionStore.set(TOKEN_KEY, data.token, remember);
    sessionStore.set(USER_KEY, JSON.stringify(data.user), remember);
    setToken(data.token);
    setUser(data.user);
  }

  const value = useMemo(
    () => ({ user, token, initializing, isAuthenticated: Boolean(user), login, register, acceptInvite, logout }),
    [user, token, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
