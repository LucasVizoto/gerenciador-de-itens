import type { Prisma } from '../../generated/prisma/client.js';
import { garantirSistema } from '../../lib/consultas.js';
import { prisma } from '../../lib/prisma.js';
import { normalizar, type AvisoCsv, type LeituraCsv } from './csv.js';
import { parearItens } from './pareamento.js';

export interface ResultadoImportacao {
  arquivo: string;
  linhasLidas: number;
  criados: number;
  atualizados: number;
  categoriasCriadas: string[];
  colunas: LeituraCsv['colunas'];
  /** Cabeçalhos descartados de propósito (ex.: "Área", "Sistema", "Status (DEV)"). */
  colunasIgnoradas: string[];
  /** Linhas de título/subtítulo descartadas. */
  titulosIgnorados: number;
  avisos: AvisoCsv[];
}

const LIMITE_AVISOS = 100;

/**
 * Itens com a mesma numeração de um item já existente são atualizados (permite exportar,
 * ajustar no Excel e reimportar); obrigatórios têm numeração própria e os demais tipos
 * compartilham uma só (ver `chaveItem`). Os demais são criados no fim da etapa, na ordem da planilha.
 * Status e observação vazios na planilha não sobrescrevem o que já foi avaliado.
 */
export async function importarItens(
  sistemaId: string,
  arquivo: string,
  leitura: LeituraCsv,
): Promise<ResultadoImportacao> {
  await garantirSistema(sistemaId);

  return prisma.$transaction(
    async (tx) => {
      const categorias = await tx.categoria.findMany({ where: { sistemaId } });
      const categoriaPorNome = new Map(categorias.map((c) => [normalizar(c.nome), c.id]));
      let proximaOrdemCategoria = Math.max(-1, ...categorias.map((c) => c.ordem)) + 1;
      const categoriasCriadas: string[] = [];

      const resolverCategoria = async (nome: string | null): Promise<string | undefined> => {
        if (!nome) return undefined;
        const chave = normalizar(nome);
        const existente = categoriaPorNome.get(chave);
        if (existente) return existente;
        const criada = await tx.categoria.create({
          data: { sistemaId, nome, ordem: proximaOrdemCategoria++ },
        });
        categoriaPorNome.set(chave, criada.id);
        categoriasCriadas.push(nome);
        return criada.id;
      };

      const existentes = await tx.item.findMany({
        where: { sistemaId },
        select: { id: true, tipo: true, numero: true, categoriaId: true, ordem: true },
        orderBy: [{ criadoEm: 'asc' }, { id: 'asc' }],
      });
      const itemPorId = new Map(existentes.map((i) => [i.id, i]));
      const pareamento = parearItens(
        existentes,
        leitura.linhas.map((l) => ({ linha: l.linha, numero: l.numero, tipo: l.tipo ?? 'ESSENCIAL' })),
      );

      const proximaOrdem = new Map<string, number>();
      for (const item of existentes) {
        const chave = item.categoriaId ?? '';
        proximaOrdem.set(chave, Math.max(proximaOrdem.get(chave) ?? 0, item.ordem + 1));
      }
      const reservarOrdem = (categoriaId: string | null) => {
        const chave = categoriaId ?? '';
        const ordem = proximaOrdem.get(chave) ?? 0;
        proximaOrdem.set(chave, ordem + 1);
        return ordem;
      };

      const novos: Prisma.ItemCreateManyInput[] = [];
      let atualizados = 0;

      for (const [indice, linha] of leitura.linhas.entries()) {
        const tipo = linha.tipo ?? 'ESSENCIAL';
        const categoriaId = await resolverCategoria(linha.categoria);
        const alvo = pareamento.alvos[indice];
        const existente = alvo ? itemPorId.get(alvo) : undefined;

        if (existente) {
          const mudouCategoria = categoriaId !== undefined && categoriaId !== existente.categoriaId;
          await tx.item.update({
            where: { id: existente.id },
            data: {
              descricao: linha.descricao,
              tipo,
              ...(mudouCategoria && { categoriaId, ordem: reservarOrdem(categoriaId) }),
              ...(linha.status && { status: linha.status }),
              ...(linha.observacao && { observacao: linha.observacao }),
            },
          });
          atualizados++;
          continue;
        }

        novos.push({
          sistemaId,
          categoriaId: categoriaId ?? null,
          numero: linha.numero,
          descricao: linha.descricao,
          tipo,
          status: linha.status ?? 'PENDENTE',
          observacao: linha.observacao,
          ordem: reservarOrdem(categoriaId ?? null),
        });
      }

      if (novos.length) await tx.item.createMany({ data: novos });
      const avisos = [...leitura.avisos, ...pareamento.avisos].sort((a, b) => a.linha - b.linha);

      return {
        arquivo,
        linhasLidas: leitura.linhas.length,
        criados: novos.length,
        atualizados,
        categoriasCriadas,
        colunas: leitura.colunas,
        colunasIgnoradas: leitura.colunasIgnoradas,
        titulosIgnorados: leitura.titulosIgnorados,
        avisos: avisos.slice(0, LIMITE_AVISOS),
      };
    },
    { timeout: 60_000 },
  );
}
