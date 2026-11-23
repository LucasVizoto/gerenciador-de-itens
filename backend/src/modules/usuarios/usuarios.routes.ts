import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { exigirAdmin, semSenha } from '../../lib/autenticacao.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { gerarHashSenha } from '../../lib/senha.js';
import { parametroId } from '../../lib/validacao.js';

const corpoAtualizacao = z
  .object({ ativo: z.boolean().optional(), administrador: z.boolean().optional() })
  .refine((dados) => dados.ativo !== undefined || dados.administrador !== undefined, 'Informe ativo ou administrador');

const corpoRedefinicao = z.object({
  senha: z.string().min(6, 'A senha provisória deve ter pelo menos 6 caracteres').max(200),
});

/** Gestão de usuários: exclusiva de administradores (exceto a lista resumida de ativos). */
export async function usuariosRoutes(app: FastifyInstance) {
  /** Nome dos usuários ativos, para qualquer usuário logado escolher apresentador/apoio na agenda. */
  app.get('/usuarios/ativos', async () =>
    prisma.usuario.findMany({
      where: { ativo: true },
      select: { id: true, nomeCompleto: true },
      orderBy: { nomeCompleto: 'asc' },
    }),
  );

  app.get('/usuarios', async (request) => {
    exigirAdmin(request);
    // Pendentes de aprovação (inativos) primeiro, para o administrador encontrá-los logo.
    const usuarios = await prisma.usuario.findMany({ orderBy: [{ ativo: 'asc' }, { nomeCompleto: 'asc' }, { criadoEm: 'asc' }] });
    return usuarios.map(semSenha);
  });

  app.patch('/usuarios/:id', async (request) => {
    const admin = exigirAdmin(request);
    const { id } = parametroId.parse(request.params);
    const dados = corpoAtualizacao.parse(request.body);
    if (id === admin.id && (dados.ativo === false || dados.administrador === false)) {
      throw new HttpError(400, 'Você não pode desativar nem remover o seu próprio perfil de administrador');
    }

    const usuario = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.usuario.update({ where: { id }, data: dados });
      // Desativado: derruba as sessões abertas na hora.
      if (dados.ativo === false) await tx.sessao.deleteMany({ where: { usuarioId: id } });
      return atualizado;
    });
    return semSenha(usuario);
  });

  /**
   * Define uma senha provisória: o usuário entra com ela uma vez e é obrigado a criar uma nova.
   * As sessões abertas dele são encerradas na hora.
   */
  app.post('/usuarios/:id/redefinir-senha', async (request) => {
    const admin = exigirAdmin(request);
    const { id } = parametroId.parse(request.params);
    const { senha } = corpoRedefinicao.parse(request.body);
    if (id === admin.id) throw new HttpError(400, 'Você não pode redefinir a sua própria senha por aqui');

    const senhaHash = await gerarHashSenha(senha);
    const usuario = await prisma.$transaction(async (tx) => {
      const atualizado = await tx.usuario.update({ where: { id }, data: { senhaHash, trocarSenha: true } });
      await tx.sessao.deleteMany({ where: { usuarioId: id } });
      return atualizado;
    });
    return semSenha(usuario);
  });

  app.delete('/usuarios/:id', async (request, reply) => {
    const admin = exigirAdmin(request);
    const { id } = parametroId.parse(request.params);
    if (id === admin.id) throw new HttpError(400, 'Você não pode excluir o seu próprio usuário');

    await prisma.usuario.delete({ where: { id } });
    return reply.status(204).send();
  });
}
