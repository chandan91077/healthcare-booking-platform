import axios from 'axios';

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:5000/api';

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
