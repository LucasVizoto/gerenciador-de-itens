import { parse } from 'csv-parse/sync';
import type { StatusItem, TipoItem } from '../../generated/prisma/enums.js';

export type CampoCsv = 'numero' | 'descricao' | 'tipo' | 'categoria' | 'status' | 'observacao';

export interface LinhaCsv {
  linha: number;
  numero: string | null;
  descricao: string;
  tipo: TipoItem | null;
  categoria: string | null;
  status: StatusItem | null;
  observacao: string | null;
}

export interface AvisoCsv {
  linha: number;
  mensagem: string;
}

export interface LeituraCsv {
  delimitador: string;
  /** Campo do sistema → cabeçalho encontrado na planilha. */
  colunas: Partial<Record<CampoCsv, string>>;
  linhas: LinhaCsv[];
  avisos: AvisoCsv[];
}

export class ErroCsv extends Error {
  readonly statusCode = 422;
}

export const LIMITE_LINHAS = 5000;

const APELIDOS: Record<CampoCsv, string[]> = {
  numero: ['item', 'numero', 'n', 'no', 'num', 'nr', 'numero do item', 'item n', 'n item', 'cod', 'codigo', 'ref', 'referencia', 'id'],
  descricao: ['requisito', 'requisitos', 'descricao', 'descricao do requisito', 'descricao do item', 'especificacao', 'funcionalidade', 'texto'],
  tipo: ['tipo', 'classificacao', 'natureza', 'criticidade'],
  categoria: ['etapa', 'categoria', 'processo', 'modulo', 'grupo', 'secao', 'bloco', 'area'],
  status: ['status', 'situacao', 'avaliacao', 'atende', 'conformidade', 'resultado'],
  observacao: ['observacao', 'observacoes', 'obs', 'comentario', 'comentarios', 'justificativa', 'nota', 'notas'],
};

/** Descrição vem antes de número para "Descrição do item" não ser lido como numeração. */
const PRIORIDADE: CampoCsv[] = ['descricao', 'categoria', 'observacao', 'status', 'tipo', 'numero'];
const DELIMITADORES = [';', ',', '\t', '|'];
const LINHAS_BUSCA_CABECALHO = 10;

export function normalizar(texto: string): string {
  return texto
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Planilhas salvas pelo Excel em pt-BR costumam vir em Windows-1252 em vez de UTF-8. */
function decodificar(conteudo: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(conteudo);
  } catch {
    return new TextDecoder('windows-1252').decode(conteudo);
  }
}

function mapearColunas(cabecalho: string[]): Map<CampoCsv, number> {
  const normalizados = cabecalho.map(normalizar);
  const mapa = new Map<CampoCsv, number>();
  const usados = new Set<number>();

  const procurar = (campo: CampoCsv, combina: (cabecalho: string, apelido: string) => boolean) => {
    if (mapa.has(campo)) return;
    const indice = normalizados.findIndex(
      (nome, i) => !usados.has(i) && APELIDOS[campo].some((apelido) => combina(nome, apelido)),
    );
    if (indice >= 0) {
      mapa.set(campo, indice);
      usados.add(indice);
    }
  };

  for (const campo of PRIORIDADE) procurar(campo, (nome, apelido) => nome === apelido);
  for (const campo of PRIORIDADE) {
    procurar(campo, (nome, apelido) => apelido.length >= 3 && ` ${nome} `.includes(` ${apelido} `));
  }
  return mapa;
}

interface Estrutura {
  delimitador: string;
  registros: string[][];
  /** Linha do arquivo onde cada registro termina (registros podem ter quebras de linha). */
  linhasOrigem: number[];
  indiceCabecalho: number;
  mapa: Map<CampoCsv, number>;
}

/** Testa cada delimitador e fica com o que reconhece mais colunas no cabeçalho. */
function detectarEstrutura(texto: string): Estrutura | null {
  let melhor: Estrutura | null = null;

  for (const delimitador of DELIMITADORES) {
    let registros: string[][];
    const linhasOrigem: number[] = [];
    try {
      registros = parse(texto, {
        delimiter: delimitador,
        relax_column_count: true,
        relax_quotes: true,
        skip_empty_lines: true,
        skip_records_with_empty_values: true,
        trim: true,
        on_record: (registro, contexto) => {
          linhasOrigem.push(contexto.lines);
          return registro;
        },
      });
    } catch {
      continue;
    }

    const limite = Math.min(registros.length, LINHAS_BUSCA_CABECALHO);
    for (let indice = 0; indice < limite; indice++) {
      const mapa = mapearColunas(registros[indice] ?? []);
      if (!mapa.has('descricao')) continue;
      if (!melhor || mapa.size > melhor.mapa.size) {
        melhor = { delimitador, registros, linhasOrigem, indiceCabecalho: indice, mapa };
      }
      break;
    }
  }
  return melhor;
}

