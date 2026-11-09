import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { garantirSistema } from '../../lib/consultas.js';
import { origemDa, publicar } from '../../lib/eventos.js';
import { prisma } from '../../lib/prisma.js';
import { parametroSistemaId, parametroId } from '../../lib/validacao.js';

const corpoCategoria = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da etapa').max(200),
});

const corpoOrdem = z.object({
  ids: z.array(z.uuid()).min(1).max(1_000),
});

/** Categorias representam as etapas/processos da apresentação do edital. */
export async function categoriasRoutes(app: FastifyInstance) {
  app.post('/sistemas/:sistemaId/categorias', async (request, reply) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);
    const { nome } = corpoCategoria.parse(request.body);
    await garantirSistema(sistemaId);

    const { _max } = await prisma.categoria.aggregate({ where: { sistemaId }, _max: { ordem: true } });
    const categoria = await prisma.categoria.create({
      data: { sistemaId, nome, ordem: (_max.ordem ?? -1) + 1 },
    });

    publicar(sistemaId, { tipo: 'categorias.alteradas', origem: origemDa(request) });
    return reply.status(201).send(categoria);
  });

  app.patch('/categorias/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const { nome } = corpoCategoria.parse(request.body);
    const categoria = await prisma.categoria.update({ where: { id }, data: { nome } });
    publicar(categoria.sistemaId, { tipo: 'categorias.alteradas', origem: origemDa(request) });
    return categoria;
  });

  /** Os itens da etapa removida ficam "sem etapa" (onDelete: SetNull). */
  app.delete('/categorias/:id', async (request, reply) => {
    const { id } = parametroId.parse(request.params);
    const categoria = await prisma.categoria.delete({ where: { id } });
    publicar(categoria.sistemaId, { tipo: 'categorias.alteradas', origem: origemDa(request) });
    return reply.status(204).send();
  });

  app.put('/sistemas/:sistemaId/categorias/ordem', async (request) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);
    const { ids } = corpoOrdem.parse(request.body);

    await prisma.$transaction(
      ids.map((id, ordem) => prisma.categoria.updateMany({ where: { id, sistemaId }, data: { ordem } })),
    );

    publicar(sistemaId, { tipo: 'categorias.alteradas', origem: origemDa(request) });
    return prisma.categoria.findMany({ where: { sistemaId }, orderBy: { ordem: 'asc' } });
  });
}
