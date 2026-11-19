import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { Icone } from './icone';

/**
 * Bolinha no canto inferior direito que leva ao topo da página.
 * Aparece quando o elemento `alvo` (o cabeçalho da página) sai totalmente da tela.
 */
@Component({
  selector: 'app-voltar-topo',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="fixed right-5 z-40 grid size-12 place-items-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-950/25 ring-1 ring-white/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:right-6 dark:bg-brand-500 dark:shadow-black/40 dark:hover:bg-brand-400 print:hidden"
      [class]="estado()"
      [attr.aria-hidden]="!visivel()"
      [tabindex]="visivel() ? 0 : -1"
      aria-label="Voltar ao topo"
      title="Voltar ao topo"
      (click)="subir()"
    >
      <app-icone nome="seta-cima" [tamanho]="20" />
    </button>
  `,
})
export class VoltarTopo {
  /** Elemento observado; o botão aparece quando ele deixa de estar visível. */
  readonly alvo = input.required<HTMLElement>();
  /**
   * Sobe o botão quando há outra barra fixa no rodapé (ex.: ações da seleção de itens).
   * No celular essa barra ocupa a largura toda e cresce em várias linhas, então o botão some.
   */
  readonly elevado = input(false);

  protected readonly visivel = signal(false);
  protected readonly estado = computed(
    () =>
      `${this.elevado() ? 'bottom-[calc(var(--nav-movel)+10rem)] max-sm:pointer-events-none max-sm:opacity-0 sm:bottom-[calc(var(--nav-movel)+7rem)]' : 'bottom-[calc(var(--nav-movel)+1.25rem)] sm:bottom-[calc(var(--nav-movel)+1.5rem)]'} ` +
      (this.visivel() ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-90 opacity-0'),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observador = new IntersectionObserver(([entrada]) => this.visivel.set(!entrada.isIntersecting));
      observador.observe(this.alvo());
      destroyRef.onDestroy(() => observador.disconnect());
    });
  }

  protected subir() {
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduzirMovimento ? 'auto' : 'smooth' });
  }
}
