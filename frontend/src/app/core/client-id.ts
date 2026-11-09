import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Identifica esta aba nas alterações enviadas à API, para que ela ignore os próprios eventos
 * em tempo real. `crypto.randomUUID` só existe em contexto seguro (HTTPS/localhost).
 */
export const CLIENT_ID =
  'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const clientIdInterceptor: HttpInterceptorFn = (request, next) =>
  next(request.url.startsWith('/api') ? request.clone({ setHeaders: { 'X-Client-Id': CLIENT_ID } }) : request);
