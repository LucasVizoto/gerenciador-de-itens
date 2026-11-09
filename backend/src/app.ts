import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { ZodError, z } from 'zod';
import { env } from './config/env.js';
import { Prisma } from './generated/prisma/client.js';
import { prisma } from './lib/prisma.js';
import { categoriasRoutes } from './modules/categorias/categorias.routes.js';
import { eventosRoutes } from './modules/eventos/eventos.routes.js';
import { itensRoutes } from './modules/itens/itens.routes.js';
import { sistemasRoutes } from './modules/sistemas/sistemas.routes.js';

z.config(z.locales.ptBR());

const ERROS_PRISMA: Record<string, { status: number; mensagem: string }> = {
  P2025: { status: 404, mensagem: 'Registro não encontrado' },
  P2002: { status: 409, mensagem: 'Já existe um registro com esses dados (ex.: etapa com o mesmo nome)' },
  P2003: { status: 400, mensagem: 'Referência inválida para outro registro' },
};

function tratarErro(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      mensagem: 'Dados inválidos',
      erros: error.issues.map((issue) => ({ campo: issue.path.join('.'), mensagem: issue.message })),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && ERROS_PRISMA[error.code]) {
    const { status, mensagem } = ERROS_PRISMA[error.code]!;
    return reply.status(status).send({ mensagem });
  }

  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ mensagem: (error as Error).message });
  }

  request.log.error(error);
  return reply.status(500).send({ mensagem: 'Erro interno do servidor' });
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // Conexões SSE ficam abertas; sem isso o app.close() esperaria todas expirarem.
    forceCloseConnections: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((origem) => origem.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['content-disposition'],
  });
  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  });

  app.setErrorHandler(tratarErro);
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ mensagem: `Rota ${request.method} ${request.url} não encontrada` }),
  );

  await app.register(
    async (api) => {
      api.get('/health', { logLevel: 'warn' }, async () => {
        await prisma.$queryRaw`SELECT 1`;
        return { status: 'ok' };
      });
      await api.register(sistemasRoutes);
      await api.register(categoriasRoutes);
      await api.register(itensRoutes);
      await api.register(eventosRoutes);
    },
    { prefix: '/api' },
  );

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
