import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Categoria } from '../../core/models';
import { AutoFoco } from '../../shared/auto-foco';
import { Icone } from '../../shared/icone';

export interface ProgressoEtapa {
  atendidos: number;
  total: number;
}

/** Lista das etapas (processos) da apresentação: reordenar, renomear, criar e navegar. */
@Component({
  selector: 'app-etapas-painel',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, AutoFoco, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <aside class="card p-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold">Etapas da apresentação</h2>
        <span class="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">{{ categorias().length }}</span>
      </div>
      <p class="mt-1 text-xs leading-relaxed text-muted">Arraste para definir a ordem em que os processos serão apresentados.</p>

      <ol
        cdkDropList
        class="mt-3 max-h-[55vh] space-y-0.5 overflow-y-auto pr-1"
        (cdkDropListDropped)="reordenar.emit($event)"
      >
        @for (categoria of categorias(); track categoria.id; let i = $index) {
          <li cdkDrag cdkDragLockAxis="y" class="group flex items-center gap-2 rounded-lg bg-surface px-1.5 py-1.5 hover:bg-surface-3">
            <span cdkDragHandle class="cursor-grab text-faint hover:text-ink-soft active:cursor-grabbing" aria-label="Arrastar etapa">
              <app-icone nome="arrastar" [tamanho]="14" />
            </span>
            <span class="grid size-6 shrink-0 place-items-center rounded-md bg-brand-900 text-[11px] font-bold text-brand-300 tabular-nums">
              {{ i + 1 }}
            </span>

            @if (renomeando() === categoria.id) {
              <input
                #campo
                appAutoFoco
                class="input px-2 py-1"
                [value]="categoria.nome"
                aria-label="Novo nome da etapa"
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
                [class]="completa(categoria) ? 'text-emerald-300' : 'text-faint'"
              >
                {{ progresso().get(categoria.id)?.atendidos ?? 0 }}/{{ progresso().get(categoria.id)?.total ?? 0 }}
              </span>
              <span class="flex shrink-0 md:hidden md:group-focus-within:flex md:group-hover:flex">
                <button type="button" class="rounded p-1 text-faint hover:text-ink" aria-label="Renomear etapa" (click)="renomeando.set(categoria.id)">
                  <app-icone nome="editar" [tamanho]="13" />
                </button>
                <button type="button" class="rounded p-1 text-faint hover:text-rose-300" aria-label="Excluir etapa" (click)="remover.emit(categoria)">
                  <app-icone nome="lixeira" [tamanho]="13" />
                </button>
              </span>
            }
          </li>
        } @empty {
          <li class="rounded-lg border border-dashed border-line-strong px-3 py-4 text-center text-xs text-muted">
            Nenhuma etapa ainda. Crie abaixo ou importe um CSV com a coluna "Etapa".
          </li>
        }
      </ol>

      <form class="mt-3 flex gap-2 border-t border-line pt-3" (submit)="$event.preventDefault(); adicionar(nova)">
        <input #nova class="input py-2" placeholder="Nova etapa…" aria-label="Nome da nova etapa" maxlength="200" />
        <button type="submit" class="btn px-3" aria-label="Adicionar etapa"><app-icone nome="mais" /></button>
      </form>
    </aside>
  `,
})
export class EtapasPainel {
  readonly categorias = input.required<Categoria[]>();
  readonly progresso = input.required<Map<string, ProgressoEtapa>>();

  readonly reordenar = output<CdkDragDrop<Categoria[]>>();
  readonly criar = output<string>();
  readonly renomear = output<{ categoria: Categoria; nome: string }>();
  readonly remover = output<Categoria>();
  readonly navegar = output<Categoria>();

  protected readonly renomeando = signal<string | null>(null);

  protected completa(categoria: Categoria) {
    const p = this.progresso().get(categoria.id);
    return !!p && p.total > 0 && p.atendidos === p.total;
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
