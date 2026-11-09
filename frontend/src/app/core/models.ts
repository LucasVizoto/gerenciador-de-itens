export type StatusItem = 'PENDENTE' | 'ATENDE' | 'NAO_ATENDE';
export type TipoItem = 'OBRIGATORIO' | 'ESSENCIAL' | 'COMPLEMENTAR';

/** Sistema apresentado. Os itens do edital e a avaliação pertencem a ele. */
export interface Sistema {
  id: string;
  nome: string;
  versao: string | null;
  descricao: string | null;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  dataApresentacao: string | null;
  metaPercentual: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Categoria {
  id: string;
  sistemaId: string;
  nome: string;
  ordem: number;
}

export interface Item {
  id: string;
  sistemaId: string;
  categoriaId: string | null;
  numero: string | null;
  descricao: string;
  tipo: TipoItem;
  status: StatusItem;
  observacao: string | null;
  ordem: number;
  atualizadoEm: string;
}

export interface Resumo {
  totalItens: number;
  essenciais: {
    total: number;
    atendidos: number;
    naoAtendidos: number;
    pendentes: number;
    minimo: number;
    percentual: number;
  };
  obrigatorios: { total: number; atendidos: number; percentual: number };
  metaAtingida: boolean;
}

export interface SistemaComResumo extends Sistema {
  resumo: Resumo;
}

export interface SistemaDetalhe extends Sistema {
  categorias: Categoria[];
  itens: Item[];
}

export interface DadosSistema {
  nome: string;
  versao: string | null;
  descricao: string | null;
  numero: string | null;
  orgao: string | null;
  objeto: string | null;
  /** AAAA-MM-DD */
  dataApresentacao: string | null;
  metaPercentual: number;
}

export interface DadosItem {
  numero?: string | null;
  descricao?: string;
  tipo?: TipoItem;
  status?: StatusItem;
  categoriaId?: string | null;
  observacao?: string | null;
}

export interface PosicaoItem {
  id: string;
  categoriaId: string | null;
  ordem: number;
}

export interface ResultadoImportacao {
  arquivo: string;
  linhasLidas: number;
  criados: number;
  atualizados: number;
  categoriasCriadas: string[];
  colunas: Record<string, string>;
  avisos: Array<{ linha: number; mensagem: string }>;
}

export interface EventoEdital {
  tipo:
    | 'item.criado'
    | 'item.atualizado'
    | 'item.removido'
    | 'itens.reordenados'
    | 'itens.importados'
    | 'itens.reiniciados'
    | 'categorias.alteradas'
    | 'sistema.atualizado'
    | 'sistema.removido';
  dados?: unknown;
  origem?: string;
}
