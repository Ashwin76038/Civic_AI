import axios from "axios";

// Updated to use localhost instead of 127.0.0.1 for better CORS compatibility
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000", // Changed from 127.0.0.1 to localhost
  timeout: 10000,
  withCredentials: true, // 10 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to log requests (helpful for debugging)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
    if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to log responses and handle errors
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

export default api;