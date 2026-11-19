import { Routes } from '@angular/router';
import { adminGuard, autenticadoGuard, convidadoGuard } from './core/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Entrar · Conformidade de Editais',
    canActivate: [convidadoGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    title: 'Cadastre-se · Conformidade de Editais',
    canActivate: [convidadoGuard],
    loadComponent: () => import('./features/auth/cadastro-page').then((m) => m.CadastroPage),
  },
  {
    path: '',
    canActivateChild: [autenticadoGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Sistemas · Conformidade de Editais',
        loadComponent: () => import('./features/sistemas/sistemas-page').then((m) => m.SistemasPage),
      },
      {
        path: 'dashboard',
        title: 'Dashboard · Conformidade de Editais',
        loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'favoritos',
        title: 'Favoritos · Conformidade de Editais',
        data: { somenteFavoritos: true },
        loadComponent: () => import('./features/sistemas/sistemas-page').then((m) => m.SistemasPage),
      },
      {
        path: 'sistemas/:id',
        title: 'Itens do edital · Conformidade de Editais',
        loadComponent: () => import('./features/gerenciamento/gerenciamento-page').then((m) => m.GerenciamentoPage),
      },
      {
        path: 'usuarios',
        title: 'Usuários · Conformidade de Editais',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/usuarios/usuarios-page').then((m) => m.UsuariosPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
