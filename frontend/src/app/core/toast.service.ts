import { Injectable, signal } from '@angular/core';

export type TipoToast = 'sucesso' | 'erro' | 'info';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private sequencia = 0;
  private readonly lista = signal<Toast[]>([]);
  readonly toasts = this.lista.asReadonly();

  sucesso(mensagem: string) {
    this.mostrar('sucesso', mensagem);
  }

  erro(mensagem: string) {
    this.mostrar('erro', mensagem, 7000);
  }

  info(mensagem: string) {
    this.mostrar('info', mensagem);
  }

  fechar(id: number) {
    this.lista.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  private mostrar(tipo: TipoToast, mensagem: string, duracaoMs = 4000) {
    const id = ++this.sequencia;
    this.lista.update((toasts) => [...toasts.slice(-3), { id, tipo, mensagem }]);
    setTimeout(() => this.fechar(id), duracaoMs);
  }
}
