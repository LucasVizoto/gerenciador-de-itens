import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { StatusItem, TipoItem } from '../../generated/prisma/enums.js';
import { garantirCategoriasDoSistema, garantirSistema, proximaOrdemItem } from '../../lib/consultas.js';
import { origemDa, publicar } from '../../lib/eventos.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { parametroSistemaId, parametroId, textoOpcional } from '../../lib/validacao.js';
import { lerCsvItens } from './csv.js';
import { importarItens } from './importacao.js';

const corpoNovoItem = z.object({
  numero: textoOpcional(50),
  descricao: z.string().trim().min(1, 'Informe o texto do requisito').max(10_000),
  tipo: z.enum(TipoItem).default('ESSENCIAL'),
  categoriaId: z.uuid('Etapa inválida').nullable().optional(),
  observacao: textoOpcional(5_000),
});

const corpoAtualizacao = z.object({
  numero: textoOpcional(50),
  descricao: z.string().trim().min(1, 'Informe o texto do requisito').max(10_000).optional(),
  tipo: z.enum(TipoItem).optional(),
  status: z.enum(StatusItem).optional(),
  categoriaId: z.uuid('Etapa inválida').nullable().optional(),
  observacao: textoOpcional(5_000),
});

const corpoOrdem = z.object({
  itens: z
    .array(
      z.object({
        id: z.uuid(),
        categoriaId: z.uuid().nullable(),
        ordem: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(5_000),
});

export async function itensRoutes(app: FastifyInstance) {
  app.post('/sistemas/:sistemaId/itens', async (request, reply) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);
    const dados = corpoNovoItem.parse(request.body);
    await garantirSistema(sistemaId);
    await garantirCategoriasDoSistema(sistemaId, [dados.categoriaId]);

    const categoriaId = dados.categoriaId ?? null;
    const item = await prisma.item.create({
      data: { ...dados, sistemaId, categoriaId, ordem: await proximaOrdemItem(sistemaId, categoriaId) },
    });

    publicar(sistemaId, { tipo: 'item.criado', dados: item, origem: origemDa(request) });
    return reply.status(201).send(item);
  });

  /** Usado para marcar Atende ou Não atende: cada clique é gravado na hora. */
  app.patch('/itens/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const dados = corpoAtualizacao.parse(request.body);

    const atual = await prisma.item.findUnique({ where: { id }, select: { sistemaId: true, categoriaId: true } });
    if (!atual) throw new HttpError(404, 'Item não encontrado');

    const data: Prisma.ItemUncheckedUpdateInput = { ...dados };
    if (dados.categoriaId !== undefined && dados.categoriaId !== atual.categoriaId) {
      await garantirCategoriasDoSistema(atual.sistemaId, [dados.categoriaId]);
      data.ordem = await proximaOrdemItem(atual.sistemaId, dados.categoriaId);
    }

    const item = await prisma.item.update({ where: { id }, data });
    publicar(item.sistemaId, { tipo: 'item.atualizado', dados: item, origem: origemDa(request) });
    return item;
  });

  app.delete('/itens/:id', async (request, reply) => {
    const { id } = parametroId.parse(request.params);
    const item = await prisma.item.delete({ where: { id } });
    publicar(item.sistemaId, { tipo: 'item.removido', dados: { id }, origem: origemDa(request) });
    return reply.status(204).send();
  });

  /** Recebe a nova posição (e etapa) dos itens afetados por um arrastar-e-soltar. */
  app.put('/sistemas/:sistemaId/itens/ordem', async (request) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);
    const { itens } = corpoOrdem.parse(request.body);
    await garantirCategoriasDoSistema(
      sistemaId,
      itens.map((i) => i.categoriaId),
    );

    const resultados = await prisma.$transaction(
      itens.map((item) =>
        prisma.item.updateMany({
          where: { id: item.id, sistemaId },
          data: { categoriaId: item.categoriaId, ordem: item.ordem },
        }),
      ),
    );

    publicar(sistemaId, { tipo: 'itens.reordenados', dados: itens, origem: origemDa(request) });
    return { atualizados: resultados.reduce((total, r) => total + r.count, 0) };
  });

  app.post('/sistemas/:sistemaId/itens/importar', async (request) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);

    const arquivo = await request.file();
    if (!arquivo) throw new HttpError(400, 'Envie a planilha no campo "arquivo".');
    if (!/\.(csv|txt)$/i.test(arquivo.filename)) {
      throw new HttpError(415, 'Formato não suportado: envie um arquivo .csv (no Excel, "Salvar como" → CSV).');
    }

    const leitura = lerCsvItens(await arquivo.toBuffer());
    const resultado = await importarItens(sistemaId, arquivo.filename, leitura);

    publicar(sistemaId, {
      tipo: 'itens.importados',
      dados: { criados: resultado.criados, atualizados: resultado.atualizados },
      origem: origemDa(request),
    });
    if (resultado.categoriasCriadas.length) {
      publicar(sistemaId, { tipo: 'categorias.alteradas', origem: origemDa(request) });
    }
    return resultado;
  });
}
