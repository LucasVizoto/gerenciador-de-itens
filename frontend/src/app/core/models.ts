export type StatusItem = 'PENDENTE' | 'ATENDE' | 'NAO_ATENDE';
/** DISPENSADO = dispensado da POC: aparece no checklist, mas fica fora de todos os cálculos. */
export type TipoItem = 'OBRIGATORIO' | 'ESSENCIAL' | 'COMPLEMENTAR' | 'DISPENSADO';

/** Sistema apresentado. Os itens do edital e a avaliação pertencem a ele. */
export interface Sistema {
  id: string;
  nome: string;
  versao: string | null;
  descricao: string | null;
  numero: string | null;
  orgao: string | null;
  /** Cidade do local/data da assinatura do relatório. */
  cidade: string | null;
  objeto: string | null;
  dataApresentacao: string | null;
  metaPercentual: number;
  /** Posição na "Ordem personalizada" da listagem (a mesma para todos). */
  ordem: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** Responsável que assina o relatório do sistema (cada um recebe um PDF próprio). */
export interface Responsavel {
  id: string;
  sistemaId: string;
  nome: string;
  ordem: number;
}

export interface SistemaComResponsaveis extends Sistema {
  responsaveis: Responsavel[];
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
  /** Favoritado pelo usuário logado. */
  favorito: boolean;
  /** Posição na ordem pessoal da página Favoritos (null se não for favorito). */
  ordemFavorito: number | null;
}

/** Quantidade de itens de um tipo com um status. */
export interface ContagemItens {
  tipo: TipoItem;
  status: StatusItem;
  quantidade: number;
}

export interface EtapaDashboard {
  /** `null` = itens sem etapa. */
  id: string | null;
  nome: string;
  contagens: ContagemItens[];
}

export interface SistemaDashboard
  extends Pick<
    Sistema,
    'id' | 'nome' | 'versao' | 'numero' | 'orgao' | 'dataApresentacao' | 'metaPercentual' | 'criadoEm' | 'atualizadoEm'
  > {
  favorito: boolean;
  resumo: Resumo;
  contagens: ContagemItens[];
  etapas: EtapaDashboard[];
}

export interface Usuario {
  id: string;
  email: string;
  nomeCompleto: string;
  ativo: boolean;
  administrador: boolean;
  /** Senha provisória pendente: precisa criar uma nova no próximo acesso. */
  trocarSenha: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosCadastro {
  nomeCompleto: string;
  email: string;
  senha: string;
}

export interface SistemaDetalhe extends SistemaComResponsaveis {
  categorias: Categoria[];
  itens: Item[];
}

export interface DadosSistema {
  nome: string;
  versao: string | null;
  descricao: string | null;
  numero: string | null;
  orgao: string | null;
  cidade: string | null;
  objeto: string | null;
  /** AAAA-MM-DD */
  dataApresentacao: string | null;
  metaPercentual: number;
  /** Lista completa, na ordem: com `id` mantém/renomeia, sem `id` cria; os ausentes são removidos. */
  responsaveis: DadosResponsavel[];
}

export interface DadosResponsavel {
  id?: string;
  nome: string;
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
  /** Linhas de título/subtítulo da planilha que não viraram itens. */
  titulosIgnorados?: number;
  /** Cabeçalhos da planilha que não correspondem a nenhum campo. */
  colunasIgnoradas?: string[];
}

export interface EventoEdital {
  tipo:
    | 'item.criado'
    | 'item.atualizado'
    | 'item.removido'
    | 'itens.removidos'
    | 'itens.status'
    | 'itens.reordenados'
    | 'itens.importados'
    | 'itens.reiniciados'
    | 'categorias.alteradas'
    | 'sistema.atualizado'
    | 'sistema.removido';
  dados?: unknown;
  origem?: string;
}

/** Usuário ativo, como aparece nas listas de escolha (ex.: apresentador da agenda). */
export interface PessoaResumo {
  id: string;
  nomeCompleto: string;
}

/** Apresentação da agenda. `data` vem como ISO (meia-noite UTC); `inicio`/`fim` como "HH:MM". */
export interface Apresentacao {
  id: string;
  sistemaId: string;
  sistema: { id: string; nome: string; versao: string | null };
  complemento: string | null;
  tema: string | null;
  data: string;
  inicio: string;
  fim: string;
  apresentadorId: string | null;
  apresentador: PessoaResumo | null;
  apoioId: string | null;
  apoio: PessoaResumo | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface DadosApresentacao {
  sistemaId: string;
  complemento: string | null;
  tema: string | null;
  /** AAAA-MM-DD */
  data: string;
  inicio: string;
  fim: string;
  apresentadorId: string;
  apoioId: string | null;
}
