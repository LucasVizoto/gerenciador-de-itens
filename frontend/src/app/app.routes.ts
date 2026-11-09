import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Sistemas · Conformidade de Editais',
    loadComponent: () => import('./features/sistemas/sistemas-page').then((m) => m.SistemasPage),
  },
  {
    path: 'sistemas/:id',
    title: 'Itens do edital · Conformidade de Editais',
    loadComponent: () => import('./features/gerenciamento/gerenciamento-page').then((m) => m.GerenciamentoPage),
  },
  { path: '**', redirectTo: '' },
];
