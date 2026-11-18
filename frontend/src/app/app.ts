import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
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

  protected async sair() {
    await this.auth.sair().catch(() => undefined);
    await this.router.navigate(['/login']);
  }
}
