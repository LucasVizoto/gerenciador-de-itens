import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { usuarioDa } from '../../lib/autenticacao.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { parametroId, textoOpcional } from '../../lib/validacao.js';

const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:MM)');

const corpoApresentacao = z
  .object({
    sistemaId: z.uuid('Escolha o sistema'),
    complemento: textoOpcional(120),
    tema: textoOpcional(200),
    data: z.iso.date('Data inválida (use AAAA-MM-DD)').transform((data) => new Date(`${data}T00:00:00Z`)),
    inicio: horario,
    fim: horario,
    apresentadorId: z.uuid('Escolha o apresentador'),
    apoioId: z.uuid('Apoio inválido').nullable().optional(),
  })
  // "HH:MM" com zero à esquerda: a comparação de texto equivale à de horário.
  .refine((dados) => dados.fim > dados.inicio, { path: ['fim'], message: 'O fim deve ser depois do início' });

const filtroLista = z.object({
  minhas: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => valor === 'true'),
});

const pessoa = { select: { id: true, nomeCompleto: true } } as const;

const incluir = {
  sistema: { select: { id: true, nome: true, versao: true } },
  apresentador: pessoa,
  apoio: pessoa,
} satisfies Prisma.ApresentacaoInclude;

/** Apresentador e apoio precisam ser usuários ativos (os mesmos oferecidos em /usuarios/ativos). */
async function validarPessoas(apresentadorId: string, apoioId: string | null | undefined) {
  const ids = [...new Set([apresentadorId, ...(apoioId ? [apoioId] : [])])];
  const ativos = await prisma.usuario.count({ where: { id: { in: ids }, ativo: true } });
  if (ativos !== ids.length) throw new HttpError(400, 'Apresentador e apoio precisam ser usuários ativos');
}

/** Agenda de apresentações: qualquer usuário logado consulta e edita (como os sistemas). */
export async function agendaRoutes(app: FastifyInstance) {
  /** Ordenada por dia e horário; `?minhas=true` traz só as do usuário (apresentador ou apoio). */
  app.get('/apresentacoes', async (request) => {
    const usuario = usuarioDa(request);
    const { minhas } = filtroLista.parse(request.query);
    return prisma.apresentacao.findMany({
      where: minhas ? { OR: [{ apresentadorId: usuario.id }, { apoioId: usuario.id }] } : undefined,
      include: incluir,
      orderBy: [{ data: 'asc' }, { inicio: 'asc' }, { fim: 'asc' }],
    });
  });

  app.post('/apresentacoes', async (request, reply) => {
    const dados = corpoApresentacao.parse(request.body);
    await validarPessoas(dados.apresentadorId, dados.apoioId);
    const apresentacao = await prisma.apresentacao.create({ data: dados, include: incluir });
    return reply.status(201).send(apresentacao);
  });

  app.put('/apresentacoes/:id', async (request) => {
    const { id } = parametroId.parse(request.params);
    const dados = corpoApresentacao.parse(request.body);
    await validarPessoas(dados.apresentadorId, dados.apoioId);
    return prisma.apresentacao.update({
      where: { id },
      data: { ...dados, apoioId: dados.apoioId ?? null },
      include: incluir,
    });
  });

  app.delete('/apresentacoes/:id', async (request, reply) => {
    const { id } = parametroId.parse(request.params);
    await prisma.apresentacao.delete({ where: { id } });
    return reply.status(204).send();
  });
}
