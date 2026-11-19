import type { ContagemItens, SistemaDashboard, StatusItem, TipoItem } from '../../core/models';

/** Tipos que entram no atendimento: dispensados da POC ficam fora de todos os cálculos. */
export type TipoAvaliado = Exclude<TipoItem, 'DISPENSADO'>;
export const TIPOS_AVALIADOS: TipoAvaliado[] = ['OBRIGATORIO', 'ESSENCIAL', 'COMPLEMENTAR'];

export type FiltroTipo = 'TODOS' | TipoAvaliado;
export type Situacao = 'atingida' | 'avaliacao' | 'vazio';
export type Ordenacao = 'atendimento' | 'nome' | 'itens' | 'pendentes';

export const SITUACOES: Record<Situacao, string> = {
  atingida: 'Meta atingida',
  avaliacao: 'Em avaliação',
  vazio: 'Sem itens',
};

export interface Atendimento {
  atende: number;
  naoAtende: number;
  pendente: number;
  total: number;
  /** Atendidos ÷ total (pendentes contam no total). */
  percentual: number;
  /** Itens já marcados (atende ou não atende) ÷ total. */
  avaliado: number;
}

const tiposDo = (filtro: FiltroTipo): TipoItem[] => (filtro === 'TODOS' ? TIPOS_AVALIADOS : [filtro]);

/** Soma as contagens dos tipos escolhidos em atende / não atende / pendente. */
export function atendimento(contagens: ContagemItens[], filtro: FiltroTipo = 'TODOS'): Atendimento {
  const tipos = tiposDo(filtro);
  const somar = (status: StatusItem) =>
    contagens.filter((c) => c.status === status && tipos.includes(c.tipo)).reduce((t, c) => t + c.quantidade, 0);
  const atende = somar('ATENDE');
  const naoAtende = somar('NAO_ATENDE');
  const pendente = somar('PENDENTE');
  const total = atende + naoAtende + pendente;
  return {
    atende,
    naoAtende,
    pendente,
    total,
    percentual: total ? (atende / total) * 100 : 0,
    avaliado: total ? ((atende + naoAtende) / total) * 100 : 0,
  };
}

export const somarContagens = (sistemas: SistemaDashboard[]) => sistemas.flatMap((s) => s.contagens);

export const dispensados = (contagens: ContagemItens[]) =>
  contagens.filter((c) => c.tipo === 'DISPENSADO').reduce((t, c) => t + c.quantidade, 0);

export function situacaoDo(sistema: SistemaDashboard): Situacao {
  if (sistema.resumo.metaAtingida) return 'atingida';
  return sistema.resumo.totalItens === 0 ? 'vazio' : 'avaliacao';
}

export const nomeCompleto = (sistema: Pick<SistemaDashboard, 'nome' | 'versao'>) =>
  sistema.versao ? `${sistema.nome} · v${sistema.versao}` : sistema.nome;
