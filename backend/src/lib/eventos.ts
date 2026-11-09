import { EventEmitter } from 'node:events';
import type { FastifyRequest } from 'fastify';

export type TipoEvento =
  | 'item.criado'
  | 'item.atualizado'
  | 'item.removido'
  | 'itens.reordenados'
  | 'itens.importados'
  | 'itens.reiniciados'
  | 'categorias.alteradas'
  | 'sistema.atualizado'
  | 'sistema.removido';

export interface EventoEdital {
  tipo: TipoEvento;
  dados?: unknown;
  /** Id do cliente (aba do navegador) que originou a alteração. */
  origem?: string;
}

/**
 * Barramento em memória: suficiente para uma única instância da API.
 * Para escalar horizontalmente, troque por Postgres LISTEN/NOTIFY ou Redis Pub/Sub.
 */
const barramento = new EventEmitter();
barramento.setMaxListeners(0);

export function publicar(sistemaId: string, evento: EventoEdital): void {
  barramento.emit(sistemaId, evento);
}

export function assinar(sistemaId: string, ouvinte: (evento: EventoEdital) => void): () => void {
  barramento.on(sistemaId, ouvinte);
  return () => barramento.off(sistemaId, ouvinte);
}

export function origemDa(request: FastifyRequest): string | undefined {
  const valor = request.headers['x-client-id'];
  return typeof valor === 'string' && valor.length <= 100 ? valor : undefined;
}
