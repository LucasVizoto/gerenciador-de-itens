import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { STATUS, TIPOS } from '../../core/dominio';
import type { Item, StatusItem } from '../../core/models';
import { Icone } from '../../shared/icone';

type StatusMarcavel = Exclude<StatusItem, 'PENDENTE'>;

const OPCOES: Array<{ status: StatusMarcavel; ativo: string }> = [
  { status: 'ATENDE', ativo: 'border-emerald-500/70 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400' },
  { status: 'NAO_ATENDE', ativo: 'border-rose-500/70 bg-rose-500/15 text-rose-300 hover:border-rose-400' },
];

const BORDA: Record<StatusItem, string> = {
  ATENDE: 'border-l-emerald-500',
  NAO_ATENDE: 'border-l-rose-500',
  PENDENTE: 'border-l-transparent',
};

/** Linha do checklist. O `cdkDrag` fica no host (aplicado pelo pai); aqui só o handle. */
@Component({
  selector: 'app-item-linha',
  imports: [CdkDragHandle, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="grid grid-cols-[20px_64px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-t border-l-2 border-t-line px-4 py-4 transition-colors duration-700 sm:px-5 xl:grid-cols-[20px_72px_minmax(0,1fr)_auto]"
      [class]="classes()"
    >
      <button
        type="button"
        cdkDragHandle
        class="mt-0.5 cursor-grab text-faint transition-colors hover:text-ink-soft active:cursor-grabbing print:hidden"
        [class.invisible]="!arrastavel()"
        [attr.aria-label]="'Arrastar ' + rotulo()"
      >
        <app-icone nome="arrastar" />
      </button>

      <div class="pt-0.5">
        <p class="text-xs font-bold tracking-wide text-muted">{{ rotulo() }}</p>
        @if (item().tipo === 'COMPLEMENTAR') {
          <span class="mt-1 inline-block rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-muted">Complementar</span>
        }
      </div>

      <div class="min-w-0">
        <p class="text-sm leading-relaxed text-ink-soft">{{ item().descricao }}</p>
        @if (item().observacao) {
          <p class="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <app-icone nome="comentario" [tamanho]="13" class="mt-0.5" />
            <span>{{ item().observacao }}</span>
          </p>
        }
      </div>

      <div class="col-span-2 col-start-2 flex flex-wrap items-center gap-1.5 xl:col-span-1 xl:col-start-auto">
        @for (opcao of opcoes; track opcao.status) {
          <button
            type="button"
            class="status-btn rounded-lg border px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors"
            [class]="item().status === opcao.status ? opcao.ativo : 'border-line-strong bg-surface text-ink-soft hover:border-brand-500 hover:text-ink'"
            [attr.aria-pressed]="item().status === opcao.status"
            (click)="status.emit(opcao.status)"
          >
            {{ rotulos[opcao.status].simbolo }} {{ rotulos[opcao.status].rotulo }}
          </button>
        }
        <button
          type="button"
          class="btn btn-ghost px-2 py-2 text-base leading-none print:hidden"
          title="Deixar pendente"
          [attr.aria-label]="'Limpar ' + rotulo()"
          [disabled]="item().status === 'PENDENTE'"
          (click)="status.emit('PENDENTE')"
        >
          ↺
        </button>
        <button
          type="button"
          class="btn btn-ghost px-2 py-2 print:hidden"
          title="Editar item"
          [attr.aria-label]="'Editar ' + rotulo()"
          (click)="editar.emit()"
        >
          <app-icone nome="editar" [tamanho]="14" />
        </button>
        <span class="w-3.5 text-brand-300" aria-hidden="true">
          @if (salvando()) {
            <span class="spinner size-3!"></span>
          }
        </span>
      </div>
    </div>
  `,
})
export class ItemLinha {
  readonly item = input.required<Item>();
  readonly arrastavel = input(false);
  readonly salvando = input(false);
  /** Destaca brevemente quando outro avaliador altera o item. */
  readonly destaque = input(false);

  readonly status = output<StatusItem>();
  readonly editar = output<void>();

  protected readonly opcoes = OPCOES;
  protected readonly rotulos = STATUS;
  protected readonly classes = computed(
    () => `${BORDA[this.item().status]} ${this.destaque() ? 'bg-brand-500/10' : 'bg-surface'}`,
  );
  protected readonly rotulo = computed(() => {
    const { tipo, numero } = this.item();
    return numero ? `${TIPOS[tipo].prefixo} ${numero}` : TIPOS[tipo].prefixo;
  });
}
