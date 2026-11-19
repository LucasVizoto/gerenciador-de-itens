import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { TemaService } from './core/tema.service';
import { Icone } from './shared/icone';
import { Toasts } from './shared/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly tema = inject(TemaService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Menu recolhível das telas estreitas (abaixo de md). */
  protected readonly menuAberto = signal(false);

  protected readonly links = computed(() => [
    { rota: '/', rotulo: 'Sistemas', exato: true },
    { rota: '/dashboard', rotulo: 'Dashboard', exato: false },
    { rota: '/favoritos', rotulo: 'Favoritos', exato: false },
    ...(this.auth.administrador() ? [{ rota: '/usuarios', rotulo: 'Usuários', exato: false }] : []),
  ]);

  constructor() {
    // Fecha o menu móvel ao trocar de página (inclusive pelo voltar do navegador).
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuAberto.set(false));
  }

  protected async sair() {
    await this.auth.sair().catch(() => undefined);
    await this.router.navigate(['/login']);
  }
}
