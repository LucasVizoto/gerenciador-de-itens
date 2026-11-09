import { z } from 'zod';

/** Texto opcional: string vazia vira `null`; campo ausente continua `undefined`. */
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((valor) => valor || null)
    .nullable()
    .optional();

export const parametroId = z.object({ id: z.uuid('Identificador inválido') });
export const parametroSistemaId = z.object({ sistemaId: z.uuid('Identificador de sistema inválido') });
