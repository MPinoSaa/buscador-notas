import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'login', renderMode: RenderMode.Prerender },
  // Páginas autenticadas: se renderizan solo en el cliente
  { path: '**', renderMode: RenderMode.Client }
];
