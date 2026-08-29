import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'vyom_token';
const USER_KEY = 'vyom_user';

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
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [initializing, setInitializing] = useState(true);

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
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
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

  const login = async (email, password) => {
    const data = await authRequest('/login', { email, password });
    applyAuth(data);
    return data.user;
  };

  const register = async ({ full_name, email, password, company_name }) => {
    const data = await authRequest('/register', { full_name, email, password, company_name });
    applyAuth(data);
    return data.user;
  };

  const acceptInvite = async ({ token, full_name, email, password }) => {
    const data = await authRequest('/accept-invite', { token, full_name, email, password });
    applyAuth(data);
    return data.user;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  function applyAuth(data) {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
