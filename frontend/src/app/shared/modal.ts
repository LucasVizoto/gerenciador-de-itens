import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Icone } from './icone';

/** Modal baseado em <dialog>: foco preso, ESC e backdrop nativos do navegador. */
@Component({
  selector: 'app-modal',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      class="m-auto max-h-[calc(100dvh-2rem)] w-[min(680px,calc(100vw-2rem))] max-w-none rounded-2xl border border-line-strong bg-surface p-0 text-ink shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      [attr.aria-label]="titulo()"
      (close)="fechado.emit()"
      (click)="cliqueNoFundo($event)"
    >
      <header class="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
        <h2 class="text-lg font-semibold">{{ titulo() }}</h2>
        <button type="button" class="btn btn-ghost p-2" aria-label="Fechar" (click)="fechar()">
          <app-icone nome="fechar" />
        </button>
      </header>
      <div class="px-6 py-5">
        <ng-content />
      </div>
    </dialog>
  `,
})
export class Modal {
  readonly titulo = input.required<string>();
  readonly aberto = input(false);
  readonly fechado = output<void>();

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    effect(() => {
      const dialogo = this.dialogo().nativeElement;
      if (this.aberto() && !dialogo.open) dialogo.showModal();
      if (!this.aberto() && dialogo.open) dialogo.close();
    });
  }

  fechar() {
    this.dialogo().nativeElement.close();
  }

  cliqueNoFundo(evento: MouseEvent) {
    if (evento.target === this.dialogo().nativeElement) this.fechar();
  }
}
