import { HttpError } from './http-error.js';
import { prisma } from './prisma.js';

export async function garantirSistema(sistemaId: string): Promise<void> {
  const sistema = await prisma.sistema.findUnique({ where: { id: sistemaId }, select: { id: true } });
  if (!sistema) throw new HttpError(404, 'Sistema não encontrado');
}

export async function garantirCategoriasDoSistema(sistemaId: string, ids: Array<string | null | undefined>) {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unicos.length) return;
  const encontradas = await prisma.categoria.count({ where: { sistemaId, id: { in: unicos } } });
  if (encontradas !== unicos.length) throw new HttpError(400, 'Etapa não pertence a este sistema');
}

export async function proximaOrdemItem(sistemaId: string, categoriaId: string | null): Promise<number> {
  const { _max } = await prisma.item.aggregate({ where: { sistemaId, categoriaId }, _max: { ordem: true } });
  return (_max.ordem ?? -1) + 1;
}
