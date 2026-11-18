import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { DadosCadastro, Usuario } from './models';

/** Sessão do usuário logado. O token fica num cookie httpOnly; aqui guardamos só os dados do usuário. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly atual = signal<Usuario | null>(null);
  private carregamento: Promise<Usuario | null> | null = null;

  readonly usuario = this.atual.asReadonly();
  readonly logado = computed(() => this.atual() !== null);
  readonly administrador = computed(() => this.atual()?.administrador ?? false);

  /** Busca a sessão atual uma única vez; as chamadas seguintes reaproveitam o resultado. */
  carregar(): Promise<Usuario | null> {
    this.carregamento ??= firstValueFrom(this.http.get<Usuario>('/api/auth/me')).then(
      (usuario) => this.definir(usuario),
      (erro: unknown) => {
        if (erro instanceof HttpErrorResponse && erro.status === 401) return this.definir(null);
        // API fora do ar: não guarda o resultado, para tentar de novo na próxima navegação.
        this.atual.set(null);
        this.carregamento = null;
        return null;
      },
    );
    return this.carregamento;
  }

  async entrar(email: string, senha: string): Promise<Usuario> {
    const usuario = await firstValueFrom(this.http.post<Usuario>('/api/auth/login', { email, senha }));
    return this.definir(usuario);
  }

  /** Cria a conta. Contas novas ficam inativas até um administrador aprovar, então não há login automático. */
  async cadastrar(dados: DadosCadastro): Promise<Usuario> {
    return firstValueFrom(this.http.post<Usuario>('/api/auth/cadastro', dados));
  }

  async sair(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', {}));
    } finally {
      this.limpar();
    }
  }

  /** Chamado quando a API responde 401 (sessão expirada ou usuário desativado). */
  limpar(): void {
    this.definir(null);
  }

  private definir<T extends Usuario | null>(usuario: T): T {
    this.atual.set(usuario);
    this.carregamento = Promise.resolve(usuario);
    return usuario;
  }
}
