import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Telas internas: sem sessão, vai para o login e volta para a mesma página depois. */
export const autenticadoGuard: CanActivateFn = async (_rota, estado) => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario) return true;
  return router.createUrlTree(['/login'], { queryParams: estado.url !== '/' ? { voltar: estado.url } : {} });
};

/** Login e cadastro: quem já está logado vai direto para a lista de sistemas. */
export const convidadoGuard: CanActivateFn = async () => {
  const usuario = await inject(AuthService).carregar();
  return usuario ? inject(Router).createUrlTree(['/']) : true;
};

export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const usuario = await inject(AuthService).carregar();
  if (usuario?.administrador) return true;
  return router.createUrlTree([usuario ? '/' : '/login']);
};

/** Sessão expirada ou usuário desativado no meio do uso: volta para o login. */
export const sessaoExpiradaInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(request).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status === 401 && !request.url.startsWith('/api/auth/')) {
        auth.limpar();
        void router.navigate(['/login']);
      }
      return throwError(() => erro);
    }),
  );
};
