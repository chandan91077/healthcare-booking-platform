import api from './api';

export type AppRole = 'patient' | 'doctor' | 'admin';

export const signUp = async (userData: any) => {
  try {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return { data: response.data, error: null };
  } catch (error: any) {
    return { data: null, error: error.response?.data?.message || 'Registration failed' };
  }
};

export const signIn = async (credentials: any) => {
  try {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    return { data: response.data, error: null };
  } catch (error: any) {
    return { data: null, error: error.response?.data?.message || 'Login failed' };
  }
};

export const signOut = async () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return { error: null };
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// Re-implementing missing utilities using API or localStorage

export const getUserRole = async (userId: string): Promise<AppRole | null> => {
  // In the new system, role is part of the user object stored in localStorage or accessible via /me
  // For now, we can try to get it from localStorage or make an API call if needed.
  // Assuming simpler approach first: check local storage user
  const user = getCurrentUser();
  if (user && (user._id === userId || user.id === userId)) {
    return user.role as AppRole;
  }

  // If not in local storage or ID mismatch (rare in current flow), fetch from API
  try {
    // We might need a specific endpoint for fetching other users' roles or just refactor usage.
    // Current usage in useAuth seems to fetch for the logged in user primarily.
    // Let's rely on the API context.
    const { data } = await api.get(`/users/${userId}`); // Might fail if we didn't implement GET /users/:id
    return data.role;
  } catch (e) {
    return null;
  }
};

export const getProfile = async (userId: string) => {
  try {
    // Previously a separate "profiles" table (e.g., in Supabase); in MERN/MongoDB the User model contains `full_name`.
    // If we need a separate profile fetch, it's just GET /users/:id or similar.
    // But DoctorDashboard might expect { full_name: ... }

    // Check if we are fetching for self
    const currentUser = getCurrentUser();
    if (currentUser && (currentUser._id === userId || currentUser.id === userId)) {
      return { full_name: currentUser.full_name, email: currentUser.email };
    }

    // Otherwise fetch
    // Warning: We haven't implemented GET /users/:id yet in backend for general access.
    // But let's assume we can add it or it's not critical for now if we only use it for self.
    return null;
  } catch (error) {
    console.error("Error getting profile:", error);
    return null;
  }
};

export const getDoctorProfile = async (userId: string) => {
  try {
    const { data } = await api.get(`/doctors/user/${userId}`);
    return data;
  } catch (error) {
    console.error("Error getting doctor profile:", error);
    return null;
  }
};
