import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ConfirmacaoService, type TomConfirmacao } from '../core/confirmacao.service';
import { Icone } from './icone';

const ESTILO_ICONE: Record<TomConfirmacao, string> = {
  perigo:
    'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25',
  atencao:
    'bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-900 dark:text-brand-300 dark:ring-brand-800',
};

const ESTILO_BOTAO: Record<TomConfirmacao, string> = {
  perigo:
    'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/25 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-rose-500 dark:border-rose-500 dark:bg-rose-500 dark:shadow-none dark:hover:border-rose-400 dark:hover:bg-rose-400',
  atencao: 'btn-primary',
};

/**
 * Modal de confirmação único da aplicação, controlado pelo ConfirmacaoService.
 * Fica sempre no DOM (app.html) e abre/fecha o <dialog> conforme o pedido atual.
 */
@Component({
  selector: 'app-confirmacao',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let pedido = servico.pedido();
    <dialog
      #dialogo
      role="alertdialog"
      aria-labelledby="titulo-confirmacao"
      aria-describedby="mensagem-confirmacao"
      class="m-auto w-[min(440px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl outline-none border border-line-strong bg-surface p-0 text-ink shadow-2xl shadow-brand-950/20 backdrop:bg-brand-950/40 backdrop:backdrop-blur-sm dark:shadow-black/60 dark:backdrop:bg-black/70"
      (close)="servico.responder(false)"
      (click)="cliqueNoFundo($event)"
    >
      @if (pedido) {
        <div class="flex gap-4 px-6 pt-6 pb-5">
          <span
            class="grid size-11 shrink-0 place-items-center rounded-full ring-4"
            [class]="estiloIcone[pedido.tom]"
          >
            <app-icone [nome]="pedido.icone" [tamanho]="20" />
          </span>
          <div class="min-w-0 pt-0.5">
            <h2 id="titulo-confirmacao" class="text-lg leading-snug font-semibold">
              {{ pedido.titulo }}
            </h2>
            <p
              id="mensagem-confirmacao"
              class="mt-1.5 text-sm leading-relaxed break-words text-muted"
            >
              {{ pedido.mensagem }}
            </p>
          </div>
        </div>
        <div
          class="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/60 px-6 py-4 sm:flex-row sm:justify-end dark:bg-canvas/40"
        >
          <!-- "Cancelar" vem primeiro no DOM para receber o foco ao abrir (mais seguro em ações destrutivas). -->
          <button type="button" class="btn w-full sm:w-auto" (click)="servico.responder(false)">
            {{ pedido.cancelar }}
          </button>
          <button
            type="button"
            class="btn w-full sm:w-auto"
            [class]="estiloBotao[pedido.tom]"
            (click)="servico.responder(true)"
          >
            {{ pedido.confirmar }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class Confirmacao {
  protected readonly servico = inject(ConfirmacaoService);
  protected readonly estiloIcone = ESTILO_ICONE;
  protected readonly estiloBotao = ESTILO_BOTAO;

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      const aberto = this.servico.pedido() !== null;
      if (aberto && !dialogo.open) dialogo.showModal();
      if (!aberto && dialogo.open) dialogo.close();
    });
  }

  protected cliqueNoFundo(evento: MouseEvent) {
    if (evento.target === this.dialogo().nativeElement) this.servico.responder(false);
  }
}
