import axios from 'axios';

// Use environment variable for API URL, fallback to localhost for development
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // or however you store it
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default api;

// Global response interceptor: auto-logout on 401 (invalidated session)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const message = error?.response?.data?.message || '';

        if (status === 401) {
            // Clear auth and notify app
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } catch {}

            // Notify listeners (since storage events don't fire in same tab)
            try {
                window.dispatchEvent(new Event('auth:logout'));
            } catch {}

            // Specific banner event when session is invalidated elsewhere
            if (message.toLowerCase().includes('session invalidated')) {
                try {
                    window.dispatchEvent(new CustomEvent('auth:sessionInvalidated', { detail: message }));
                } catch {}
            }

            // Optional: force a reload to reset app state
            // window.location.reload();
        }

        return Promise.reject(error);
    }
);
