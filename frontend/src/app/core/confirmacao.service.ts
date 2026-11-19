import { Injectable, signal } from '@angular/core';
import type { NomeIcone } from '../shared/icone';

export type TomConfirmacao = 'perigo' | 'atencao';

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem: string;
  /** Rótulo do botão de confirmação (padrão: "Confirmar"). */
  confirmar?: string;
  /** Rótulo do botão de cancelamento (padrão: "Cancelar"). */
  cancelar?: string;
  /** perigo = ação destrutiva (botão vermelho); atencao = troca algo já feito (botão azul). */
  tom?: TomConfirmacao;
  icone?: NomeIcone;
}

interface PedidoConfirmacao extends Required<OpcoesConfirmacao> {
  resolver: (confirmado: boolean) => void;
}

/**
 * Substitui o `confirm()` do navegador por um modal no visual do sistema (ver `<app-confirmacao>` no app.html).
 * `await confirmacao.confirmar({...})` resolve `true` só se o usuário clicar no botão de confirmação;
 * ESC, clique fora ou "Cancelar" resolvem `false`.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmacaoService {
  private readonly atual = signal<PedidoConfirmacao | null>(null);
  readonly pedido = this.atual.asReadonly();

  confirmar(opcoes: OpcoesConfirmacao): Promise<boolean> {
    // Um pedido novo descarta o anterior (como se tivesse sido cancelado).
    this.atual()?.resolver(false);
    const tom = opcoes.tom ?? 'perigo';
    return new Promise((resolver) =>
      this.atual.set({
        confirmar: 'Confirmar',
        cancelar: 'Cancelar',
        icone: tom === 'perigo' ? 'lixeira' : 'alerta',
        ...opcoes,
        tom,
        resolver,
      }),
    );
  }

  responder(confirmado: boolean) {
    const pedido = this.atual();
    if (!pedido) return;
    this.atual.set(null);
    pedido.resolver(confirmado);
  }
}
