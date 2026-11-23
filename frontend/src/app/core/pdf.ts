import type { Content, ContentStack, CustomTableLayout, TDocumentDefinitions } from 'pdfmake/interfaces';
import { normalizarBusca } from './dominio';

/**
 * Infraestrutura comum dos PDFs gerados no navegador com pdfmake (relatório de conformidade e roteiro da agenda).
 * O pdfmake (~1 MB com as fontes) é carregado sob demanda para não pesar no bundle inicial.
 */

/** Mesma escala de azul da marca de `styles.css`. */
export const COR = {
  brand950: '#0b1f4d',
  brand900: '#172d6b',
  brand800: '#1e3a8a',
  brand600: '#1d4ed8',
  brand300: '#93c5fd',
  brand200: '#bfdbfe',
  brand100: '#dbe8fe',
  brand50: '#eff5ff',
  ink: '#0f1f3d',
  inkSoft: '#2c3e60',
  muted: '#5a6a88',
  faint: '#8592ab',
  line: '#dce4ef',
  branco: '#ffffff',
};

export const MARGEM_X = 40;
/** Altura da faixa azul do topo da primeira página. */
export const ALTURA_FAIXA = 132;
/** Largura útil da página A4 retrato com as margens laterais. */
export const LARGURA_UTIL = 515.28;

/** Página, fonte e estilos compartilhados pelos documentos. */
export const BASE_DOCUMENTO = {
  pageSize: 'A4',
  pageMargins: [MARGEM_X, 54, MARGEM_X, 50],
  defaultStyle: { font: 'Roboto', fontSize: 9, color: COR.ink, lineHeight: 1.2 },
  styles: {
    secao: { fontSize: 12, bold: true, color: COR.brand900 },
    rotulo: { fontSize: 7.5, bold: true, color: COR.muted, characterSpacing: 0.4 },
    cabecalhoTabela: { fontSize: 7.5, bold: true, color: COR.brand900, characterSpacing: 0.3 },
  },
} satisfies Partial<TDocumentDefinitions>;

export const formatoGeracao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** "19/11/2026 às 14:30". */
export const descreverGeracao = (data: Date) => formatoGeracao.format(data).replace(', ', ' às ');

type PdfMake = typeof import('pdfmake/build/pdfmake');

let pdfMake: Promise<PdfMake> | null = null;
let logo: Promise<string | null> | null = null;

export function carregarPdfMake(): Promise<PdfMake> {
  pdfMake ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
    .then(([modulo, fontes]) => {
      // Os dois pacotes são CommonJS: dependendo do empacotamento o conteúdo vem em `default`.
      const instancia = ('default' in modulo ? modulo.default : modulo) as PdfMake;
      instancia.addVirtualFileSystem('default' in fontes ? fontes.default : fontes);
      return instancia;
    })
    .catch((erro) => {
      pdfMake = null;
      throw erro;
    });
  return pdfMake;
}

/** Logo (PNG branco com transparência) como data URL; `null` se não puder ser carregada. */
export function carregarLogo(): Promise<string | null> {
  logo ??= fetch('/image.png')
    .then((resposta) =>
      resposta.ok ? resposta.blob() : Promise.reject(new Error(String(resposta.status))),
    )
    .then(
      (blob) =>
        new Promise<string>((resolver, rejeitar) => {
          const leitor = new FileReader();
          leitor.onload = () => resolver(leitor.result as string);
          leitor.onerror = () => rejeitar(leitor.error);
          leitor.readAsDataURL(blob);
        }),
    )
    .catch(() => {
      logo = null;
      return null;
    });
  return logo;
}

/** Gera o PDF a partir da definição montada com a logo já carregada. */
export async function gerarPdf(
  montar: (imagemLogo: string | null) => TDocumentDefinitions,
): Promise<Blob> {
  const [pdf, imagemLogo] = await Promise.all([carregarPdfMake(), carregarLogo()]);
  return pdf.createPdf(montar(imagemLogo)).getBlob();
}

// ----- Blocos de layout -----

/** Fundo da primeira página: a faixa azul do topo. */
export const fundoFaixa: TDocumentDefinitions['background'] = (pagina, tamanho) =>
  pagina === 1
    ? { canvas: [{ type: 'rect', x: 0, y: 0, w: tamanho.width, h: ALTURA_FAIXA, color: COR.brand950 }] }
    : null;

/** Cabeçalho das páginas 2+: título à esquerda, contexto à direita. */
export const cabecalhoPaginas =
  (esquerda: string, direita: string): TDocumentDefinitions['header'] =>
  (pagina) =>
    pagina === 1
      ? null
      : {
          margin: [MARGEM_X, 22, MARGEM_X, 0],
          stack: [
            {
              columns: [
                { text: esquerda, bold: true, color: COR.brand800, fontSize: 8 },
                { text: direita, alignment: 'right', color: COR.muted, fontSize: 8 },
              ],
            },
            linha(COR.brand200, 4),
          ],
        };

/** Rodapé com "Gerado em …" e a paginação. */
export const rodapePaginas =
  (quando: string): TDocumentDefinitions['footer'] =>
  (pagina, total) => ({
    margin: [MARGEM_X, 14, MARGEM_X, 0],
    stack: [
      linha(COR.line, 0),
      {
        margin: [0, 6, 0, 0],
        fontSize: 7.5,
        color: COR.faint,
        columns: [
          { text: `Gerado em ${quando}` },
          { text: `Página ${pagina} de ${total}`, alignment: 'right' },
        ],
      },
    ],
  });

