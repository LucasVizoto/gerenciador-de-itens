import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { DadosResponsavel, DadosSistema, Responsavel, Sistema } from '../../core/models';
import { Icone } from '../../shared/icone';

const MAX_RESPONSAVEIS = 50;

/** Cadastro do sistema e do edital em que ele é apresentado. */
@Component({
  selector: 'app-sistema-form',
  imports: [ReactiveFormsModule, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" class="grid gap-4 sm:grid-cols-2" novalidate>
      <div>
        <label class="label" for="nome">Nome do sistema *</label>
        <input
          id="nome"
          class="input"
          formControlName="nome"
          placeholder="Ex.: Gestão de Frotas"
          autofocus
        />
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
        <input
          id="numero"
          class="input"
          formControlName="numero"
          placeholder="Ex.: Pregão Eletrônico 012/2026"
        />
      </div>
      <div>
        <label class="label" for="orgao">Órgão</label>
        <input
          id="orgao"
          class="input"
          formControlName="orgao"
          placeholder="Ex.: Prefeitura Municipal de ..."
        />
      </div>

      <div>
        <label class="label" for="cidade">Cidade</label>
        <input id="cidade" class="input" formControlName="cidade" placeholder="Ex.: Franca - SP" />
      </div>
      <div>
        <label class="label" for="data">Data da apresentação</label>
        <input id="data" type="date" class="input" formControlName="dataApresentacao" />
      </div>
      <div>
        <label class="label" for="meta">Meta de itens essenciais (%)</label>
        <input
          id="meta"
          type="number"
          min="1"
          max="100"
          class="input"
          formControlName="metaPercentual"
        />
        @if (form.controls.metaPercentual.invalid) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Use um valor entre 1 e 100.</p>
        }
      </div>

      <fieldset class="sm:col-span-2">
        <legend class="label">Responsáveis</legend>
        <p class="-mt-0.5 mb-2 text-xs text-muted">
          Assinam o relatório: ao imprimir, cada responsável recebe um PDF com o nome dele, a cidade
          e a data do dia.
        </p>
        @if (responsaveis().length) {
          <ol class="mb-2 space-y-1.5">
            @for (responsavel of responsaveis(); track $index) {
              <li class="flex items-center gap-2">
                <span
                  class="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600 tabular-nums dark:bg-brand-900 dark:text-brand-300"
                  >{{ $index + 1 }}</span
                >
                <input
                  class="input py-2"
                  maxlength="200"
                  [attr.aria-label]="'Nome do responsável ' + ($index + 1)"
                  [value]="responsavel.nome"
                  (input)="renomearResponsavel($index, $any($event.target).value)"
                />
                <button
                  type="button"
                  class="btn btn-ghost shrink-0 p-2"
                  [attr.aria-label]="'Remover ' + (responsavel.nome || 'responsável')"
                  (click)="removerResponsavel($index)"
                >
                  <app-icone nome="lixeira" [tamanho]="15" />
                </button>
              </li>
            }
          </ol>
        }
        @if (responsaveis().length < maxResponsaveis) {
          <div class="flex gap-2">
            <input
              #campoNovoResponsavel
              id="novo-responsavel"
              class="input py-2"
              maxlength="200"
              placeholder="Nome completo do responsável"
              aria-label="Nome do novo responsável"
              [value]="novoResponsavel()"
              (input)="novoResponsavel.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); adicionarResponsavel()"
            />
            <button
              type="button"
              class="btn shrink-0 py-2"
              [disabled]="!novoResponsavel().trim()"
              (click)="adicionarResponsavel()"
            >
              <app-icone nome="mais" [tamanho]="14" /> Adicionar
            </button>
          </div>
        }
      </fieldset>

      <div class="sm:col-span-2">
        <label class="label" for="descricao">Descrição do sistema</label>
        <input
          id="descricao"
          class="input"
          formControlName="descricao"
          placeholder="Ex.: Sistema web de gestão de frotas"
        />
      </div>
      <div class="sm:col-span-2">
        <label class="label" for="objeto">Objeto do edital</label>
        <textarea
          id="objeto"
          rows="3"
          class="input"
          formControlName="objeto"
          placeholder="Resumo do objeto do edital"
        ></textarea>
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
  readonly responsaveisAtuais = input<Responsavel[]>([], { alias: 'responsaveis' });
  readonly salvando = input(false);
  readonly salvar = output<DadosSistema>();
  readonly cancelar = output<void>();

  protected readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    versao: new FormControl('', { nonNullable: true }),
    descricao: new FormControl('', { nonNullable: true }),
    numero: new FormControl('', { nonNullable: true }),
    orgao: new FormControl('', { nonNullable: true }),
    cidade: new FormControl('', { nonNullable: true }),
    objeto: new FormControl('', { nonNullable: true }),
    dataApresentacao: new FormControl('', { nonNullable: true }),
    metaPercentual: new FormControl(85, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
  });

  protected readonly responsaveis = signal<DadosResponsavel[]>([]);
  protected readonly novoResponsavel = signal('');
  protected readonly maxResponsaveis = MAX_RESPONSAVEIS;
  private readonly campoNovoResponsavel =
    viewChild<ElementRef<HTMLInputElement>>('campoNovoResponsavel');

  ngOnInit() {
    this.responsaveis.set(this.responsaveisAtuais().map(({ id, nome }) => ({ id, nome })));
    const sistema = this.sistema();
    if (!sistema) return;
    this.form.setValue({
      nome: sistema.nome,
      versao: sistema.versao ?? '',
      descricao: sistema.descricao ?? '',
      numero: sistema.numero ?? '',
      orgao: sistema.orgao ?? '',
      cidade: sistema.cidade ?? '',
      objeto: sistema.objeto ?? '',
      dataApresentacao: sistema.dataApresentacao?.slice(0, 10) ?? '',
      metaPercentual: sistema.metaPercentual,
    });
  }

  protected adicionarResponsavel() {
    const nome = this.novoResponsavel().trim();
    if (!nome || this.responsaveis().length >= MAX_RESPONSAVEIS) return;
    this.responsaveis.update((lista) => [...lista, { nome }]);
    this.novoResponsavel.set('');
    // Limpa o campo direto: se o signal não chegou a ser renderizado com o texto digitado,
    // o binding [value] não enxerga a volta para '' e o texto ficaria no campo.
    const campo = this.campoNovoResponsavel()?.nativeElement;
    if (campo) campo.value = '';
  }

  protected renomearResponsavel(indice: number, nome: string) {
    this.responsaveis.update((lista) => lista.map((r, i) => (i === indice ? { ...r, nome } : r)));
  }

  protected removerResponsavel(indice: number) {
    this.responsaveis.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Um nome digitado e ainda não adicionado também entra (evita perder o que foi escrito).
    this.adicionarResponsavel();
    const valor = this.form.getRawValue();
    this.salvar.emit({
      nome: valor.nome.trim(),
      versao: valor.versao.trim() || null,
      descricao: valor.descricao.trim() || null,
      numero: valor.numero.trim() || null,
      orgao: valor.orgao.trim() || null,
      cidade: valor.cidade.trim() || null,
      objeto: valor.objeto.trim() || null,
      dataApresentacao: valor.dataApresentacao || null,
      metaPercentual: valor.metaPercentual,
      responsaveis: this.responsaveis()
        .map(({ id, nome }) => ({ ...(id ? { id } : {}), nome: nome.trim() }))
        .filter((r) => r.nome),
    });
  }
}
