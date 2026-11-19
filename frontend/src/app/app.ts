import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth.service';
import { TemaService } from './core/tema.service';
import { Confirmacao } from './shared/confirmacao';
import { Icone, type NomeIcone } from './shared/icone';
import { Toasts } from './shared/toasts';

interface LinkNav {
  rota: string;
  rotulo: string;
  icone: NomeIcone;
  /** Caminhos que também marcam o link como ativo (ex.: a tela de um sistema conta como "Sistemas"). */
  tambem?: string[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Icone, Toasts, Confirmacao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly tema = inject(TemaService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly caminho = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Usados na barra do topo (md+) e na pílula do rodapé (celular, com ícone). */
  protected readonly links = computed((): LinkNav[] => [
    { rota: '/', rotulo: 'Sistemas', icone: 'monitor', tambem: ['/sistemas'] },
    { rota: '/dashboard', rotulo: 'Dashboard', icone: 'grafico' },
    { rota: '/favoritos', rotulo: 'Favoritos', icone: 'coracao' },
    ...(this.auth.administrador()
      ? [{ rota: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' as const }]
      : []),
  ]);

  protected ativo(link: LinkNav): boolean {
    const caminho = this.caminho().split(/[?#]/)[0];
    const dentro = (rota: string) => caminho === rota || caminho.startsWith(`${rota}/`);
    return (
      (link.rota === '/' ? caminho === '/' : dentro(link.rota)) || (link.tambem ?? []).some(dentro)
    );
  }

  protected async sair() {
    await this.auth.sair().catch(() => undefined);
    await this.router.navigate(['/login']);
  }
}
