import { z } from 'zod';

const esquema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3333),
  /** Origens liberadas no CORS, separadas por vírgula. */
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(5),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('Variáveis de ambiente inválidas:', z.flattenError(resultado.error).fieldErrors);
  process.exit(1);
}

export const env = resultado.data;
