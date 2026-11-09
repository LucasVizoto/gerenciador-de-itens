import type { Item, Resumo, StatusItem, TipoItem } from './models';

export const STATUS: Record<StatusItem, { rotulo: string; simbolo: string }> = {
  ATENDE: { rotulo: 'Atende', simbolo: '✓' },
  NAO_ATENDE: { rotulo: 'Não atende', simbolo: '✕' },
  PENDENTE: { rotulo: 'Pendente', simbolo: '○' },
};

export const TIPOS: Record<TipoItem, { rotulo: string; prefixo: string }> = {
  OBRIGATORIO: { rotulo: 'Obrigatório', prefixo: 'OBR.' },
  ESSENCIAL: { rotulo: 'Essencial', prefixo: 'ITEM' },
  COMPLEMENTAR: { rotulo: 'Complementar', prefixo: 'ITEM' },
};

export const ORDEM_TIPOS: TipoItem[] = ['OBRIGATORIO', 'ESSENCIAL', 'COMPLEMENTAR'];

/** Ordenação natural da numeração do edital ("2" < "10", "3.1.2" < "3.1.10"). */
export function compararNumero(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Mesma regra da API: essenciais atendidos ÷ total de essenciais; pendentes não contam. */
export function calcularResumo(itens: Item[], metaPercentual: number): Resumo {
  const contar = (tipo: TipoItem, status?: StatusItem) =>
    itens.filter((i) => i.tipo === tipo && (!status || i.status === status)).length;

  const essenciais = contar('ESSENCIAL');
  const atendidos = contar('ESSENCIAL', 'ATENDE');
  const obrigatorios = contar('OBRIGATORIO');
  const obrigatoriosAtendidos = contar('OBRIGATORIO', 'ATENDE');
  const minimo = Math.ceil((essenciais * metaPercentual) / 100);

  return {
    totalItens: itens.length,
    essenciais: {
      total: essenciais,
      atendidos,
      naoAtendidos: contar('ESSENCIAL', 'NAO_ATENDE'),
      pendentes: contar('ESSENCIAL', 'PENDENTE'),
      minimo,
      percentual: essenciais ? (atendidos / essenciais) * 100 : 0,
    },
    obrigatorios: {
      total: obrigatorios,
      atendidos: obrigatoriosAtendidos,
      percentual: obrigatorios ? (obrigatoriosAtendidos / obrigatorios) * 100 : 100,
    },
    metaAtingida: essenciais + obrigatorios > 0 && atendidos >= minimo && obrigatoriosAtendidos === obrigatorios,
  };
}

const formatoPercentual = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatoData = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

export const formatarPercentual = (valor: number) => `${formatoPercentual.format(valor)}%`;
export const plural = (quantidade: number, singular: string, plural: string) =>
  `${quantidade} ${quantidade === 1 ? singular : plural}`;
export const formatarData = (iso: string) => formatoData.format(new Date(iso));
