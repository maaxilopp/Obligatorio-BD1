
const API_URL = 'http://localhost:8000';

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || 'Error al comunicarse con el servidor');
  }

  return data;
}

export async function login(correo, contrasena) {
  const data = await apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ correo, contrasena }),
  });

  const token = data.access_token || data.token;

  if (!token) {
    throw new Error('El servidor no devolvió un token');
  }

  localStorage.setItem('token', token);
  return data;
}
