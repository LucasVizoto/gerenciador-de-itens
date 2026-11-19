import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { codigoDeErro, mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Icone } from '../../shared/icone';
import { AuthMoldura } from './auth-moldura';
import { TrocaSenhaModal } from './troca-senha-modal';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthMoldura, Icone, TrocaSenhaModal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-moldura
      titulo="Bem-vindo(a)"
      subtitulo="Acompanhe a conformidade dos itens dos editais."
    >
      <form [formGroup]="form" (ngSubmit)="enviar()" class="grid gap-6" novalidate>
        <div>
          <label class="campo-auth">
            <app-icone nome="email" [tamanho]="18" />
            <span class="sr-only">E-mail</span>
            <input
              type="email"
              class="input-auth"
              formControlName="email"
              autocomplete="email"
              placeholder="E-mail"
              autofocus
            />
          </label>
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <p class="aviso-auth">
              <app-icone nome="alerta" [tamanho]="13" /> Informe um e-mail válido.
            </p>
          }
        </div>
        <div>
          <label class="campo-auth">
            <app-icone nome="cadeado" [tamanho]="18" />
            <span class="sr-only">Senha</span>
            <input
              type="password"
              class="input-auth"
              formControlName="senha"
              autocomplete="current-password"
              placeholder="Senha"
            />
          </label>
          @if (form.controls.senha.touched && form.controls.senha.invalid) {
            <p class="aviso-auth"><app-icone nome="alerta" [tamanho]="13" /> Informe a senha.</p>
          }
        </div>

        @if (erro()) {
          <p class="alerta-auth" role="alert">
            <app-icone nome="alerta" class="mt-0.5" /> {{ erro() }}
          </p>
        }

        <div class="mt-4 grid gap-3">
          <button type="submit" class="btn-pilula btn-pilula-primario" [disabled]="enviando()">
            @if (enviando()) {
              <span class="spinner"></span>
            }
            Entrar
          </button>
          <a routerLink="/cadastro" class="btn-pilula btn-pilula-secundario">Criar conta</a>
        </div>
      </form>
    </app-auth-moldura>

    @if (trocaPendente(); as troca) {
      <app-troca-senha-modal
        [email]="troca.email"
        [senhaProvisoria]="troca.senha"
        (concluido)="trocaPendente.set(null); irParaDestino()"
        (cancelado)="trocaPendente.set(null)"
      />
    }
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Página que pediu o login (query param `voltar`). */
  readonly voltar = input<string>();

  protected readonly enviando = signal(false);
  protected readonly erro = signal('');
  /** Login com senha provisória: guarda as credenciais para o modal de nova senha. */
  protected readonly trocaPendente = signal<{ email: string; senha: string } | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected async enviar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.erro.set('');
    try {
      const { email, senha } = this.form.getRawValue();
      await this.auth.entrar(email, senha);
      await this.irParaDestino();
    } catch (erro) {
      if (codigoDeErro(erro) === 'TROCAR_SENHA') {
        const { email, senha } = this.form.getRawValue();
        this.trocaPendente.set({ email: email.trim().toLowerCase(), senha });
      } else {
        this.erro.set(mensagemDeErro(erro));
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected async irParaDestino() {
    const destino = this.voltar();
    // Só caminhos internos: evita redirecionar para outro site.
    await this.router.navigateByUrl(
      destino?.startsWith('/') && !destino.startsWith('//') ? destino : '/',
    );
  }
}
