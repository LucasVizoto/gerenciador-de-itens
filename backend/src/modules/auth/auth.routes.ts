import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { criarSessao, encerrarSessao, semSenha, usuarioDa } from '../../lib/autenticacao.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';
import { gerarHashSenha, verificarSenha } from '../../lib/senha.js';

const email = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido').max(200));

const corpoCadastro = z.object({
  nomeCompleto: z.string().trim().min(3, 'Informe o nome completo').max(200),
  email,
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres').max(200),
});

const corpoLogin = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha').max(200),
});

const corpoTrocaSenha = z
  .object({
    email,
    senhaAtual: z.string().min(1, 'Informe a senha provisória').max(200),
    novaSenha: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres').max(200),
  })
  .refine((dados) => dados.novaSenha !== dados.senhaAtual, {
    message: 'A nova senha deve ser diferente da senha provisória',
    path: ['novaSenha'],
  });

/** Confere e-mail/senha e se o usuário pode entrar. Retorna o usuário completo (com hash). */
async function validarCredenciais(email: string, senha: string) {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) {
    throw new HttpError(401, 'E-mail ou senha inválidos');
  }
  if (!usuario.ativo) {
    throw new HttpError(403, 'Seu acesso ainda não foi liberado. Aguarde a aprovação de um administrador');
  }
  return usuario;
}

export async function authRoutes(app: FastifyInstance) {
  /**
   * Novos cadastros nascem inativos e aguardam a aprovação de um administrador (tela Usuários):
   * por isso não abrimos sessão aqui.
   */
  app.post('/auth/cadastro', async (request, reply) => {
    const dados = corpoCadastro.parse(request.body);
    if (await prisma.usuario.findUnique({ where: { email: dados.email }, select: { id: true } })) {
      throw new HttpError(409, 'Já existe um usuário com este e-mail');
    }

    const usuario = await prisma.usuario.create({
      data: { nomeCompleto: dados.nomeCompleto, email: dados.email, senhaHash: await gerarHashSenha(dados.senha), ativo: false },
    });
    return reply.status(201).send(semSenha(usuario));
  });

  app.post('/auth/login', async (request, reply) => {
    const { email, senha } = corpoLogin.parse(request.body);
    const usuario = await validarCredenciais(email, senha);
    // Senha provisória: não abre sessão; o frontend pede a nova senha e chama /auth/trocar-senha.
    if (usuario.trocarSenha) {
      throw new HttpError(403, 'Sua senha foi redefinida. Crie uma nova senha para continuar', 'TROCAR_SENHA');
    }

    await criarSessao(reply, usuario.id);
    return semSenha(usuario);
  });

  /**
   * Troca a senha provisória (definida por um administrador) pela senha escolhida pelo usuário
   * e já abre a sessão. Exige a senha provisória, então não serve para trocar a senha de terceiros.
   */
  app.post('/auth/trocar-senha', async (request, reply) => {
    const { email, senhaAtual, novaSenha } = corpoTrocaSenha.parse(request.body);
    const usuario = await validarCredenciais(email, senhaAtual);
    if (!usuario.trocarSenha) throw new HttpError(400, 'Não há troca de senha pendente para este usuário');

    const atualizado = await prisma.$transaction(async (tx) => {
      await tx.sessao.deleteMany({ where: { usuarioId: usuario.id } });
      return tx.usuario.update({
        where: { id: usuario.id },
        data: { senhaHash: await gerarHashSenha(novaSenha), trocarSenha: false },
      });
    });
    await criarSessao(reply, atualizado.id);
    return semSenha(atualizado);
  });

  app.post('/auth/logout', async (request, reply) => {
    await encerrarSessao(request, reply);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request) => usuarioDa(request));
}
