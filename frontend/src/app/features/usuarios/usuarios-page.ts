import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { faUserGear, faUsers } from '@fortawesome/free-solid-svg-icons';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { Usuario } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { Modal } from '../../shared/modal';
import { TituloPagina } from '../../shared/titulo-pagina';

type CampoChave = 'ativo' | 'administrador';

/** Sem caracteres ambíguos (0/O, 1/l/I) para a senha provisória ser fácil de ditar. */
const ALFABETO_SENHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

function gerarSenhaProvisoria(tamanho = 10): string {
  const sorteio = crypto.getRandomValues(new Uint32Array(tamanho));
  return Array.from(sorteio, (n) => ALFABETO_SENHA[n % ALFABETO_SENHA.length]).join('');
}

const formatoCadastro = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Gestão de usuários (somente administradores): ativar, promover, redefinir senha e excluir. */
@Component({
  selector: 'app-usuarios-page',
  imports: [NgTemplateOutlet, Icone, Modal, TituloPagina],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-line bg-linear-to-br from-brand-800 via-brand-900 to-brand-950">
      <div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <app-titulo-pagina
          sobrelinha="Administração"
          [iconeSobrelinha]="icones.administracao"
          [icone]="icones.usuarios"
          >Usuários</app-titulo-pagina
        >
        <p class="mt-2 max-w-2xl leading-relaxed text-brand-200/90">
          Novos cadastros chegam <strong class="font-semibold text-white">inativos</strong> e só
          conseguem entrar depois que um administrador liga a chave Ativo. Usuários inativos não
          acessam o sistema.
        </p>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      @if (carregando()) {
        <div class="card h-64 animate-pulse bg-surface-2"></div>
      } @else {
        <div class="card overflow-hidden">
          <div
            class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3.5 sm:px-5"
          >
            <h2 class="flex items-center gap-2 text-sm font-semibold">
              <app-icone nome="usuarios" /> {{ usuarios().length }} usuário(s)
            </h2>
            <span class="text-xs text-muted">
              @if (usuarios().length - ativos(); as pendentes) {
                <span class="font-semibold text-amber-700 dark:text-amber-300"
                  >{{ pendentes }} aguardando liberação</span
                >
                ·
              }
              {{ ativos() }} ativo(s) · {{ administradores() }} administrador(es)
            </span>
          </div>

          <!-- Celular: um card por usuário, com as chaves e ações à vista -->
          <ul class="divide-y divide-line md:hidden">
            @for (usuario of usuarios(); track usuario.id) {
              @let proprio = usuario.id === auth.usuario()?.id;
              <li class="px-4 py-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium break-words text-ink">{{ usuario.nomeCompleto }}</p>
                    <p class="mt-0.5 text-sm break-all text-ink-soft">{{ usuario.email }}</p>
                    <p class="mt-0.5 text-xs text-muted">
                      Cadastro em {{ formatarCadastro(usuario.criadoEm) }}
                    </p>
                  </div>
                  <div class="-mt-1 -mr-1 flex shrink-0 items-center">
                    <ng-container
                      *ngTemplateOutlet="tplAcoes; context: { $implicit: usuario, proprio }"
                    />
                  </div>
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5 empty:hidden [&>span]:ml-0!">
                  <ng-container
                    *ngTemplateOutlet="tplSelos; context: { $implicit: usuario, proprio }"
                  />
                </div>
                <div class="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  @for (campo of campos; track campo) {
                    <span class="flex items-center gap-2.5">
                      <ng-container
                        *ngTemplateOutlet="
                          tplChave;
                          context: { $implicit: usuario, campo, proprio }
                        "
                      />
                      <span class="text-ink-soft">{{
                        campo === 'ativo' ? 'Ativo' : 'Administrador'
                      }}</span>
                    </span>
                  }
                </div>
              </li>
            }
          </ul>

          <div class="hidden overflow-x-auto md:block">
            <table class="w-full text-left text-sm">
              <thead
                class="bg-surface-2 text-xs tracking-wide text-muted uppercase dark:bg-surface-2/60"
              >
                <tr>
                  <th class="px-5 py-2.5 font-semibold">Nome</th>
                  <th class="px-5 py-2.5 font-semibold">E-mail</th>
                  <th class="px-5 py-2.5 font-semibold">Cadastro</th>
                  <th class="px-5 py-2.5 text-center font-semibold">Ativo</th>
                  <th class="px-5 py-2.5 text-center font-semibold">Administrador</th>
                  <th class="px-5 py-2.5"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                @for (usuario of usuarios(); track usuario.id) {
                  @let proprio = usuario.id === auth.usuario()?.id;
                  <tr class="transition-colors hover:bg-surface-2/60">
                    <td class="px-5 py-3 font-medium text-ink">
                      {{ usuario.nomeCompleto }}
                      <ng-container
                        *ngTemplateOutlet="tplSelos; context: { $implicit: usuario, proprio }"
                      />
                    </td>
                    <td class="px-5 py-3 text-ink-soft">{{ usuario.email }}</td>
                    <td class="px-5 py-3 whitespace-nowrap text-muted">
                      {{ formatarCadastro(usuario.criadoEm) }}
                    </td>
                    @for (campo of campos; track campo) {
                      <td class="px-5 py-3 text-center">
                        <ng-container
                          *ngTemplateOutlet="
                            tplChave;
                            context: { $implicit: usuario, campo, proprio }
                          "
                        />
                      </td>
                    }
                    <td class="px-5 py-3 text-right whitespace-nowrap">
                      <ng-container
                        *ngTemplateOutlet="tplAcoes; context: { $implicit: usuario, proprio }"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </main>

    <ng-template #tplSelos let-usuario let-proprio="proprio">
      @if (!usuario.ativo) {
        <span
          class="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
          >Aguardando liberação</span
        >
      }
      @if (usuario.trocarSenha) {
        <span
          class="ml-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
          title="Senha redefinida: o usuário vai criar uma nova no próximo acesso"
          >Senha provisória</span
        >
      }
      @if (proprio) {
        <span
          class="ml-1.5 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-200"
          >Você</span
        >
      }
    </ng-template>

    <ng-template #tplChave let-usuario let-campo="campo" let-proprio="proprio">
      <button
        type="button"
        role="switch"
        class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        [class]="
          usuario[campo]
            ? 'border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500'
            : 'border-line-strong bg-surface-3'
        "
        [attr.aria-checked]="usuario[campo]"
        [attr.aria-label]="
          (campo === 'ativo' ? 'Ativo: ' : 'Administrador: ') + usuario.nomeCompleto
        "
        [disabled]="proprio || salvando() === usuario.id"
        [title]="proprio ? 'Você não pode alterar o seu próprio acesso' : ''"
        (click)="alternar(usuario, campo)"
      >
        <span
          class="inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform"
          [class]="usuario[campo] ? 'translate-x-4.5' : 'translate-x-0.5'"
        ></span>
      </button>
    </ng-template>

    <ng-template #tplAcoes let-usuario let-proprio="proprio">
      @if (!proprio) {
        <button
          type="button"
          class="rounded-md p-1.5 text-faint transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
          [attr.aria-label]="'Redefinir senha de ' + usuario.nomeCompleto"
          title="Redefinir senha"
          (click)="abrirRedefinicao(usuario)"
        >
          <app-icone nome="cadeado" [tamanho]="14" />
        </button>
        <button
          type="button"
          class="rounded-md p-1.5 text-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
          [attr.aria-label]="'Excluir usuário ' + usuario.nomeCompleto"
          title="Excluir usuário"
          (click)="remover(usuario)"
        >
          <app-icone nome="lixeira" [tamanho]="14" />
        </button>
      }
    </ng-template>

    <app-modal
      titulo="Redefinir senha"
      [aberto]="redefinindo() !== null"
      (fechado)="redefinindo.set(null)"
    >
      @if (redefinindo(); as usuario) {
        <form
          class="grid gap-4"
          (submit)="$event.preventDefault(); redefinirSenha(usuario)"
          novalidate
        >
          <p class="text-sm leading-relaxed text-ink-soft">
            Defina uma senha provisória para
            <strong class="text-ink">{{ usuario.nomeCompleto }}</strong>
            <span class="text-muted"> ({{ usuario.email }})</span>. No próximo acesso, ao entrar com
            ela, o usuário será obrigado a criar uma nova senha. As sessões abertas dele serão
            encerradas.
          </p>
          <div>
            <label class="label" for="senha-provisoria">Senha provisória</label>
            <div class="flex flex-wrap gap-2">
              <input
                id="senha-provisoria"
                class="input min-w-48 flex-1 font-mono tracking-wide"
                autocomplete="off"
                spellcheck="false"
                maxlength="200"
                [value]="senhaProvisoria()"
                (input)="senhaProvisoria.set($any($event.target).value)"
              />
              <button type="button" class="btn" (click)="senhaProvisoria.set(gerarSenha())">
                <app-icone nome="reiniciar" [tamanho]="14" /> Gerar outra
              </button>
              <button type="button" class="btn" (click)="copiarSenha()">Copiar</button>
            </div>
            @if (senhaProvisoria().length < 6) {
              <p class="mt-1 text-xs text-rose-600 dark:text-rose-300">
                Use pelo menos 6 caracteres.
              </p>
            } @else {
              <p class="mt-1 text-xs text-muted">
                Repasse esta senha ao usuário por um canal seguro.
              </p>
            }
          </div>
          <div class="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" class="btn btn-ghost" (click)="redefinindo.set(null)">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="salvando() === usuario.id || senhaProvisoria().length < 6"
            >
              @if (salvando() === usuario.id) {
                <span class="spinner"></span>
              }
              Redefinir senha
            </button>
          </div>
        </form>
      }
    </app-modal>
  `,
})
export class UsuariosPage implements OnInit {
  protected readonly icones = { administracao: faUserGear, usuarios: faUsers };
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly campos: CampoChave[] = ['ativo', 'administrador'];
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly carregando = signal(true);
  /** Id do usuário com alteração em andamento. */
  protected readonly salvando = signal<string | null>(null);
  protected readonly ativos = computed(() => this.usuarios().filter((u) => u.ativo).length);
  /** Usuário com o modal de redefinição de senha aberto. */
  protected readonly redefinindo = signal<Usuario | null>(null);
  protected readonly senhaProvisoria = signal('');
  protected readonly gerarSenha = gerarSenhaProvisoria;
  protected readonly administradores = computed(
    () => this.usuarios().filter((u) => u.administrador).length,
  );

  /** Data e hora do cadastro, no fuso de quem está vendo. */
  protected formatarCadastro(iso: string) {
    return formatoCadastro.format(new Date(iso));
  }

  async ngOnInit() {
    try {
      this.usuarios.set(await this.api.listarUsuarios());
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async alternar(usuario: Usuario, campo: CampoChave) {
    this.salvando.set(usuario.id);
    try {
      const atualizado = await this.api.atualizarUsuario(usuario.id, { [campo]: !usuario[campo] });
      this.usuarios.update((lista) => lista.map((u) => (u.id === atualizado.id ? atualizado : u)));
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.salvando.set(null);
    }
  }

  protected abrirRedefinicao(usuario: Usuario) {
    this.senhaProvisoria.set(gerarSenhaProvisoria());
    this.redefinindo.set(usuario);
  }

  protected async copiarSenha() {
    try {
      await navigator.clipboard.writeText(this.senhaProvisoria());
      this.toast.info('Senha provisória copiada.');
    } catch {
      this.toast.erro('Não foi possível copiar. Selecione e copie a senha manualmente.');
    }
  }

  protected async redefinirSenha(usuario: Usuario) {
    const senha = this.senhaProvisoria();
    if (senha.length < 6 || this.salvando()) return;
    this.salvando.set(usuario.id);
    try {
      const atualizado = await this.api.redefinirSenha(usuario.id, senha);
      this.usuarios.update((lista) => lista.map((u) => (u.id === atualizado.id ? atualizado : u)));
      this.redefinindo.set(null);
      this.toast.sucesso(
        `Senha de ${usuario.nomeCompleto} redefinida. No próximo acesso será pedida uma nova senha.`,
      );
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.salvando.set(null);
    }
  }

  protected async remover(usuario: Usuario) {
    if (!confirm(`Excluir o usuário "${usuario.nomeCompleto}" (${usuario.email})? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await this.api.removerUsuario(usuario.id);
      this.usuarios.update((lista) => lista.filter((u) => u.id !== usuario.id));
      this.toast.sucesso('Usuário excluído.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }
}