/** Conteúdo sobre a faixa azul da primeira página: logo, sobrelinha, título, subtítulo e emissão. */
export function faixaTitulo(opcoes: {
  sobrelinha: string;
  titulo: string;
  subtitulo: string | null;
  quando: string;
  imagemLogo: string | null;
}): Content {
  const { sobrelinha, titulo, subtitulo, quando, imagemLogo } = opcoes;
  return {
    margin: [0, -22, 0, 0],
    // Altura fixa para o conteúdo seguinte começar sempre abaixo da faixa.
    table: {
      widths: [imagemLogo ? 104 : 0, '*'],
      heights: [ALTURA_FAIXA - 54 + 22 - 8],
      body: [
        [
          imagemLogo ? { image: imagemLogo, fit: [96, 60], margin: [0, 2, 0, 0] } : { text: '' },
          {
            margin: [12, 0, 0, 0],
            stack: [
              { text: sobrelinha, fontSize: 7.5, bold: true, color: COR.brand300, characterSpacing: 1 },
              { text: titulo, fontSize: 18, bold: true, color: COR.branco, margin: [0, 4, 0, 0] },
              subtitulo
                ? { text: subtitulo, fontSize: 9.5, color: COR.brand200, margin: [0, 3, 0, 0] }
                : { text: '' },
              { text: `Emitido em ${quando}`, fontSize: 8, color: COR.brand300, margin: [0, 6, 0, 0] },
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
}

/** Fileira de cartões azul-claro (rótulo, valor grande, detalhe). */
export function cartoesResumo(cartoes: Array<[rotulo: string, valor: string, detalhe: string]>): Content {
  return {
    table: {
      widths: cartoes.map(() => '*'),
      body: [
        cartoes.map(([rotulo, valor, detalhe]) => ({
          fillColor: COR.brand50,
          stack: [
            { text: rotulo, style: 'rotulo' },
            { text: valor, fontSize: 16, bold: true, color: COR.brand800, margin: [0, 3, 0, 1] },
            { text: detalhe, fontSize: 7.5, color: COR.muted },
          ],
        })),
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i, no) => (i === 0 || i === no.table.widths!.length ? 0 : 6),
      vLineColor: () => COR.branco,
      paddingLeft: () => 9,
      paddingRight: () => 9,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
  };
}

export const layoutSemBordas: CustomTableLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 12,
};

/** Tabela zebrada; as `cabecalhos` primeiras linhas ficam com fundo azul claro (a barra do grupo tem fundo próprio). */
export function layoutTabela(cabecalhos: number): CustomTableLayout {
  return {
    hLineWidth: (i, no) => (i === 0 || i === no.table.body.length ? 0.8 : 0.5),
    vLineWidth: () => 0,
    hLineColor: (i) => (i <= cabecalhos ? COR.brand200 : COR.line),
    fillColor: (linha) =>
      linha === cabecalhos - 1
        ? COR.brand100
        : linha >= cabecalhos && (linha - cabecalhos) % 2 === 1
          ? COR.brand50
          : null,
    paddingLeft: () => 7,
    paddingRight: () => 7,
    paddingTop: () => 5,
    paddingBottom: () => 5,
  };
}

export function tituloSecao(texto: string, margemTopo = 0): ContentStack {
  return {
    margin: [0, margemTopo, 0, 8],
    stack: [{ text: texto, style: 'secao' }, linha(COR.brand600, 4, 36, 2)],
  };
}

export function linha(cor: string, margemTopo: number, largura = LARGURA_UTIL, espessura = 0.6): Content {
  return {
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: espessura, lineColor: cor },
    ],
    margin: [0, margemTopo, 0, 0],
  };
}

// ----- Abertura no navegador -----

/** Por quanto tempo a URL do PDF aberto continua válida (a aba já terá carregado). */
const VALIDADE_URL_PDF_MS = 60_000;

/**
 * Abre uma aba de espera ainda no clique, para não ser barrada pelo bloqueador de pop-ups.
 * Retorna `null` se o navegador bloquear.
 */
export function abrirAbaDeEspera(texto: string): Window | null {
  const janela = window.open('', '_blank');
  if (janela) {
    janela.document.title = texto;
    janela.document.body.textContent = texto;
    janela.document.body.style.cssText =
      'font: 14px system-ui, sans-serif; color: #2c3e60; padding: 24px';
  }
  return janela;
}

/**
 * Mostra o PDF na aba de espera; se ela foi bloqueada ou fechada, baixa o arquivo.
 * Retorna `true` quando precisou baixar.
 */
export function abrirPdf(janela: Window | null, blob: Blob, nomeArquivo: string): boolean {
  const url = URL.createObjectURL(blob);
  setTimeout(() => URL.revokeObjectURL(url), VALIDADE_URL_PDF_MS);
  if (janela && !janela.closed) {
    janela.location.href = url;
    return false;
  }
  baixarArquivo(url, nomeArquivo);
  return true;
}

export function baixarArquivo(url: string, nome: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
}

/** "Gestão de Frotas" → "gestao-de-frotas" (para nomes de arquivo). */
export const slug = (texto: string) =>
  normalizarBusca(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
