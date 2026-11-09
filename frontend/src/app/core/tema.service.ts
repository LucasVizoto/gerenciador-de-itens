import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

export type Tema = 'claro' | 'escuro';

/** Mesma chave e cores usadas pelo script inline do index.html. */
const CHAVE = 'gerenciador-tema';
const COR_BARRA: Record<Tema, string> = { claro: '#ffffff', escuro: '#0d1730' };

/** Tema claro (padrão) ou escuro: lembra a escolha do usuário e, sem escolha, segue o sistema operacional. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly midiaEscura = this.documento.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  private readonly atual = signal<Tema>(this.lerSalvo() ?? this.doSistema());
  readonly tema = this.atual.asReadonly();
  readonly escuro = computed(() => this.atual() === 'escuro');

  constructor() {
    effect(() => this.aplicar(this.atual()));

    // Enquanto o usuário não escolher, acompanha a mudança de tema do sistema.
    this.midiaEscura?.addEventListener('change', () => {
      if (!this.lerSalvo()) this.atual.set(this.doSistema());
    });
  }

  alternar() {
    const novo: Tema = this.atual() === 'escuro' ? 'claro' : 'escuro';
    this.atual.set(novo);
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // Armazenamento indisponível (modo privado, bloqueio): a escolha vale só nesta sessão.
    }
  }

  private aplicar(tema: Tema) {
    const raiz = this.documento.documentElement;
    raiz.setAttribute('data-theme', tema === 'escuro' ? 'dark' : 'light');
    this.documento.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema]);
  }

  private lerSalvo(): Tema | null {
    try {
      const valor = localStorage.getItem(CHAVE);
      return valor === 'claro' || valor === 'escuro' ? valor : null;
    } catch {
      return null;
    }
  }

  private doSistema(): Tema {
    return this.midiaEscura?.matches ? 'escuro' : 'claro';
  }
}
