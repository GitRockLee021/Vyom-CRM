import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../utils/permissions.js';

// Returns a `can(key)` function for the current user.
export function usePerm() {
  const { user } = useAuth();
  return useCallback((key) => can(user, key), [user]);
}