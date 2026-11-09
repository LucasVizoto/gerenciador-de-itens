import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, async () => {
    app.log.info(`${sinal} recebido, encerrando a API...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
