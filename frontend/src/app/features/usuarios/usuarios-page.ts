import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import type { Usuario } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';

type CampoChave = 'ativo' | 'administrador';

const formatoCadastro = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

/** Gestão de usuários (somente administradores): ativar, promover e excluir. */
@Component({
  selector: 'app-usuarios-page',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="border-b border-line bg-linear-to-br from-brand-800 via-brand-900 to-brand-950">
      <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p class="eyebrow">Administração</p>
        <h1 class="mt-3 text-3xl font-bold tracking-tight text-white">Usuários</h1>
        <p class="mt-2 max-w-2xl leading-relaxed text-brand-200/90">
          Novos cadastros chegam <strong class="font-semibold text-white">inativos</strong> e só conseguem entrar depois que um
          administrador liga a chave Ativo. Usuários inativos não acessam o sistema.
        </p>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      @if (carregando()) {
        <div class="card h-64 animate-pulse bg-surface-2"></div>
      } @else {
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 class="flex items-center gap-2 text-sm font-semibold"><app-icone nome="usuarios" /> {{ usuarios().length }} usuário(s)</h2>
            <span class="text-xs text-muted">
              @if (usuarios().length - ativos(); as pendentes) {
                <span class="font-semibold text-amber-700 dark:text-amber-300">{{ pendentes }} aguardando liberação</span> ·
              }
              {{ ativos() }} ativo(s) · {{ administradores() }} administrador(es)
            </span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-surface-2 text-xs tracking-wide text-muted uppercase dark:bg-surface-2/60">
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
                      @if (!usuario.ativo) {
                        <span class="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">Aguardando liberação</span>
                      }
                      @if (proprio) {
                        <span class="ml-1.5 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-200">Você</span>
                      }
                    </td>
                    <td class="px-5 py-3 text-ink-soft">{{ usuario.email }}</td>
                    <td class="px-5 py-3 whitespace-nowrap text-muted">{{ formatarCadastro(usuario.criadoEm) }}</td>
                    @for (campo of campos; track campo) {
                      <td class="px-5 py-3 text-center">
                        <button
                          type="button"
                          role="switch"
                          class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                          [class]="usuario[campo] ? 'border-brand-600 bg-brand-600 dark:border-brand-500 dark:bg-brand-500' : 'border-line-strong bg-surface-3'"
                          [attr.aria-checked]="usuario[campo]"
                          [attr.aria-label]="(campo === 'ativo' ? 'Ativo: ' : 'Administrador: ') + usuario.nomeCompleto"
                          [disabled]="proprio || salvando() === usuario.id"
                          [title]="proprio ? 'Você não pode alterar o seu próprio acesso' : ''"
                          (click)="alternar(usuario, campo)"
                        >
                          <span
                            class="inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform"
                            [class]="usuario[campo] ? 'translate-x-4.5' : 'translate-x-0.5'"
                          ></span>
                        </button>
                      </td>
                    }
                    <td class="px-5 py-3 text-right">
                      @if (!proprio) {
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
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </main>
  `,
})
export class UsuariosPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly campos: CampoChave[] = ['ativo', 'administrador'];
  protected readonly usuarios = signal<Usuario[]>([]);
  protected readonly carregando = signal(true);
  /** Id do usuário com alteração em andamento. */
  protected readonly salvando = signal<string | null>(null);
  protected readonly ativos = computed(() => this.usuarios().filter((u) => u.ativo).length);
  protected readonly administradores = computed(() => this.usuarios().filter((u) => u.administrador).length);

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
