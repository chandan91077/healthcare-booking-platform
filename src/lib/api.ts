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
