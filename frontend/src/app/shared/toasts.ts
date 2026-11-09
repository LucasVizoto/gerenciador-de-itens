import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, type TipoToast } from '../core/toast.service';
import { Icone } from './icone';

const ESTILOS: Record<TipoToast, string> = {
  sucesso:
    'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-100',
  erro: 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/90 dark:text-rose-100',
  info: 'border-line-strong bg-surface/95 text-ink dark:bg-surface-2/95',
};

@Component({
  selector: 'app-toasts',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(400px,calc(100vw-2rem))] flex-col gap-2 print:hidden"
      aria-live="polite"
    >
      @for (toast of servico.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl shadow-brand-950/10 backdrop-blur dark:shadow-black/40"
          [class]="estilos[toast.tipo]"
          role="status"
        >
          <p class="flex-1 leading-relaxed">{{ toast.mensagem }}</p>
          <button type="button" class="opacity-60 hover:opacity-100" aria-label="Fechar aviso" (click)="servico.fechar(toast.id)">
            <app-icone nome="fechar" [tamanho]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly servico = inject(ToastService);
  protected readonly estilos = ESTILOS;
}
