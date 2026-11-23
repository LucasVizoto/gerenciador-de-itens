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

const corpoOrdem = z.object({
  ids: z.array(z.uuid('Identificador de sistema inválido')).min(1).max(1000),
});

/**
 * Regra das ordens arrastáveis: as posições que os `ids` enviados já ocupavam são redistribuídas entre eles
 * na nova ordem, sem mexer nos demais (assim funciona tanto para a lista inteira quanto para parte dela).
 * Posições repetidas (ex.: criados ao mesmo tempo) viram uma sequência a partir da menor.
 */
function redistribuir(ordensAtuais: number[]): number[] {
  const posicoes = [...ordensAtuais].sort((a, b) => a - b);
  return new Set(posicoes).size === posicoes.length ? posicoes : posicoes.map((_, i) => posicoes[0]! + i);
}

function semRepetidos(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'A lista de sistemas tem itens repetidos');
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
      prisma.usuarioFavorito.findMany({ where: { usuarioId: usuario.id }, select: { sistemaId: true, ordem: true } }),
      prisma.item.groupBy({ by: ['sistemaId', 'tipo', 'status'], _count: { _all: true } }),
    ]);
    const ordemFavorito = new Map(favoritos.map((f) => [f.sistemaId, f.ordem]));

    return sistemas
      .map((sistema) => ({
        ...sistema,
        favorito: ordemFavorito.has(sistema.id),
        /** Posição na ordem pessoal da página Favoritos (null se não for favorito). */
        ordemFavorito: ordemFavorito.get(sistema.id) ?? null,
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
    // O favorito novo entra no topo da ordem pessoal (como o sistema novo na ordem geral).
    const { _min } = await prisma.usuarioFavorito.aggregate({ where: { usuarioId: usuario.id }, _min: { ordem: true } });
    await prisma.usuarioFavorito.upsert({
      where: { usuarioId_sistemaId: { usuarioId: usuario.id, sistemaId: id } },
      create: { usuarioId: usuario.id, sistemaId: id, ordem: (_min.ordem ?? 1) - 1 },
      update: {},
    });
    return reply.status(204).send();
  });

  /** Ordem pessoal da página Favoritos (só do usuário logado). `ids` são sistemas favoritados, na nova ordem. */
  app.put('/sistemas/favoritos/ordem', async (request) => {
    const usuario = usuarioDa(request);
    const { ids } = corpoOrdem.parse(request.body);
    semRepetidos(ids);

    await prisma.$transaction(async (tx) => {
      const atuais = await tx.usuarioFavorito.findMany({
        where: { usuarioId: usuario.id, sistemaId: { in: ids } },
        select: { ordem: true },
      });
      if (atuais.length !== ids.length) {
        throw new HttpError(404, 'Algum dos sistemas não está mais nos seus favoritos. Recarregue a página');
      }
      const posicoes = redistribuir(atuais.map((f) => f.ordem));
      for (const [indice, sistemaId] of ids.entries()) {
        await tx.usuarioFavorito.update({
          where: { usuarioId_sistemaId: { usuarioId: usuario.id, sistemaId } },
          data: { ordem: posicoes[indice]! },
        });
      }
    });

    const favoritos = await prisma.usuarioFavorito.findMany({
      where: { usuarioId: usuario.id },
      select: { sistemaId: true, ordem: true },
      orderBy: { ordem: 'asc' },
    });
    return favoritos.map((f) => ({ id: f.sistemaId, ordem: f.ordem }));
  });

  app.delete('/sistemas/:id/favorito', async (request, reply) => {
    const usuario = usuarioDa(request);
    const { id } = parametroId.parse(request.params);
    await prisma.usuarioFavorito.deleteMany({ where: { usuarioId: usuario.id, sistemaId: id } });
    return reply.status(204).send();
  });

  app.post('/sistemas', async (request, reply) => {
    const { responsaveis, ...dados } = corpoSistema.parse(request.body);
    // Na ordem personalizada, o sistema novo entra no topo (como na ordem por mais recentes).
    const { _min } = await prisma.sistema.aggregate({ _min: { ordem: true } });
    const sistema = await prisma.sistema.create({
      data: { ...dados, ordem: (_min.ordem ?? 1) - 1, responsaveis: { create: (responsaveis ?? []).map(({ nome }, ordem) => ({ nome, ordem })) } },
      include: responsaveisOrdenados,
    });
    return reply.status(201).send(sistema);
  });

  /** Ordem personalizada da listagem (vale para todos). `ids` vem na nova ordem e pode ser só parte dos sistemas. */
  app.put('/sistemas/ordem', async (request) => {
    const { ids } = corpoOrdem.parse(request.body);
    semRepetidos(ids);

    await prisma.$transaction(async (tx) => {
      const atuais = await tx.sistema.findMany({ where: { id: { in: ids } }, select: { ordem: true } });
      if (atuais.length !== ids.length) throw new HttpError(404, 'Algum dos sistemas não existe mais. Recarregue a página');

      const posicoes = redistribuir(atuais.map((s) => s.ordem));
      for (const [indice, id] of ids.entries()) {
        await tx.sistema.update({ where: { id }, data: { ordem: posicoes[indice]! } });
      }
    });

    return prisma.sistema.findMany({ select: { id: true, ordem: true }, orderBy: { ordem: 'asc' } });
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
