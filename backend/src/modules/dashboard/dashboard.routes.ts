import type { FastifyInstance } from 'fastify';
import { usuarioDa } from '../../lib/autenticacao.js';
import { prisma } from '../../lib/prisma.js';
import { calcularResumo, type ContagemItens } from '../editais/resumo.js';

/**
 * Dados do Dashboard: todos os sistemas com as contagens de itens por tipo × status,
 * no total e por etapa. Os filtros e gráficos são calculados no front a partir daqui.
 */
export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/dashboard', async (request) => {
    const usuario = usuarioDa(request);

    const [sistemas, categorias, favoritos, contagens] = await Promise.all([
      prisma.sistema.findMany({
        select: {
          id: true,
          nome: true,
          versao: true,
          numero: true,
          orgao: true,
          dataApresentacao: true,
          metaPercentual: true,
          criadoEm: true,
          atualizadoEm: true,
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.categoria.findMany({
        select: { id: true, sistemaId: true, nome: true },
        orderBy: { ordem: 'asc' },
      }),
      prisma.usuarioFavorito.findMany({ where: { usuarioId: usuario.id }, select: { sistemaId: true } }),
      prisma.item.groupBy({ by: ['sistemaId', 'categoriaId', 'tipo', 'status'], _count: { _all: true } }),
    ]);
    const idsFavoritos = new Set(favoritos.map((f) => f.sistemaId));

    /** Junta as linhas do groupBy (que separam por etapa) em contagens por tipo × status. */
    const agrupar = (linhas: typeof contagens): ContagemItens[] => {
      const mapa = new Map<string, ContagemItens>();
      for (const { tipo, status, _count } of linhas) {
        const chave = `${tipo}|${status}`;
        const atual = mapa.get(chave);
        if (atual) atual.quantidade += _count._all;
        else mapa.set(chave, { tipo, status, quantidade: _count._all });
      }
      return [...mapa.values()];
    };

    return sistemas.map((sistema) => {
      const doSistema = contagens.filter((c) => c.sistemaId === sistema.id);
      const totais = agrupar(doSistema);
      const etapas: Array<{ id: string | null; nome: string; contagens: ContagemItens[] }> = categorias
        .filter((c) => c.sistemaId === sistema.id)
        .map(({ id, nome }) => ({ id, nome, contagens: agrupar(doSistema.filter((c) => c.categoriaId === id)) }));
      const semEtapa = agrupar(doSistema.filter((c) => c.categoriaId === null));
      if (semEtapa.length) etapas.push({ id: null, nome: 'Sem etapa', contagens: semEtapa });

      return {
        ...sistema,
        favorito: idsFavoritos.has(sistema.id),
        resumo: calcularResumo(totais, sistema.metaPercentual),
        contagens: totais,
        etapas,
      };
    });
  });
}
