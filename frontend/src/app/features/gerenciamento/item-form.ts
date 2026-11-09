import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ORDEM_TIPOS, TIPOS } from '../../core/dominio';
import type { Categoria, DadosItem, Item, TipoItem } from '../../core/models';
import { Icone } from '../../shared/icone';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" class="grid gap-4 sm:grid-cols-3" novalidate>
      <div>
        <label class="label" for="tipo">Tipo</label>
        <select id="tipo" class="input" formControlName="tipo">
          @for (tipo of tipos; track tipo) {
            <option [value]="tipo">{{ rotulosTipo[tipo].rotulo }}</option>
          }
        </select>
      </div>
      <div>
        <label class="label" for="numero">Numeração no edital</label>
        <input id="numero" class="input" formControlName="numero" placeholder="Ex.: 12 ou 3.1.2" />
      </div>
      <div>
        <label class="label" for="etapa">Grupo</label>
        <select id="etapa" class="input" formControlName="categoriaId">
          <option value="">Sem grupo</option>
          @for (categoria of categorias(); track categoria.id; let i = $index) {
            <option [value]="categoria.id">{{ i + 1 }} · {{ categoria.nome }}</option>
          }
        </select>
      </div>

      <div class="sm:col-span-3">
        <label class="label" for="descricao">Requisito *</label>
        <textarea id="descricao" rows="5" class="input leading-relaxed" formControlName="descricao"></textarea>
        @if (form.controls.descricao.touched && form.controls.descricao.invalid) {
          <p class="mt-1 text-xs text-rose-700 dark:text-rose-300">Informe o texto do requisito.</p>
        }
      </div>
      <div class="sm:col-span-3">
        <label class="label" for="observacao">Observação da avaliação</label>
        <textarea
          id="observacao"
          rows="2"
          class="input"
          formControlName="observacao"
          placeholder="Ex.: atende via relatório X; demonstrar no grupo 5"
        ></textarea>
      </div>

      <div class="flex items-center gap-2 border-t border-line pt-4 sm:col-span-3">
        @if (item()) {
          <button type="button" class="btn btn-ghost btn-danger" (click)="remover.emit()">
            <app-icone nome="lixeira" [tamanho]="14" /> Excluir item
          </button>
        }
        <span class="flex-1"></span>
        <button type="button" class="btn btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" class="btn btn-primary">{{ item() ? 'Salvar' : 'Adicionar item' }}</button>
      </div>
    </form>
  `,
})
export class ItemForm implements OnInit {
  readonly item = input<Item | null>(null);
  readonly categorias = input.required<Categoria[]>();
  readonly salvar = output<DadosItem>();
  readonly remover = output<void>();
  readonly cancelar = output<void>();

  protected readonly tipos = ORDEM_TIPOS;
  protected readonly rotulosTipo = TIPOS;

  protected readonly form = new FormGroup({
    tipo: new FormControl<TipoItem>('ESSENCIAL', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    categoriaId: new FormControl('', { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(10_000)] }),
    observacao: new FormControl('', { nonNullable: true }),
  });

  ngOnInit() {
    const item = this.item();
    if (item) {
      this.form.setValue({
        tipo: item.tipo,
        numero: item.numero ?? '',
        categoriaId: item.categoriaId ?? '',
        descricao: item.descricao,
        observacao: item.observacao ?? '',
      });
    }
  }

  protected enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    this.salvar.emit({
      tipo: valor.tipo,
      numero: valor.numero.trim() || null,
      categoriaId: valor.categoriaId || null,
      descricao: valor.descricao.trim(),
      observacao: valor.observacao.trim() || null,
    });
  }
}
