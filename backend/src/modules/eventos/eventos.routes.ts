import type { OutgoingHttpHeaders } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { garantirSistema } from '../../lib/consultas.js';
import { assinar, type EventoEdital } from '../../lib/eventos.js';
import { parametroSistemaId } from '../../lib/validacao.js';

const INTERVALO_HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events: cada aba aberta no edital recebe as alterações feitas pelas outras
 * (status, ordem, importação), mantendo a apresentação sincronizada entre os avaliadores.
 */
export async function eventosRoutes(app: FastifyInstance) {
  app.get('/sistemas/:sistemaId/eventos', async (request, reply) => {
    const { sistemaId } = parametroSistemaId.parse(request.params);
    await garantirSistema(sistemaId);

    const cabecalhos: OutgoingHttpHeaders = {};
    for (const [nome, valor] of Object.entries(reply.getHeaders())) {
      if (valor !== undefined) cabecalhos[nome] = valor;
    }

    reply.hijack();
    const resposta = reply.raw;
    resposta.writeHead(200, {
      ...cabecalhos,
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    resposta.write('retry: 3000\n\n');

    const enviar = (evento: EventoEdital) => resposta.write(`data: ${JSON.stringify(evento)}\n\n`);
    const cancelar = assinar(sistemaId, enviar);
    const heartbeat = setInterval(() => resposta.write(': ping\n\n'), INTERVALO_HEARTBEAT_MS);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      cancelar();
    });
  });
}
