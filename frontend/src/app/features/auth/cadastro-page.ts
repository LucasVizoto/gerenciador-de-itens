import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Icone } from '../../shared/icone';
import { AuthMoldura } from './auth-moldura';

const senhasIguais: ValidatorFn = (grupo) =>
  grupo.get('senha')?.value === grupo.get('confirmacao')?.value ? null : { senhasDiferentes: true };

@Component({
  selector: 'app-cadastro-page',
  imports: [ReactiveFormsModule, RouterLink, AuthMoldura, Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-moldura
      [titulo]="enviadoPara() ? 'Cadastro enviado' : 'Crie sua conta'"
      [subtitulo]="enviadoPara() ? '' : 'Avalie os sistemas e marque os seus favoritos.'"
    >
      @if (enviadoPara(); as nome) {
        <div class="grid gap-8 text-center">
          <div class="alerta-auth flex-col items-center gap-3 px-6 py-6" role="status">
            <span class="grid size-11 place-items-center rounded-full bg-white/20 ring-1 ring-white/40">
              <app-icone nome="relogio" [tamanho]="20" />
            </span>
            <p class="text-base font-semibold">Obrigado, {{ nome }}!</p>
            <p class="leading-relaxed text-white/90">
              Sua conta foi criada e está <strong>aguardando a aprovação</strong> de um administrador.
              Assim que o acesso for liberado, você poderá entrar com o seu e-mail e senha.
            </p>
          </div>
          <a routerLink="/login" class="btn-pilula btn-pilula-primario">Voltar para o login</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="enviar()" class="grid gap-6" novalidate>
          <div>
            <label class="campo-auth">
              <app-icone nome="usuario" [tamanho]="18" />
              <span class="sr-only">Nome completo</span>
              <input type="text" class="input-auth" formControlName="nomeCompleto" autocomplete="name" placeholder="Nome completo" autofocus />
            </label>
            @if (form.controls.nomeCompleto.touched && form.controls.nomeCompleto.invalid) {
              <p class="aviso-auth"><app-icone nome="alerta" [tamanho]="13" /> Informe o nome completo.</p>
            }
          </div>
          <div>
            <label class="campo-auth">
              <app-icone nome="email" [tamanho]="18" />
              <span class="sr-only">E-mail</span>
              <input type="email" class="input-auth" formControlName="email" autocomplete="email" placeholder="E-mail" />
            </label>
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <p class="aviso-auth"><app-icone nome="alerta" [tamanho]="13" /> Informe um e-mail válido.</p>
            }
          </div>
          <div>
            <label class="campo-auth">
              <app-icone nome="cadeado" [tamanho]="18" />
              <span class="sr-only">Senha (mínimo de 6 caracteres)</span>
              <input type="password" class="input-auth" formControlName="senha" autocomplete="new-password" placeholder="Senha (mínimo de 6 caracteres)" />
            </label>
            @if (form.controls.senha.touched && form.controls.senha.invalid) {
              <p class="aviso-auth"><app-icone nome="alerta" [tamanho]="13" /> A senha deve ter pelo menos 6 caracteres.</p>
            }
          </div>
          <div>
            <label class="campo-auth">
              <app-icone nome="cadeado" [tamanho]="18" />
              <span class="sr-only">Confirme a senha</span>
              <input type="password" class="input-auth" formControlName="confirmacao" autocomplete="new-password" placeholder="Confirme a senha" />
            </label>
            @if (form.controls.confirmacao.touched && form.hasError('senhasDiferentes')) {
              <p class="aviso-auth"><app-icone nome="alerta" [tamanho]="13" /> As senhas não conferem.</p>
            }
          </div>

          @if (erro()) {
            <p class="alerta-auth" role="alert"><app-icone nome="alerta" class="mt-0.5" /> {{ erro() }}</p>
          }

          <div class="mt-4 grid gap-3">
            <button type="submit" class="btn-pilula btn-pilula-primario" [disabled]="enviando()">
              @if (enviando()) {
                <span class="spinner"></span>
              }
              Criar conta
            </button>
            <a routerLink="/login" class="btn-pilula btn-pilula-secundario">Já tenho conta</a>
          </div>
        </form>
      }
    </app-auth-moldura>
  `,
})
export class CadastroPage {
  private readonly auth = inject(AuthService);


  protected readonly enviando = signal(false);
  protected readonly erro = signal('');
  /** Primeiro nome de quem acabou de se cadastrar; preenchido = mostra a confirmação. */
  protected readonly enviadoPara = signal<string | null>(null);

  protected readonly form = new FormGroup(
    {
      nomeCompleto: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
      }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
      senha: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
      confirmacao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    },
    { validators: senhasIguais },
  );

  protected async enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.erro.set('');
    try {
      const { nomeCompleto, email, senha } = this.form.getRawValue();
      const usuario = await this.auth.cadastrar({ nomeCompleto: nomeCompleto.trim(), email: email.trim(), senha });
      this.enviadoPara.set(usuario.nomeCompleto.split(' ')[0] ?? usuario.nomeCompleto);
      window.scrollTo({ top: 0 });
    } catch (erro) {
      this.erro.set(mensagemDeErro(erro));
    } finally {
      this.enviando.set(false);
    }
  }
}
