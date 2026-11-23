import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import type { Apresentacao, DadosApresentacao, PessoaResumo, SistemaComResumo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { chaveDia, faixaHorario, minutos, somarMinutos, sobrepoe } from './agenda-util';

/** Valores pré-preenchidos ao criar (ex.: "adicionar neste dia" ou "salvar e adicionar outra"). */
export interface SugestaoApresentacao {
  data?: string;
  tema?: string | null;
  inicio?: string;
  apresentadorId?: string | null;
}

export interface EnvioApresentacao {
  dados: DadosApresentacao;
  /** "Salvar e adicionar outra": o formulário continua aberto para o próximo horário. */
  continuar: boolean;
}

const fimDepoisDoInicio = (grupo: AbstractControl): ValidationErrors | null => {
  const { inicio, fim } = grupo.value as { inicio: string; fim: string };
  return inicio && fim && minutos(fim) <= minutos(inicio) ? { faixa: true } : null;
};

/** Cadastro/edição de uma apresentação da agenda (sistema, dia, horário, apresentador e apoio). */
@Component({
  selector: 'app-apresentacao-form',
  imports: [ReactiveFormsModule, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar(false)" class="grid gap-4 sm:grid-cols-2" novalidate>
      <div>
        <label class="label" for="ap-sistema">Sistema *</label>
        <select id="ap-sistema" class="input" formControlName="sistemaId">
          <option value="" disabled>{{ carregando() ? 'Carregando…' : 'Escolha o sistema' }}</option>
          @for (sistema of sistemas(); track sistema.id) {
            <option [value]="sistema.id">{{ sistema.nome }}{{ sistema.versao ? ' · v' + sistema.versao : '' }}</option>
          }
        </select>
        @if (invalido('sistemaId')) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Escolha o sistema apresentado.</p>
        } @else if (!carregando() && !sistemas().length) {
          <p class="mt-1 text-xs text-muted">Nenhum sistema cadastrado ainda. Crie o sistema antes de agendar.</p>
        }
      </div>
      <div>
        <label class="label" for="ap-complemento">Complemento</label>
        <input id="ap-complemento" class="input" formControlName="complemento" maxlength="120" placeholder="Ex.: Parte 1" />
      </div>

      <div>
        <label class="label" for="ap-data">Dia *</label>
        <input id="ap-data" type="date" class="input" formControlName="data" />
        @if (invalido('data')) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Informe o dia da apresentação.</p>
        }
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="ap-inicio">Início *</label>
          <input id="ap-inicio" type="time" step="300" class="input" formControlName="inicio" />
        </div>
        <div>
          <label class="label" for="ap-fim">Fim *</label>
          <input id="ap-fim" type="time" step="300" class="input" formControlName="fim" />
        </div>
        @if (invalido('inicio') || invalido('fim')) {
          <p class="col-span-2 -mt-2 text-xs text-rose-600 dark:text-rose-300">Informe o horário de início e de fim.</p>
        } @else if (form.hasError('faixa') && (form.controls.fim.touched || form.controls.inicio.touched)) {
          <p class="col-span-2 -mt-2 text-xs text-rose-600 dark:text-rose-300">O fim deve ser depois do início.</p>
        }
      </div>

      <div class="sm:col-span-2">
        <label class="label" for="ap-tema">Bloco temático do dia</label>
        <input
          id="ap-tema"
          class="input"
          formControlName="tema"
          maxlength="200"
          list="ap-temas"
          placeholder="Ex.: Planejamento, execução orçamentária e contábil"
        />
        <datalist id="ap-temas">
          @for (tema of temas(); track tema) {
            <option [value]="tema"></option>
          }
        </datalist>
      </div>

      <div>
        <label class="label" for="ap-apresentador">Apresentador *</label>
        <select id="ap-apresentador" class="input" formControlName="apresentadorId">
          <option value="" disabled>{{ carregando() ? 'Carregando…' : 'Escolha quem apresenta' }}</option>
          @for (pessoa of pessoas(); track pessoa.id) {
            <option [value]="pessoa.id">{{ pessoa.nomeCompleto }}</option>
          }
        </select>
        @if (invalido('apresentadorId')) {
          <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">Escolha quem vai apresentar.</p>
        }
      </div>
      <div>
        <label class="label" for="ap-apoio">Apoio</label>
        <select id="ap-apoio" class="input" formControlName="apoioId">
          <option value="">Sem apoio</option>
          @for (pessoa of pessoas(); track pessoa.id) {
            <option [value]="pessoa.id">{{ pessoa.nomeCompleto }}</option>
          }
        </select>
      </div>

      @if (conflitos().length) {
        <div
          class="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900 sm:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          role="status"
        >
          <app-icone nome="alerta" [tamanho]="18" class="mt-0.5" />
          <div class="min-w-0">
            <p class="font-medium">Horário em conflito</p>
            <ul class="mt-1 space-y-0.5 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200/90">
              @for (conflito of conflitos(); track $index) {
                <li>{{ conflito }}</li>
              }
            </ul>
          </div>
        </div>
      }

      <div class="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:col-span-2 sm:flex-row sm:justify-end">
        <button type="button" class="btn btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        @if (!apresentacao()) {
          <button type="button" class="btn" [disabled]="salvando()" (click)="enviar(true)">
            <app-icone nome="mais" [tamanho]="14" /> Salvar e adicionar outra
          </button>
        }
        <button type="submit" class="btn btn-primary" [disabled]="salvando()">
          @if (salvando()) {
            <span class="spinner"></span>
          }
          {{ apresentacao() ? 'Salvar alterações' : 'Agendar apresentação' }}
        </button>
      </div>
    </form>
  `,
})
export class ApresentacaoForm implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Em edição; ausente = nova apresentação. */
  readonly apresentacao = input<Apresentacao | null>(null);
  readonly sugestao = input<SugestaoApresentacao | null>(null);
  /** Agenda atual: usada no aviso de conflito e nas sugestões de bloco temático. */
  readonly existentes = input<Apresentacao[]>([]);
  readonly salvando = input(false);
  readonly salvar = output<EnvioApresentacao>();
  readonly cancelar = output<void>();

  protected readonly form = new FormGroup(
    {
      sistemaId: new FormControl('', { nonNullable: true, validators: Validators.required }),
      complemento: new FormControl('', { nonNullable: true }),
      data: new FormControl('', { nonNullable: true, validators: Validators.required }),
      inicio: new FormControl('', { nonNullable: true, validators: Validators.required }),
      fim: new FormControl('', { nonNullable: true, validators: Validators.required }),
      tema: new FormControl('', { nonNullable: true }),
      apresentadorId: new FormControl('', { nonNullable: true, validators: Validators.required }),
      apoioId: new FormControl('', { nonNullable: true }),
    },
    { validators: fimDepoisDoInicio },
  );

  protected readonly sistemas = signal<SistemaComResumo[]>([]);
  protected readonly pessoas = signal<PessoaResumo[]>([]);
  protected readonly carregando = signal(true);

  private readonly valor = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly temas = computed(() => [
    ...new Set(this.existentes().flatMap((a) => (a.tema?.trim() ? [a.tema.trim()] : []))),
  ]);

  /** Outras apresentações do mesmo dia, em horário sobreposto, com o apresentador ou o apoio escolhidos. */
  protected readonly conflitos = computed(() => {
    const { data, inicio, fim, apresentadorId, apoioId } = { ...this.form.getRawValue(), ...this.valor() };
    if (!data || !inicio || !fim || minutos(fim) <= minutos(inicio)) return [];
    const escolhidos = new Set([apresentadorId, apoioId].filter(Boolean));
    if (!escolhidos.size) return [];

    const nomes = new Map(this.pessoas().map((p) => [p.id, p.nomeCompleto]));
    const idAtual = this.apresentacao()?.id;
    return this.existentes()
      .filter((a) => a.id !== idAtual && chaveDia(a.data) === data && sobrepoe(a, { inicio, fim }))
      .flatMap((a) =>
        [a.apresentadorId, a.apoioId]
          .filter((id, i, lista): id is string => !!id && escolhidos.has(id) && lista.indexOf(id) === i)
          .map((id) => {
            const nomeSistema = a.sistema.nome + (a.complemento ? ` (${a.complemento})` : '');
            return `${nomes.get(id) ?? 'Essa pessoa'} já está em ${nomeSistema}, ${faixaHorario(a)}.`;
          }),
      );
  });

  async ngOnInit() {
    const apresentacao = this.apresentacao();
    if (apresentacao) {
      this.form.setValue({
        sistemaId: apresentacao.sistemaId,
        complemento: apresentacao.complemento ?? '',
        data: chaveDia(apresentacao.data),
        inicio: apresentacao.inicio,
        fim: apresentacao.fim,
        tema: apresentacao.tema ?? '',
        apresentadorId: apresentacao.apresentadorId ?? '',
        apoioId: apresentacao.apoioId ?? '',
      });
    } else {
      this.aplicarSugestao(this.sugestao());
    }
    this.sugerirAoEditar();

    try {
      const [sistemas, pessoas] = await Promise.all([this.api.listarSistemas(), this.api.listarPessoas()]);
      this.sistemas.set([...sistemas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      this.pessoas.set(pessoas);
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  /** Depois de "salvar e adicionar outra": mantém dia, bloco e apresentador e começa onde a anterior terminou. */
  prepararProxima(salva: Apresentacao) {
    this.form.reset();
    this.aplicarSugestao({
      data: chaveDia(salva.data),
      tema: salva.tema,
      inicio: salva.fim,
      apresentadorId: salva.apresentadorId,
    });
    document.getElementById('ap-sistema')?.focus();
  }

  protected invalido(campo: keyof typeof this.form.controls) {
    const controle = this.form.controls[campo];
    return controle.touched && controle.invalid;
  }

  protected enviar(continuar: boolean) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    this.salvar.emit({
      continuar,
      dados: {
        sistemaId: valor.sistemaId,
        complemento: valor.complemento.trim() || null,
        tema: valor.tema.trim() || null,
        data: valor.data,
        inicio: valor.inicio,
        fim: valor.fim,
        apresentadorId: valor.apresentadorId,
        apoioId: valor.apoioId || null,
      },
    });
  }

  private aplicarSugestao(sugestao: SugestaoApresentacao | null) {
    if (!sugestao) return;
    this.form.patchValue({
      data: sugestao.data ?? '',
      tema: sugestao.tema ?? '',
      inicio: sugestao.inicio ?? '',
      fim: sugestao.inicio ? somarMinutos(sugestao.inicio, 60) : '',
      apresentadorId: sugestao.apresentadorId ?? '',
    });
  }

  /** Preenchimentos automáticos: fim = início + 1h e bloco temático já usado no dia escolhido. */
  private sugerirAoEditar() {
    const { inicio, fim, data, tema } = this.form.controls;
    inicio.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      if (valor && (!fim.value || minutos(fim.value) <= minutos(valor))) fim.setValue(somarMinutos(valor, 60));
    });
    data.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      if (!valor || tema.value.trim()) return;
      const doDia = this.existentes().find((a) => chaveDia(a.data) === valor && a.tema?.trim());
      if (doDia?.tema) tema.setValue(doDia.tema);
    });
  }
}
