import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, Injector, afterNextRender, inject, input, output, signal } from '@angular/core';
import type { Categoria } from '../../core/models';
import { AutoFoco } from '../../shared/auto-foco';
import { Icone } from '../../shared/icone';

export interface ProgressoEtapa {
  atendidos: number;
  total: number;
}

/** Mudança de posição de um grupo na lista (índices 0-based). */
export interface MovimentoEtapa {
  de: number;
  para: number;
}

/** Lista dos grupos (etapas/processos) da apresentação: reordenar, renomear, criar e navegar. */
@Component({
  selector: 'app-etapas-painel',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, AutoFoco, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <aside class="card p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Grupos da apresentação</h2>
        <span class="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">{{ categorias().length }}</span>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-muted">
        Arraste ou use as setas ↑/↓ para definir a ordem em que os grupos serão apresentados.
      </p>

      <ol
        cdkDropList
        class="mt-3 max-h-[55vh] space-y-0.5 overflow-y-auto pr-1"
        (cdkDropListDropped)="soltar($event)"
      >
        @for (categoria of categorias(); track categoria.id; let i = $index, primeiro = $first, ultimo = $last) {
          <li cdkDrag cdkDragLockAxis="y" class="group flex items-center gap-2 rounded-lg bg-surface px-1.5 py-1.5 hover:bg-surface-3">
            <span cdkDragHandle class="cursor-grab text-faint hover:text-ink-soft active:cursor-grabbing" aria-label="Arrastar grupo">
              <app-icone nome="arrastar" [tamanho]="14" />
            </span>
            <span
              class="grid size-6 shrink-0 place-items-center rounded-md bg-brand-50 text-[11px] font-bold text-brand-600 tabular-nums dark:bg-brand-900 dark:text-brand-300"
            >
              {{ i + 1 }}
            </span>

            @if (renomeando() === categoria.id) {
              <input
                #campo
                appAutoFoco
                class="input px-2 py-1"
                [value]="categoria.nome"
                aria-label="Novo nome do grupo"
                maxlength="200"
                (keydown.enter)="confirmarRenomear(categoria, campo.value)"
                (keydown.escape)="renomeando.set(null)"
                (blur)="confirmarRenomear(categoria, campo.value)"
              />
            } @else {
              <button
                type="button"
                class="min-w-0 flex-1 truncate text-left text-[13px] text-ink-soft hover:text-ink"
                [title]="categoria.nome"
                (click)="navegar.emit(categoria)"
              >
                {{ categoria.nome }}
              </button>
              <span
                class="shrink-0 text-[11px] tabular-nums md:group-focus-within:hidden md:group-hover:hidden"
                [class]="completa(categoria) ? 'text-emerald-700 dark:text-emerald-300' : 'text-faint'"
              >
                {{ progresso().get(categoria.id)?.atendidos ?? 0 }}/{{ progresso().get(categoria.id)?.total ?? 0 }}
              </span>
              <span class="flex shrink-0 md:hidden md:group-focus-within:flex md:group-hover:flex">
                <button
                  type="button"
                  class="rounded p-1 text-faint hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  [id]="'grupo-sobe-' + categoria.id"
                  [attr.aria-label]="'Subir o grupo ' + categoria.nome"
                  title="Subir"
                  [disabled]="primeiro"
                  (click)="moverPara(categoria, i, i - 1, 'sobe')"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-faint hover:text-ink disabled:pointer-events-none disabled:opacity-30"
                  [id]="'grupo-desce-' + categoria.id"
                  [attr.aria-label]="'Descer o grupo ' + categoria.nome"
                  title="Descer"
                  [disabled]="ultimo"
                  (click)="moverPara(categoria, i, i + 1, 'desce')"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <button type="button" class="rounded p-1 text-faint hover:text-ink" aria-label="Renomear grupo" (click)="renomeando.set(categoria.id)">
                  <app-icone nome="editar" [tamanho]="13" />
                </button>
                <button
                  type="button"
                  class="rounded p-1 text-faint hover:text-rose-700 dark:hover:text-rose-300"
                  aria-label="Excluir grupo"
                  (click)="remover.emit(categoria)"
                >
                  <app-icone nome="lixeira" [tamanho]="13" />
                </button>
              </span>
            }
          </li>
        } @empty {
          <li class="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-muted">
            Nenhum grupo ainda. Crie abaixo ou importe um CSV com a coluna "Etapa".
          </li>
        }
      </ol>

      <form class="mt-3 flex gap-2 border-t border-line pt-3" (submit)="$event.preventDefault(); adicionar(nova)">
        <input #nova class="input py-2" placeholder="Novo grupo…" aria-label="Nome do novo grupo" maxlength="200" />
        <button type="submit" class="btn px-3" aria-label="Adicionar grupo"><app-icone nome="mais" /></button>
      </form>
    </aside>
  `,
})
export class EtapasPainel {
  private readonly injector = inject(Injector);

  readonly categorias = input.required<Categoria[]>();
  readonly progresso = input.required<Map<string, ProgressoEtapa>>();

  readonly reordenar = output<MovimentoEtapa>();
  readonly criar = output<string>();
  readonly renomear = output<{ categoria: Categoria; nome: string }>();
  readonly remover = output<Categoria>();
  readonly navegar = output<Categoria>();

  protected readonly renomeando = signal<string | null>(null);

  protected completa(categoria: Categoria) {
    const p = this.progresso().get(categoria.id);
    return !!p && p.total > 0 && p.atendidos === p.total;
  }

  protected soltar(evento: CdkDragDrop<unknown>) {
    if (evento.previousIndex !== evento.currentIndex) {
      this.reordenar.emit({ de: evento.previousIndex, para: evento.currentIndex });
    }
  }

  protected moverPara(categoria: Categoria, de: number, para: number, direcao: 'sobe' | 'desce') {
    if (para < 0 || para >= this.categorias().length) return;
    this.reordenar.emit({ de, para });
    // A linha muda de lugar no DOM e perde o foco; devolve o foco ao mesmo botão (ou ao oposto, se chegou na ponta).
    afterNextRender(
      () => {
        const ultimo = this.categorias().length - 1;
        const noLimite = (direcao === 'sobe' && para === 0) || (direcao === 'desce' && para === ultimo);
        const alvo = noLimite ? (direcao === 'sobe' ? 'desce' : 'sobe') : direcao;
        document.getElementById(`grupo-${alvo}-${categoria.id}`)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected adicionar(campo: HTMLInputElement) {
    const nome = campo.value.trim();
    if (!nome) return;
    this.criar.emit(nome);
    campo.value = '';
  }

  protected confirmarRenomear(categoria: Categoria, valor: string) {
    if (this.renomeando() !== categoria.id) return;
    this.renomeando.set(null);
    const nome = valor.trim();
    if (nome && nome !== categoria.nome) this.renomear.emit({ categoria, nome });
  }
}
