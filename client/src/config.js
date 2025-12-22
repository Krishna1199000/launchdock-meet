// API Configuration
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000';

// Helper function to build API endpoint URLs
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  // Remove trailing slash from API_URL
  const baseUrl = API_URL.replace(/\/$/, '');
  return `${baseUrl}/${cleanEndpoint}`;
};