export function lerTipo(valor: string): TipoItem | null {
  const v = normalizar(valor);
  if (/^(obr|mand|elim)/.test(v)) return 'OBRIGATORIO';
  if (/^(ess|func|req)/.test(v)) return 'ESSENCIAL';
  if (/^(comp|rel|opc|des|extra)/.test(v)) return 'COMPLEMENTAR';
  return null;
}

export function lerStatus(valor: string): StatusItem | null {
  if (/[✓✔]/.test(valor)) return 'ATENDE';
  if (/[✕✗✘]/.test(valor)) return 'NAO_ATENDE';

  const v = normalizar(valor);
  if (/^(pend|nao avaliad|a avaliar|em analise)/.test(v)) return 'PENDENTE';
  if (v.includes('parcial')) return null;
  if (/^(nao|reprov)/.test(v) || ['n', 'no', 'x'].includes(v)) return 'NAO_ATENDE';
  if (/^(atende|atendido|conforme|aprov)/.test(v) || ['sim', 's', 'ok', 'a', 'yes', 'y'].includes(v)) return 'ATENDE';
  return null;
}

export function lerCsvItens(conteudo: Buffer): LeituraCsv {
  const texto = decodificar(conteudo);
  if (!texto.trim()) throw new ErroCsv('O arquivo está vazio.');

  const estrutura = detectarEstrutura(texto);
  if (!estrutura) {
    throw new ErroCsv(
      'Não encontrei a coluna com o texto do requisito. Use um cabeçalho como "Requisito" ou "Descrição" ' +
        '(colunas opcionais: Tipo, Item, Etapa, Status, Observação).',
    );
  }

  const { delimitador, registros, linhasOrigem, indiceCabecalho, mapa } = estrutura;
  const cabecalho = registros[indiceCabecalho] ?? [];
  const totalDados = registros.length - indiceCabecalho - 1;
  if (totalDados > LIMITE_LINHAS) {
    throw new ErroCsv(`A planilha tem ${totalDados} linhas; o limite por importação é ${LIMITE_LINHAS}.`);
  }

  const linhas: LinhaCsv[] = [];
  const avisos: AvisoCsv[] = [];

  for (let indice = indiceCabecalho + 1; indice < registros.length; indice++) {
    const registro = registros[indice] ?? [];
    const linha = linhasOrigem[indice] ?? indice + 1;
    const valor = (campo: CampoCsv) => {
      const coluna = mapa.get(campo);
      return coluna === undefined ? '' : (registro[coluna] ?? '').trim();
    };

    const descricao = valor('descricao');
    if (!descricao) {
      avisos.push({ linha, mensagem: 'Linha ignorada: requisito sem descrição.' });
      continue;
    }

    const tipoBruto = valor('tipo');
    const tipo = tipoBruto ? lerTipo(tipoBruto) : null;
    if (tipoBruto && !tipo) {
      avisos.push({ linha, mensagem: `Tipo "${tipoBruto}" não reconhecido; o item foi tratado como Essencial.` });
    }

    const statusBruto = valor('status');
    const status = statusBruto ? lerStatus(statusBruto) : null;
    if (statusBruto && !status) {
      avisos.push({
        linha,
        mensagem: `Status "${statusBruto}" não reconhecido. Use Atende ou Não atende; o item ficou Pendente.`,
      });
    }

    linhas.push({
      linha,
      numero: valor('numero') || null,
      descricao,
      tipo,
      categoria: valor('categoria') || null,
      status,
      observacao: valor('observacao') || null,
    });
  }

  const colunas: LeituraCsv['colunas'] = {};
  for (const [campo, coluna] of mapa) colunas[campo] = cabecalho[coluna] ?? '';

  return { delimitador, colunas, linhas, avisos };
}

const ROTULO_TIPO: Record<TipoItem, string> = {
  OBRIGATORIO: 'Obrigatório',
  ESSENCIAL: 'Essencial',
  COMPLEMENTAR: 'Complementar',
};

const ROTULO_STATUS: Record<StatusItem, string> = {
  PENDENTE: 'Pendente',
  ATENDE: 'Atende',
  NAO_ATENDE: 'Não atende',
};

export interface ItemExportavel {
  tipo: TipoItem;
  numero: string | null;
  descricao: string;
  status: StatusItem;
  observacao: string | null;
  categoria: { nome: string } | null;
}

/** Mesmo layout aceito pela importação, com BOM e ";" para abrir direto no Excel pt-BR. */
export function gerarCsvItens(itens: ItemExportavel[]): string {
  const celula = (valor: string) => `"${valor.replaceAll('"', '""')}"`;
  const linhas = [
    ['Tipo', 'Item', 'Etapa', 'Requisito', 'Status', 'Observação'],
    ...itens.map((item) => [
      ROTULO_TIPO[item.tipo],
      item.numero ?? '',
      item.categoria?.nome ?? '',
      item.descricao,
      ROTULO_STATUS[item.status],
      item.observacao ?? '',
    ]),
  ];
  return '\uFEFF' + linhas.map((linha) => linha.map(celula).join(';')).join('\r\n') + '\r\n';
}
