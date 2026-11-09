import type { StatusItem, TipoItem } from '../../generated/prisma/enums.js';

export interface ContagemItens {
  tipo: TipoItem;
  status: StatusItem;
  quantidade: number;
}

export interface ResumoEdital {
  totalItens: number;
  essenciais: {
    total: number;
    atendidos: number;
    naoAtendidos: number;
    pendentes: number;
    /** Quantidade mínima de atendidos para bater a meta. */
    minimo: number;
    percentual: number;
  };
  obrigatorios: {
    total: number;
    atendidos: number;
    percentual: number;
  };
  metaAtingida: boolean;
}

/**
 * Regra de cálculo da apresentação: percentual = essenciais atendidos ÷ total de essenciais.
 * Pendentes não contam como atendidos; complementares ficam fora do cálculo;
 * todos os obrigatórios precisam estar atendidos.
 */
export function calcularResumo(contagens: ContagemItens[], metaPercentual: number): ResumoEdital {
  const somar = (tipo: TipoItem, status?: StatusItem) =>
    contagens
      .filter((c) => c.tipo === tipo && (!status || c.status === status))
      .reduce((total, c) => total + c.quantidade, 0);

  const essenciais = somar('ESSENCIAL');
  const atendidos = somar('ESSENCIAL', 'ATENDE');
  const obrigatorios = somar('OBRIGATORIO');
  const obrigatoriosAtendidos = somar('OBRIGATORIO', 'ATENDE');
  const minimo = Math.ceil((essenciais * metaPercentual) / 100);

  return {
    totalItens: contagens.reduce((total, c) => total + c.quantidade, 0),
    essenciais: {
      total: essenciais,
      atendidos,
      naoAtendidos: somar('ESSENCIAL', 'NAO_ATENDE'),
      pendentes: somar('ESSENCIAL', 'PENDENTE'),
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
