import { ChangeDetectionStrategy, Component, OnInit, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { DadosSistema, Sistema } from '../../core/models';

/** Cadastro do sistema e do edital em que ele é apresentado. */
@Component({
  selector: 'app-sistema-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" class="grid gap-4 sm:grid-cols-2" novalidate>
      <div>
        <label class="label" for="nome">Nome do sistema *</label>
        <input id="nome" class="input" formControlName="nome" placeholder="Ex.: Gestão de Frotas" autofocus />
        @if (form.controls.nome.touched && form.controls.nome.invalid) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Informe o nome do sistema.</p>
        }
      </div>
      <div>
        <label class="label" for="versao">Versão</label>
        <input id="versao" class="input" formControlName="versao" placeholder="Ex.: 2.4" />
      </div>

      <div>
        <label class="label" for="numero">Número do edital</label>
        <input id="numero" class="input" formControlName="numero" placeholder="Ex.: Pregão Eletrônico 012/2026" />
      </div>
      <div>
        <label class="label" for="orgao">Órgão</label>
        <input id="orgao" class="input" formControlName="orgao" placeholder="Ex.: Prefeitura Municipal de ..." />
      </div>

      <div>
        <label class="label" for="data">Data da apresentação</label>
        <input id="data" type="date" class="input" formControlName="dataApresentacao" />
      </div>
      <div>
        <label class="label" for="meta">Meta de itens essenciais (%)</label>
        <input id="meta" type="number" min="1" max="100" class="input" formControlName="metaPercentual" />
        @if (form.controls.metaPercentual.invalid) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Use um valor entre 1 e 100.</p>
        }
      </div>

      <div class="sm:col-span-2">
        <label class="label" for="descricao">Descrição do sistema</label>
        <input id="descricao" class="input" formControlName="descricao" placeholder="Ex.: Sistema web de gestão de frotas" />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="objeto">Objeto do edital</label>
        <textarea id="objeto" rows="3" class="input" formControlName="objeto" placeholder="Resumo do objeto do edital"></textarea>
      </div>

      <div class="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <button type="button" class="btn btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" class="btn btn-primary" [disabled]="salvando()">
          @if (salvando()) {
            <span class="spinner"></span>
          }
          {{ sistema() ? 'Salvar alterações' : 'Criar sistema' }}
        </button>
      </div>
    </form>
  `,
})
export class SistemaForm implements OnInit {
  readonly sistema = input<Sistema | null>(null);
  readonly salvando = input(false);
  readonly salvar = output<DadosSistema>();
  readonly cancelar = output<void>();

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    versao: new FormControl('', { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    orgao: new FormControl('', { nonNullable: true }),
    objeto: new FormControl('', { nonNullable: true }),
    dataApresentacao: new FormControl('', { nonNullable: true }),
    metaPercentual: new FormControl(85, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
  });

  ngOnInit() {
    const sistema = this.sistema();
    if (!sistema) return;
    this.form.setValue({
      nome: sistema.nome,
      versao: sistema.versao ?? '',
      descricao: sistema.descricao ?? '',
      numero: sistema.numero ?? '',
      orgao: sistema.orgao ?? '',
      objeto: sistema.objeto ?? '',
      dataApresentacao: sistema.dataApresentacao?.slice(0, 10) ?? '',
      metaPercentual: sistema.metaPercentual,
    });
  }

  protected enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    this.salvar.emit({
      nome: valor.nome.trim(),
      versao: valor.versao.trim() || null,
      descricao: valor.descricao.trim() || null,
      numero: valor.numero.trim() || null,
      orgao: valor.orgao.trim() || null,
      objeto: valor.objeto.trim() || null,
      dataApresentacao: valor.dataApresentacao || null,
      metaPercentual: valor.metaPercentual,
    });
  }
}
