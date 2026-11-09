import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { STATUS, TIPOS } from '../../core/dominio';
import type { Item, StatusItem, TipoItem } from '../../core/models';
import { AutoFoco } from '../../shared/auto-foco';
import { Icone } from '../../shared/icone';

type StatusMarcavel = Exclude<StatusItem, 'PENDENTE'>;

const OPCOES: Array<{ status: StatusMarcavel; ativo: string }> = [
  {
    status: 'ATENDE',
    ativo:
      'border-emerald-500 bg-emerald-50 text-emerald-700 hover:border-emerald-600 ' +
      'dark:border-emerald-500/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:border-emerald-400',
  },
  {
    status: 'NAO_ATENDE',
    ativo:
      'border-rose-500 bg-rose-50 text-rose-700 hover:border-rose-600 ' +
      'dark:border-rose-500/70 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:border-rose-400',
  },
];

const BORDA: Record<StatusItem, string> = {
  ATENDE: 'border-l-emerald-500',
  NAO_ATENDE: 'border-l-rose-500',
  PENDENTE: 'border-l-transparent',
};

/** Selo dos tipos que ficam fora do cálculo da meta. */
const SELO: Partial<Record<TipoItem, string>> = {
  COMPLEMENTAR: 'bg-surface-3 text-muted',
  DISPENSADO:
    'border border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300',
};

/** Linha do checklist. O `cdkDrag` fica no host (aplicado pelo pai); aqui só o handle. */
@Component({
  selector: 'app-item-linha',
  imports: [CdkDragHandle, AutoFoco, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="grid grid-cols-[auto_96px_minmax(0,1fr)] items-start gap-x-3 gap-y-3 border-t border-l-2 border-t-line px-4 py-4 transition-colors duration-700 sm:px-5 xl:grid-cols-[auto_104px_minmax(0,1fr)_auto]"
      [class]="classes()"
    >
      <div class="flex items-center gap-2 pt-0.5 print:hidden">
        @if (selecionavel()) {
          <input
            type="checkbox"
            class="size-4 cursor-pointer rounded border-line-strong accent-brand-600"
            [checked]="selecionado()"
            [attr.aria-label]="'Selecionar ' + rotulo()"
            (change)="selecionar.emit($any($event.target).checked)"
          />
        }
        <button
          type="button"
          cdkDragHandle
          class="cursor-grab text-faint transition-colors hover:text-ink-soft active:cursor-grabbing"
          [class.invisible]="!arrastavel()"
          [attr.aria-label]="'Arrastar ' + rotulo()"
          [attr.tabindex]="arrastavel() ? null : -1"
        >
          <app-icone nome="arrastar" />
        </button>
      </div>

      <div class="pt-0.5">
        <div class="flex flex-wrap items-center gap-1.5">
          @if (posicao(); as p) {
            @if (editandoPosicao()) {
              <input
                #campo
                appAutoFoco
                type="number"
                min="1"
                [attr.max]="totalGrupo() || null"
                class="w-14 rounded border border-brand-500 bg-surface px-1 py-0.5 text-[11px] font-semibold text-ink tabular-nums focus:ring-2 focus:ring-brand-500/25 focus:outline-none"
                [value]="p"
                [attr.aria-label]="'Nova posição de ' + rotulo() + ' no grupo (1 a ' + totalGrupo() + ')'"
                (keydown.enter)="$event.preventDefault(); confirmarPosicao(campo.value)"
                (keydown.escape)="$event.preventDefault(); editandoPosicao.set(false)"
                (blur)="confirmarPosicao(campo.value)"
              />
            } @else {
              <button
                type="button"
                class="min-w-6 rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted tabular-nums transition-colors hover:border-brand-500 hover:text-ink print:hidden"
                [title]="'Posição ' + p + ' no grupo · clique para digitar outra'"
                [attr.aria-label]="'Posição ' + p + ' de ' + totalGrupo() + ' no grupo. Alterar posição de ' + rotulo()"
                (click)="editandoPosicao.set(true)"
              >
                {{ p }}º
              </button>
            }
          }
          <p class="text-xs font-bold tracking-wide whitespace-nowrap text-muted">{{ rotulo() }}</p>
        </div>
        @if (selo(); as classe) {
          <span class="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium" [class]="classe">
            {{ tipos[item().tipo].rotulo }}
          </span>
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
        <span class="w-3.5 text-brand-600 dark:text-brand-300" aria-hidden="true">
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
  /** Posição (1-based) no grupo; `null` esconde o seletor de posição. */
  readonly posicao = input<number | null>(null);
  readonly totalGrupo = input(0);
  readonly selecionavel = input(false);
  readonly selecionado = input(false);

  readonly status = output<StatusItem>();
  readonly editar = output<void>();
  /** Nova posição (1-based) digitada para o item dentro do grupo. */
  readonly mover = output<number>();
  readonly selecionar = output<boolean>();

  protected readonly editandoPosicao = signal(false);

  protected readonly opcoes = OPCOES;
  protected readonly rotulos = STATUS;
  protected readonly tipos = TIPOS;
  protected readonly selo = computed(() => SELO[this.item().tipo] ?? null);
  protected readonly classes = computed(() => {
    const fundo = this.destaque() ? 'bg-brand-500/10' : this.selecionado() ? 'bg-brand-500/5' : 'bg-surface';
    return `${BORDA[this.item().status]} ${fundo}`;
  });
  protected readonly rotulo = computed(() => {
    const { tipo, numero } = this.item();
    return numero ? `${TIPOS[tipo].prefixo} ${numero}` : TIPOS[tipo].prefixo;
  });

  protected confirmarPosicao(valor: string) {
    // Esc e Enter já saíram do modo de edição; o blur que vem em seguida não deve confirmar de novo.
    if (!this.editandoPosicao()) return;
    this.editandoPosicao.set(false);
    const digitada = Math.round(Number(valor));
    if (!valor.trim() || !Number.isFinite(digitada)) return;
    const destino = Math.min(Math.max(digitada, 1), this.totalGrupo() || 1);
    if (destino !== this.posicao()) this.mover.emit(destino);
  }
}
