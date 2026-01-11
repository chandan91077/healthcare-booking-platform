import { useState, useEffect } from "react";
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
    return () => window.removeEventListener('storage', handleStorageChange);
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

  return {
    user,
    session,
    role,
    isLoading,
    isAuthenticated: !!session,
    login,
    register,
    logout
  };
}
