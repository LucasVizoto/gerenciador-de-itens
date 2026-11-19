import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { Usuario } from '../../core/models';
import { Icone } from '../../shared/icone';

const senhasIguais: ValidatorFn = (grupo) =>
  grupo.get('novaSenha')?.value === grupo.get('confirmacao')?.value
    ? null
    : { senhasDiferentes: true };

/**
 * Pedido de nova senha depois de entrar com uma senha provisória (redefinida por um administrador).
 * Mesmo visual da tela de login: gradiente azul, campos sublinhados e botões em pílula.
 * Só existe enquanto aberto (o pai o cria com @if), então abre o <dialog> ao nascer.
 */
@Component({
  selector: 'app-troca-senha-modal',
  imports: [ReactiveFormsModule, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialogo
      aria-labelledby="titulo-troca-senha"
      class="m-auto w-[min(420px,calc(100vw-2rem))] max-w-none overflow-hidden rounded-3xl border-0 bg-transparent p-0 text-white shadow-2xl shadow-brand-950/40 backdrop:bg-brand-950/45 backdrop:backdrop-blur-md"
      (cancel)="$event.preventDefault(); cancelar()"
    >
      <div
        class="relative isolate bg-linear-to-br from-sky-400 via-blue-500 to-brand-500 px-7 pt-9 pb-8 dark:from-brand-700 dark:via-brand-800 dark:to-brand-900"
      >
        <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div
            class="absolute -top-24 -left-20 size-64 rounded-full bg-white/30 blur-3xl dark:bg-sky-400/15"
          ></div>
          <div
            class="absolute -right-24 -bottom-28 size-72 rounded-full bg-indigo-400/30 blur-3xl dark:bg-indigo-500/20"
          ></div>
        </div>

        <div class="flex flex-col items-center text-center">
          <span
            class="grid size-14 place-items-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-sm"
          >
            <app-icone nome="cadeado" [tamanho]="24" />
          </span>
          <p class="mt-5 text-[11px] font-semibold tracking-[0.25em] text-white/80 uppercase">
            Senha redefinida
          </p>
          <h2 id="titulo-troca-senha" class="mt-2 text-2xl font-semibold tracking-tight">
            Crie uma nova senha
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-white/80">
            Um administrador redefiniu a senha de
            <strong class="font-semibold text-white">{{ email() }}</strong
            >. Defina a senha que você vai usar a partir de agora.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-8 grid gap-6" novalidate>
          <div>
            <label class="campo-auth">
              <app-icone nome="cadeado" [tamanho]="18" />
              <span class="sr-only">Nova senha</span>
              <input
                #campoNovaSenha
                type="password"
                class="input-auth"
                formControlName="novaSenha"
                autocomplete="new-password"
                placeholder="Nova senha"
              />
            </label>
            @if (form.controls.novaSenha.touched && form.controls.novaSenha.invalid) {
              <p class="aviso-auth">
                <app-icone nome="alerta" [tamanho]="13" /> Use pelo menos 6 caracteres.
              </p>
            }
          </div>
          <div>
            <label class="campo-auth">
              <app-icone nome="cadeado" [tamanho]="18" />
              <span class="sr-only">Confirme a nova senha</span>
              <input
                type="password"
                class="input-auth"
                formControlName="confirmacao"
                autocomplete="new-password"
                placeholder="Confirme a nova senha"
              />
            </label>
            @if (form.controls.confirmacao.touched && form.hasError('senhasDiferentes')) {
              <p class="aviso-auth">
                <app-icone nome="alerta" [tamanho]="13" /> As senhas não conferem.
              </p>
            }
          </div>

          @if (erro()) {
            <p class="alerta-auth" role="alert">
              <app-icone nome="alerta" class="mt-0.5" /> {{ erro() }}
            </p>
          }

          <div class="mt-2 grid gap-3">
            <button type="submit" class="btn-pilula btn-pilula-primario" [disabled]="enviando()">
              @if (enviando()) {
                <span class="spinner"></span>
              }
              Salvar e entrar
            </button>
            <button
              type="button"
              class="btn-pilula btn-pilula-secundario"
              [disabled]="enviando()"
              (click)="cancelar()"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </dialog>
  `,
})
export class TrocaSenhaModal {
  private readonly auth = inject(AuthService);

  /** Credenciais com que o usuário acabou de tentar entrar (a senha é a provisória). */
  readonly email = input.required<string>();
  readonly senhaProvisoria = input.required<string>();

  readonly concluido = output<Usuario>();
  readonly cancelado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly erro = signal('');

  protected readonly form = new FormGroup(
    {
      novaSenha: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6)],
      }),
      confirmacao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: senhasIguais },
  );

  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly campoNovaSenha =
    viewChild.required<ElementRef<HTMLInputElement>>('campoNovaSenha');

  constructor() {
    afterNextRender(() => {
      this.dialogo().nativeElement.showModal();
      this.campoNovaSenha().nativeElement.focus();
    });
  }

  protected async enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.erro.set('');
    try {
      const usuario = await this.auth.trocarSenha(
        this.email(),
        this.senhaProvisoria(),
        this.form.getRawValue().novaSenha,
      );
      this.dialogo().nativeElement.close();
      this.concluido.emit(usuario);
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
    } finally {
      this.enviando.set(false);
    }
  }

  protected cancelar() {
    if (this.enviando()) return;
    this.dialogo().nativeElement.close();
    this.cancelado.emit();
  }
}
