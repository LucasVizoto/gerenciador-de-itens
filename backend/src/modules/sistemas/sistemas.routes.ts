import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { usuarioDa } from '../../lib/autenticacao.js';
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
  cidade: textoOpcional(120),
  objeto: textoOpcional(5_000),
  dataApresentacao: z.iso
    .date('Data inválida (use AAAA-MM-DD)')
    .transform((data) => new Date(`${data}T00:00:00Z`))
    .nullable()
    .optional(),
  metaPercentual: z.number().int().min(1).max(100).default(85),
  /**
   * Lista completa de responsáveis, na ordem de exibição. Itens com `id` são mantidos (e renomeados),
   * os sem `id` são criados e os que não vierem são removidos. Ausente = não altera.
   */
  responsaveis: z
    .array(
      z.object({
        id: z.uuid('Identificador de responsável inválido').optional(),
        nome: z.string().trim().min(1, 'Informe o nome do responsável').max(200),
      }),
    )
    .max(50, 'Cadastre no máximo 50 responsáveis')
    .optional(),
});

type DadosResponsavel = { id?: string; nome: string };

const responsaveisOrdenados = {
  responsaveis: { orderBy: [{ ordem: 'asc' as const }, { criadoEm: 'asc' as const }] },
};

/** Substitui os responsáveis do sistema pela lista recebida (mesma transação da gravação do sistema). */
async function sincronizarResponsaveis(tx: Prisma.TransactionClient, sistemaId: string, lista: DadosResponsavel[]) {
  const manter = lista.flatMap((r) => (r.id ? [r.id] : []));
  await tx.responsavel.deleteMany({ where: { sistemaId, id: { notIn: manter } } });
  for (const [ordem, { id, nome }] of lista.entries()) {
    if (id) {
      const { count } = await tx.responsavel.updateMany({ where: { id, sistemaId }, data: { nome, ordem } });
      if (!count) throw new HttpError(400, `Responsável "${nome}" não pertence a este sistema`);
    } else {
      await tx.responsavel.create({ data: { sistemaId, nome, ordem } });
    }
  }
}

const filtroLista = z.object({
  favoritos: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

export async function sistemasRoutes(app: FastifyInstance) {
  /** Lista os sistemas com os favoritos do usuário primeiro; `?favoritos=true` traz só os favoritos. */
  app.get('/sistemas', async (request) => {
    const usuario = usuarioDa(request);
    const { favoritos: somenteFavoritos } = filtroLista.parse(request.query);
    const favoritoDoUsuario = { favoritos: { some: { usuarioId: usuario.id } } };

    const [sistemas, favoritos, contagens] = await Promise.all([
      prisma.sistema.findMany({
        where: somenteFavoritos ? favoritoDoUsuario : undefined,
        orderBy: { criadoEm: 'desc' },
      }),
      prisma.usuarioFavorito.findMany({ where: { usuarioId: usuario.id }, select: { sistemaId: true } }),
      prisma.item.groupBy({ by: ['sistemaId', 'tipo', 'status'], _count: { _all: true } }),
    ]);
    const idsFavoritos = new Set(favoritos.map((f) => f.sistemaId));

    return sistemas
      .map((sistema) => ({
        ...sistema,
        favorito: idsFavoritos.has(sistema.id),
        resumo: calcularResumo(
          contagens
            .filter((c) => c.sistemaId === sistema.id)
            .map((c) => ({ tipo: c.tipo, status: c.status, quantidade: c._count._all })),
          sistema.metaPercentual,
        ),
      }))
      .sort((a, b) => Number(b.favorito) - Number(a.favorito));
  });

  app.put('/sistemas/:id/favorito', async (request, reply) => {
    const usuario = usuarioDa(request);
    const { id } = parametroId.parse(request.params);
    await prisma.usuarioFavorito.upsert({
      where: { usuarioId_sistemaId: { usuarioId: usuario.id, sistemaId: id } },
      create: { usuarioId: usuario.id, sistemaId: id },
      update: {},
    });
    return reply.status(204).send();
  });

  app.delete('/sistemas/:id/favorito', async (request, reply) => {
    const usuario = usuarioDa(request);
    const { id } = parametroId.parse(request.params);
    await prisma.usuarioFavorito.deleteMany({ where: { usuarioId: usuario.id, sistemaId: id } });
    return reply.status(204).send();
  });

  app.post('/sistemas', async (request, reply) => {
    const { responsaveis, ...dados } = corpoSistema.parse(request.body);
    const sistema = await prisma.sistema.create({
      data: { ...dados, responsaveis: { create: (responsaveis ?? []).map(({ nome }, ordem) => ({ nome, ordem })) } },
      include: responsaveisOrdenados,
    });
    return reply.status(201).send(sistema);
  });

  /** Tela do sistema: dados, etapas e itens do edital, já ordenados. */
  app.get('/sistemas/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const sistema = await prisma.sistema.findUnique({
      where: { id },
      include: {
        ...responsaveisOrdenados,
        categorias: { orderBy: { ordem: 'asc' } },
        itens: { orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }] },
      },
    });
    if (!sistema) throw new HttpError(404, 'Sistema não encontrado');
    return sistema;
  });

  app.put('/sistemas/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const { responsaveis, ...dados } = corpoSistema.parse(request.body);
    const sistema = await prisma.$transaction(async (tx) => {
      await tx.sistema.update({ where: { id }, data: dados });
      if (responsaveis) await sincronizarResponsaveis(tx, id, responsaveis);
      return tx.sistema.findUniqueOrThrow({ where: { id }, include: responsaveisOrdenados });
    });
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
