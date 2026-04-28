import axios from 'axios';

const normalizeApiBaseUrl = (rawUrl: string) => {
    const trimmed = rawUrl.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const fallbackApiUrl = import.meta.env.PROD
    ? 'https://healthcare-booking-platform.onrender.com/api'
    : 'http://localhost:5000/api';

const apiBaseUrl = normalizeApiBaseUrl(envApiUrl || fallbackApiUrl);

const api = axios.create({
    baseURL: apiBaseUrl,
});

// Add a response interceptor to handle session invalidation on other devices
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 403 && error.response?.data?.code === 'SESSION_INVALIDATED') {
            // Clear local storage and dispatch a custom event
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            // Dispatch a custom event that the app can listen to
            window.dispatchEvent(new CustomEvent('sessionInvalidated', {
                detail: { message: error.response.data.message }
            }));
            
            // Redirect to auth page
            window.location.href = '/auth';
        }
        return Promise.reject(error);
    }
);

export default api;
