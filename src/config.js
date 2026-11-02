// src/config.js
export const API_URL = import.meta.env.PROD 
  ? 'https://nexo-produccion-back-production.up.railway.app' 
  : 'http://localhost:5000';