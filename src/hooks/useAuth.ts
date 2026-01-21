import { useState, useEffect } from "react";
import api from "@/lib/api";
import { getCurrentUser, getUserRole, signIn, signUp, signOut, type AppRole } from "@/lib/auth";

// Define a User type that matches our new system
export interface User {
  id: string;
  _id?: string;
  email?: string;
  full_name?: string;
  role?: string;
  [key: string]: any;
}

export interface Session {
  user: User;
  token: string;
}

export interface AuthInvalidationState {
  message: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [invalidation, setInvalidation] = useState<AuthInvalidationState>({ message: null });

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = getCurrentUser();
      const token = localStorage.getItem('token');

      if (currentUser && token) {
        setUser(currentUser);
        setSession({ user: currentUser, token });

        // Get role (either from user object or fetch)
        const userRole = await getUserRole(currentUser._id || currentUser.id);
        setRole(userRole);

        // Validate token with backend to catch invalidated sessions
        try {
          await api.get('/auth/profile');
        } catch (e: any) {
          // If token invalid, state will be reset by interceptor; ensure local state follows
          setUser(null);
          setSession(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setSession(null);
        setRole(null);
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage events to sync across tabs
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    // Listen for custom auth logout events triggered by interceptors
    window.addEventListener('auth:logout', handleStorageChange as EventListener);
    // Listen for session invalidation to show banner
    const handleInvalidation = (e: Event) => {
      const ce = e as CustomEvent<string>;
      setInvalidation({ message: ce.detail || "You've logged in elsewhere." });
    };
    window.addEventListener('auth:sessionInvalidated', handleInvalidation as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth:logout', handleStorageChange as EventListener);
      window.removeEventListener('auth:sessionInvalidated', handleInvalidation as EventListener);
    };
  }, []);

  const login = async (credentials: any) => {
    const { data, error } = await signIn(credentials);
    if (error) throw new Error(error);

    if (data) {
      // Update state immediately
      const currentUser = data;
      const token = data.token;
      setUser(currentUser);
      setSession({ user: currentUser, token });

      // Get role
      const userRole = await getUserRole(currentUser._id || currentUser.id);
      setRole(userRole);

      return data;
    }
  };

  const register = async (userData: any) => {
    const { data, error } = await signUp(userData);
    if (error) throw new Error(error);

    if (data) {
      const currentUser = data;
      const token = data.token;
      setUser(currentUser);
      setSession({ user: currentUser, token });

      const userRole = await getUserRole(currentUser._id || currentUser.id);
      setRole(userRole);

      return data;
    }
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const dismissInvalidation = () => {
    setInvalidation({ message: null });
  };

  return {
    user,
    session,
    role,
    isLoading,
    isAuthenticated: !!session,
    login,
    register,
    logout,
    sessionInvalidatedMessage: invalidation.message,
    dismissInvalidation
  };
}
