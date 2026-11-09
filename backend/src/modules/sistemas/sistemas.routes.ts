import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { origemDa, publicar } from '../../lib/eventos.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { parametroId, textoOpcional } from '../../lib/validacao.js';
import { calcularResumo } from '../editais/resumo.js';
import { gerarCsvItens, normalizar } from '../itens/csv.js';

const corpoSistema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do sistema').max(200),
  versao: textoOpcional(50),
  descricao: textoOpcional(2000),
  numero: textoOpcional(100),
  orgao: textoOpcional(200),
  objeto: textoOpcional(5_000),
  dataApresentacao: z.iso
    .date('Data inválida (use AAAA-MM-DD)')
    .transform((data) => new Date(`${data}T00:00:00Z`))
    .nullable()
    .optional(),
  metaPercentual: z.number().int().min(1).max(100).default(85),
});

export async function sistemasRoutes(app: FastifyInstance) {
  app.get('/sistemas', async () => {
    const [sistemas, contagens] = await Promise.all([
      prisma.sistema.findMany({ orderBy: { criadoEm: 'desc' } }),
      prisma.item.groupBy({ by: ['sistemaId', 'tipo', 'status'], _count: { _all: true } }),
    ]);

    return sistemas.map((sistema) => ({
      ...sistema,
      resumo: calcularResumo(
        contagens
          .filter((c) => c.sistemaId === sistema.id)
          .map((c) => ({ tipo: c.tipo, status: c.status, quantidade: c._count._all })),
        sistema.metaPercentual,
      ),
    }));
  });

  app.post('/sistemas', async (request, reply) => {
    const dados = corpoSistema.parse(request.body);
    const sistema = await prisma.sistema.create({ data: dados });
    return reply.status(201).send(sistema);
  });

  /** Tela do sistema: dados, etapas e itens do edital, já ordenados. */
  app.get('/sistemas/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const sistema = await prisma.sistema.findUnique({
      where: { id },
      include: {
        categorias: { orderBy: { ordem: 'asc' } },
        itens: { orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }] },
      },
    });
    if (!sistema) throw new HttpError(404, 'Sistema não encontrado');
    return sistema;
  });

  app.put('/sistemas/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const dados = corpoSistema.parse(request.body);
    const sistema = await prisma.sistema.update({ where: { id }, data: dados });
    publicar(id, { tipo: 'sistema.atualizado', dados: sistema, origem: origemDa(request) });
    return sistema;
  });

  app.delete('/sistemas/:id', async (request, reply) => {
    const { id } = parametroId.parse(request.params);
    await prisma.sistema.delete({ where: { id } });
    publicar(id, { tipo: 'sistema.removido', origem: origemDa(request) });
    return reply.status(204).send();
  });

  /** Limpa todas as marcações (volta tudo para Pendente), mantendo itens e observações. */
  app.post('/sistemas/:id/reiniciar', async (request) => {
    const { id } = parametroId.parse(request.params);
    const { count } = await prisma.item.updateMany({ where: { sistemaId: id }, data: { status: 'PENDENTE' } });
    publicar(id, { tipo: 'itens.reiniciados', origem: origemDa(request) });
    return { reiniciados: count };
  });

  app.get('/sistemas/:id/exportar', async (request, reply) => {
    const { id } = parametroId.parse(request.params);
    const sistema = await prisma.sistema.findUnique({ where: { id }, select: { nome: true } });
    if (!sistema) throw new HttpError(404, 'Sistema não encontrado');

    const itens = await prisma.item.findMany({
      where: { sistemaId: id },
      include: { categoria: { select: { nome: true, ordem: true } } },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }],
    });
    const semEtapa = Number.MAX_SAFE_INTEGER;
    itens.sort((a, b) => (a.categoria?.ordem ?? semEtapa) - (b.categoria?.ordem ?? semEtapa) || a.ordem - b.ordem);

    const arquivo = `avaliacao-${normalizar(sistema.nome).replaceAll(' ', '-') || 'sistema'}.csv`;
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${arquivo}"`)
      .send(gerarCsvItens(itens));
  });
}
