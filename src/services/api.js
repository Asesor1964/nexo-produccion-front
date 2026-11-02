// src/services/api.js

const API_URL = import.meta.env.PROD 
  ? 'https://nexo-produccion-back-production.up.railway.app' 
  : 'http://localhost:5000';

/**
 * Función centralizada para hacer peticiones fetch a la API
 * @param {string} endpoint - Ruta del endpoint (ej. '/api/pedidos')
 * @param {Object} options - Opciones de fetch (método, headers, body, etc.)
 */
export const apiFetch = async (endpoint, options = {}) => {
  // Asegurarse de que el endpoint empiece con barra '/'
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  const response = await fetch(`${API_URL}${cleanEndpoint}`, options);
  return response;
};