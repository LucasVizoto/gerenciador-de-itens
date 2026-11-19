import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Usuario } from '../generated/prisma/client.js';
import { HttpError } from './http-error.js';
import { prisma } from './prisma.js';

export type UsuarioPublico = Omit<Usuario, 'senhaHash'>;

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuário da sessão; preenchido pelo hook de autenticação nas rotas protegidas. */
    usuario?: UsuarioPublico;
  }
}

export const COOKIE_SESSAO = 'sessao';
const DURACAO_SESSAO_MS = 7 * 24 * 60 * 60 * 1000;

/** Rotas acessíveis sem login (caminho completo, com o prefixo /api). */
const ROTAS_PUBLICAS = new Set(['/api/health', '/api/auth/login', '/api/auth/cadastro', '/api/auth/trocar-senha']);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function semSenha({ senhaHash: _senhaHash, ...usuario }: Usuario): UsuarioPublico {
  return usuario;
}

export async function criarSessao(reply: FastifyReply, usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await prisma.$transaction([
    prisma.sessao.deleteMany({ where: { usuarioId, expiraEm: { lt: new Date() } } }),
    prisma.sessao.create({ data: { tokenHash: hashToken(token), usuarioId, expiraEm } }),
  ]);
  reply.setCookie(COOKIE_SESSAO, token, {
    path: '/api',
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    expires: expiraEm,
  });
}

export async function encerrarSessao(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[COOKIE_SESSAO];
  if (token) await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
  reply.clearCookie(COOKIE_SESSAO, { path: '/api' });
}

/** Hook `preHandler`: exige uma sessão válida de usuário ativo, exceto nas rotas públicas. */
export async function autenticar(request: FastifyRequest): Promise<void> {
  if (ROTAS_PUBLICAS.has(request.routeOptions.url ?? '')) return;

  const token = request.cookies[COOKIE_SESSAO];
  if (!token) throw new HttpError(401, 'Faça login para continuar');

  const sessao = await prisma.sessao.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: true } });
  if (!sessao || sessao.expiraEm <= new Date() || !sessao.usuario.ativo) {
    throw new HttpError(401, 'Sessão expirada. Faça login novamente');
  }
  request.usuario = semSenha(sessao.usuario);
}

/** Usuário da requisição; só deve ser usado em rotas protegidas. */
export function usuarioDa(request: FastifyRequest): UsuarioPublico {
  if (!request.usuario) throw new HttpError(401, 'Faça login para continuar');
  return request.usuario;
}

export function exigirAdmin(request: FastifyRequest): UsuarioPublico {
  const usuario = usuarioDa(request);
  if (!usuario.administrador) throw new HttpError(403, 'Acesso restrito a administradores');
  return usuario;
}
