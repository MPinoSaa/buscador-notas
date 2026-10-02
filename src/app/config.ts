const isLocal = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);

export const config = {
  // URL del backend. En producción queda vacía hasta que el backend esté desplegado.
  apiUrl: isLocal ? 'http://localhost:3000' : ''
};
