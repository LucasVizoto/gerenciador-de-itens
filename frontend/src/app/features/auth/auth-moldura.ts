import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TemaService } from '../../core/tema.service';
import { Icone } from '../../shared/icone';

/**
 * Tela cheia do login/cadastro: gradiente azul claro com manchas desfocadas e o formulário
 * direto sobre o fundo (campos sublinhados e botões em pílula, ver `.campo-auth` e `.btn-pilula`).
 */
@Component({
  selector: 'app-auth-moldura',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative isolate flex min-h-dvh flex-col overflow-hidden bg-linear-to-br from-sky-400 via-blue-500 to-brand-500 dark:from-brand-700 dark:via-brand-800 dark:to-brand-900"
    >
      <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div class="absolute -top-40 -left-32 size-[32rem] rounded-full bg-white/30 blur-3xl dark:bg-sky-400/15"></div>
        <div class="absolute top-1/4 -right-40 size-[28rem] rounded-full bg-sky-200/35 blur-3xl dark:bg-brand-400/20"></div>
        <div class="absolute -bottom-48 left-1/5 size-[34rem] rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-500/20"></div>
      </div>

      <button
        type="button"
        class="absolute top-4 right-4 rounded-full p-2.5 text-white/85 transition-colors hover:bg-white/15 hover:text-white sm:right-6"
        aria-label="Alternar tema"
        [title]="tema.escuro() ? 'Usar tema claro' : 'Usar tema escuro'"
        (click)="tema.alternar()"
      >
        <app-icone [nome]="tema.escuro() ? 'sol' : 'lua'" [tamanho]="18" />
      </button>

      <main class="flex flex-1 items-center justify-center px-6 py-14">
        <div class="w-full max-w-sm">
          <div class="flex flex-col items-center text-center">
            <img src="/image.png" alt="Eddydata" class="h-24 w-auto drop-shadow-[0_6px_16px_rgb(11_31_77/0.25)]" />
            <p class="mt-6 text-[11px] font-semibold tracking-[0.25em] text-white/80 uppercase">Conformidade · Sistemas</p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-white">{{ titulo() }}</h1>
            @if (subtitulo()) {
              <p class="mt-2 text-sm leading-relaxed text-white/80">{{ subtitulo() }}</p>
            }
          </div>

          <div class="mt-10">
            <ng-content />
          </div>
        </div>
      </main>
    </div>
  `,
})
export class AuthMoldura {
  protected readonly tema = inject(TemaService);
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
}
