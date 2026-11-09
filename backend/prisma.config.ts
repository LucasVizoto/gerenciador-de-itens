import { defineConfig } from 'prisma/config';

try {
  process.loadEnvFile();
} catch {
  // Sem arquivo .env (ex.: dentro do container): usa as variáveis do ambiente.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` roda no build da imagem sem banco disponível.
    url: process.env.DATABASE_URL ?? '',
  },
});
