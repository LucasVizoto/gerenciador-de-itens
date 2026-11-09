import type { TipoItem } from '../../generated/prisma/enums.js';
import { normalizar, type AvisoCsv } from './csv.js';

/**
 * Obrigatórios têm numeração própria (1..7); os demais tipos compartilham uma única sequência.
 * Assim, mudar um item de Essencial para Dispensado (ou Complementar) na planilha atualiza o item
 * em vez de duplicá-lo.
 */
export function chaveItem(tipo: TipoItem, numero: string): string {
  return `${tipo === 'OBRIGATORIO' ? 'OBR' : 'GERAL'}|${normalizar(numero)}`;
}

export interface ItemExistente {
  id: string;
  tipo: TipoItem;
  numero: string | null;
}

export interface LinhaPareavel {
  linha: number;
  numero: string | null;
  tipo: TipoItem;
}

export interface Pareamento {
  /** Para cada linha (mesma ordem da entrada), o item a atualizar ou null para criar um novo. */
  alvos: Array<string | null>;
  avisos: AvisoCsv[];
}

const ROTULO: Record<TipoItem, string> = {
  OBRIGATORIO: 'obrigatório',
  ESSENCIAL: 'essencial',
  COMPLEMENTAR: 'complementar',
  DISPENSADO: 'dispensado da POC',
};

/**
 * Decide qual item já cadastrado cada linha da planilha atualiza. Cada item existente é
 * atualizado no máximo uma vez: se a mesma numeração aparece de novo na planilha e não há outro
 * item livre com ela, a repetição vira um item novo (com aviso), sem sobrescrever o primeiro.
 * Quando há mais de um item cadastrado com a mesma numeração, prefere o de mesmo tipo.
 */
export function parearItens(existentes: ItemExistente[], linhas: LinhaPareavel[]): Pareamento {
  const livres = new Map<string, ItemExistente[]>();
  for (const item of existentes) {
    if (!item.numero) continue;
    const chave = chaveItem(item.tipo, item.numero);
    livres.set(chave, [...(livres.get(chave) ?? []), item]);
  }

  const vistas = new Set<string>();
  const alvos: Array<string | null> = [];
  const avisos: AvisoCsv[] = [];

  for (const linha of linhas) {
    if (!linha.numero) {
      alvos.push(null);
      continue;
    }

    const chave = chaveItem(linha.tipo, linha.numero);
    const repetida = vistas.has(chave);
    vistas.add(chave);

    const candidatos = livres.get(chave) ?? [];
    if (!candidatos.length) {
      alvos.push(null);
      if (repetida) {
        avisos.push({
          linha: linha.linha,
          mensagem: `Item ${linha.numero} aparece mais de uma vez na planilha; a repetição foi criada como um novo item.`,
        });
      }
      continue;
    }

    const mesmoTipo = candidatos.filter((c) => c.tipo === linha.tipo);
    const preferidos = mesmoTipo.length ? mesmoTipo : candidatos;
    const empatados = preferidos.length;
    const escolhido = preferidos[0]!;
    candidatos.splice(candidatos.indexOf(escolhido), 1);
    alvos.push(escolhido.id);

    if (empatados > 1) {
      avisos.push({
        linha: linha.linha,
        mensagem:
          `Há ${empatados} itens cadastrados com a numeração ${linha.numero}; ` +
          `foi atualizado o primeiro (${ROTULO[escolhido.tipo]}). Confira os demais.`,
      });
    }
  }

  return { alvos, avisos };
}
