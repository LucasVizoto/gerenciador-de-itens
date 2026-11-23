import type {
  Content,
  ContentStack,
  ContentTable,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import {
  STATUS,
  TIPOS,
  formatarData,
  formatarPercentual,
  plural,
  rotuloItem,
} from '../../core/dominio';
import type { Categoria, Item, Resumo, Sistema, StatusItem } from '../../core/models';
import type { Situacao } from './painel-meta';

/**
 * Relatório de conformidade em PDF, gerado no navegador com pdfmake.
 * O pdfmake (~1 MB com as fontes) é carregado sob demanda para não pesar no bundle inicial.
 */

export interface DadosRelatorio {
  sistema: Sistema;
  categorias: Categoria[];
  /** Itens por grupo, já ordenados; a chave `null` reúne os itens sem grupo. */
  listas: ReadonlyMap<string | null, Item[]>;
  resumo: Resumo;
  meta: number;
  situacao: { situacao: Situacao; texto: string };
  /** Quem assina esta via do relatório; `null` = linha de assinatura sem nome. */
  responsavel: string | null;
}

/** Mesma escala de azul da marca de `styles.css`. */
const COR = {
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

const COR_STATUS: Record<StatusItem, { texto: string; fundo: string | undefined }> = {
  ATENDE: { texto: '#047857', fundo: '#ecfdf5' },
  NAO_ATENDE: { texto: '#be123c', fundo: '#fff1f2' },
  PENDENTE: { texto: COR.muted, fundo: undefined },
};

const COR_SITUACAO: Record<Situacao, { texto: string; fundo: string; borda: string }> = {
  atingida: { texto: '#065f46', fundo: '#ecfdf5', borda: '#a7f3d0' },
  inalcancavel: { texto: '#9f1239', fundo: '#fff1f2', borda: '#fecdd3' },
  andamento: { texto: COR.brand900, fundo: COR.brand50, borda: COR.brand200 },
  vazio: { texto: COR.muted, fundo: COR.brand50, borda: COR.line },
};

const MARGEM_X = 40;
const ALTURA_FAIXA = 132;

type PdfMake = typeof import('pdfmake/build/pdfmake');

let pdfMake: Promise<PdfMake> | null = null;
let logo: Promise<string | null> | null = null;

function carregarPdfMake(): Promise<PdfMake> {
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
function carregarLogo(): Promise<string | null> {
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

export async function gerarRelatorioPdf(dados: DadosRelatorio): Promise<Blob> {
  const [pdf, imagemLogo] = await Promise.all([carregarPdfMake(), carregarLogo()]);
  return pdf.createPdf(montarDocumento(dados, imagemLogo, new Date())).getBlob();
}

// ----- Documento -----

const formatoGeracao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
/** "19 de novembro de 2026" (data local do dia em que o relatório é gerado). */
const formatoDataExtenso = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function montarDocumento(
  dados: DadosRelatorio,
  imagemLogo: string | null,
  geradoEm: Date,
): TDocumentDefinitions {
  const { sistema } = dados;
  const nomeCompleto = sistema.nome + (sistema.versao ? ` · v${sistema.versao}` : '');
  const quando = formatoGeracao.format(geradoEm).replace(', ', ' às ');

  return {
    pageSize: 'A4',
    pageMargins: [MARGEM_X, 54, MARGEM_X, 50],
    info: {
      title: `Relatório de conformidade · ${nomeCompleto}${dados.responsavel ? ` · ${dados.responsavel}` : ''}`,
      author: 'Eddydata',
      subject: 'Itens do edital',
    },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: COR.ink, lineHeight: 1.2 },
    styles: {
      secao: { fontSize: 12, bold: true, color: COR.brand900 },
      rotulo: { fontSize: 7.5, bold: true, color: COR.muted, characterSpacing: 0.4 },
      cabecalhoTabela: { fontSize: 7.5, bold: true, color: COR.brand900, characterSpacing: 0.3 },
    },

    background: (pagina, tamanho) =>
      pagina === 1
        ? {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: tamanho.width, h: ALTURA_FAIXA, color: COR.brand950 },
            ],
          }
        : null,

    header: (pagina) =>
      pagina === 1
        ? null
        : {
            margin: [MARGEM_X, 22, MARGEM_X, 0],
            stack: [
              {
                columns: [
                  { text: nomeCompleto, bold: true, color: COR.brand800, fontSize: 8 },
                  {
                    text: 'Relatório de conformidade do edital',
                    alignment: 'right',
                    color: COR.muted,
                    fontSize: 8,
                  },
                ],
              },
              linha(COR.brand200, 4),
            ],
          },

    footer: (pagina, total) => ({
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
    }),

    content: [
      faixaTitulo(sistema, nomeCompleto, imagemLogo, quando),
      secaoInformacoes(sistema, nomeCompleto, dados.responsavel),
      secaoResumo(dados),
      secaoVisaoGrupos(dados),
      ...secaoItens(dados),
      secaoAssinatura(sistema, dados.responsavel, geradoEm),
    ],
  };
}

/** Conteúdo sobre a faixa azul da primeira página. */
function faixaTitulo(
  sistema: Sistema,
  nomeCompleto: string,
  imagemLogo: string | null,
  quando: string,
): Content {
  const subtitulo = [sistema.numero ? `Edital ${sistema.numero}` : null, sistema.orgao]
    .filter(Boolean)
    .join(' · ');
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
              {
                text: 'RELATÓRIO DE CONFORMIDADE DO EDITAL',
                fontSize: 7.5,
                bold: true,
                color: COR.brand300,
                characterSpacing: 1,
              },
              {
                text: nomeCompleto,
                fontSize: 18,
                bold: true,
                color: COR.branco,
                margin: [0, 4, 0, 0],
              },
              subtitulo
                ? { text: subtitulo, fontSize: 9.5, color: COR.brand200, margin: [0, 3, 0, 0] }
                : { text: '' },
              {
                text: `Emitido em ${quando}`,
                fontSize: 8,
                color: COR.brand300,
                margin: [0, 6, 0, 0],
              },
            ],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
}

function secaoInformacoes(
  sistema: Sistema,
  nomeCompleto: string,
  responsavel: string | null,
): Content {
  const campos: Array<[string, string | null]> = [
    ['SISTEMA', nomeCompleto],
    ['Nº DO EDITAL', sistema.numero],
    ['ÓRGÃO', sistema.orgao],
    ['CIDADE', sistema.cidade],
    [
      'DATA DA APRESENTAÇÃO',
      sistema.dataApresentacao ? formatarData(sistema.dataApresentacao) : null,
    ],
    ['META DE ATENDIMENTO', `${sistema.metaPercentual}% dos itens essenciais`],
    ['RESPONSÁVEL', responsavel],
  ];
  const preenchidos = campos.filter((c): c is [string, string] => !!c[1]);

  const corpo: TableCell[][] = [];
  for (let i = 0; i < preenchidos.length; i += 2) {
    const [a, b] = [preenchidos[i], preenchidos[i + 1]];
    corpo.push([campo(a[0], a[1]), b ? campo(b[0], b[1]) : { text: '' }]);
  }
  for (const [titulo, valor] of [
    ['OBJETO', sistema.objeto],
    ['DESCRIÇÃO', sistema.descricao],
  ] as const) {
    if (valor?.trim()) corpo.push([{ ...campo(titulo, valor.trim()), colSpan: 2 }, { text: '' }]);
  }

  return {
    margin: [0, 18, 0, 0],
    stack: [
      tituloSecao('Informações do sistema'),
      {
        table: { widths: ['*', '*'], body: corpo },
        layout: {
          ...layoutSemBordas,
          hLineWidth: (i, no) => (i === 0 || i === no.table.body.length ? 0 : 0.6),
          hLineColor: () => COR.line,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
    ],
  };
}

function secaoResumo({ resumo, meta, situacao, listas }: DadosRelatorio): Content {
  const todos = [...listas.values()].flat();
  const contar = (status: StatusItem) => todos.filter((i) => i.status === status).length;
  const { essenciais, obrigatorios } = resumo;

  const cartoes: Array<[string, string, string]> = [
    [
      'ESSENCIAIS ATENDIDOS',
      `${essenciais.atendidos} de ${essenciais.total}`,
      essenciais.total
        ? `${formatarPercentual(essenciais.percentual)} · mínimo ${essenciais.minimo} (${meta}%)`
        : 'Nenhum item essencial',
    ],
    [
      'OBRIGATÓRIOS ATENDIDOS',
      `${obrigatorios.atendidos} de ${obrigatorios.total}`,
      obrigatorios.total
        ? `${formatarPercentual(obrigatorios.percentual)} · exigido 100%`
        : 'Nenhum item obrigatório',
    ],
    ['NÃO ATENDE', String(contar('NAO_ATENDE')), 'itens de todos os tipos'],
    [
      'PENDENTES',
      String(contar('PENDENTE')),
      `de ${plural(todos.length, 'item', 'itens')} no total`,
    ],
  ];

  const cor = COR_SITUACAO[situacao.situacao];
  return {
    margin: [0, 20, 0, 0],
    stack: [
      tituloSecao('Resumo da avaliação'),
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            cartoes.map(([rotulo, valor, detalhe]) => ({
              fillColor: COR.brand50,
              stack: [
                { text: rotulo, style: 'rotulo' },
                {
                  text: valor,
                  fontSize: 16,
                  bold: true,
                  color: COR.brand800,
                  margin: [0, 3, 0, 1],
                },
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
      },
      {
        margin: [0, 8, 0, 0],
        table: {
          widths: ['*'],
          body: [[{ text: situacao.texto, bold: true, color: cor.texto, fillColor: cor.fundo }]],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => cor.borda,
          vLineColor: () => cor.borda,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 7,
          paddingBottom: () => 7,
        },
      },
    ],
  };
}

interface GrupoRelatorio {
  numero: number | null;
  titulo: string;
  itens: Item[];
}

function gruposDoRelatorio({ categorias, listas }: DadosRelatorio): GrupoRelatorio[] {
  const grupos: GrupoRelatorio[] = categorias.map((c, i) => ({
    numero: i + 1,
    titulo: c.nome,
    itens: listas.get(c.id) ?? [],
  }));
  const semGrupo = listas.get(null) ?? [];
  if (semGrupo.length) grupos.push({ numero: null, titulo: 'Sem grupo', itens: semGrupo });
  return grupos;
}

const tituloGrupo = (g: GrupoRelatorio) => (g.numero ? `${g.numero} · ${g.titulo}` : g.titulo);

function secaoVisaoGrupos(dados: DadosRelatorio): Content {
  const grupos = gruposDoRelatorio(dados);
  if (!grupos.length) return { text: '' };

  const contar = (itens: Item[], status: StatusItem) =>
    itens.filter((i) => i.status === status).length;
  const numero = (valor: number, cor?: string): TableCell => ({
    text: String(valor),
    alignment: 'center',
    color: cor,
  });

  return {
    margin: [0, 20, 0, 0],
    stack: [
      tituloSecao('Grupos da apresentação'),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*', 44, 50, 56, 50],
          body: [
            [
              { text: 'GRUPO', style: 'cabecalhoTabela' },
              { text: 'ITENS', style: 'cabecalhoTabela', alignment: 'center' },
              { text: 'ATENDE', style: 'cabecalhoTabela', alignment: 'center' },
              { text: 'NÃO ATENDE', style: 'cabecalhoTabela', alignment: 'center' },
              { text: 'PENDENTE', style: 'cabecalhoTabela', alignment: 'center' },
            ],
            ...grupos.map((g) => [
              { text: tituloGrupo(g), bold: true, color: COR.inkSoft },
              numero(g.itens.length),
              numero(contar(g.itens, 'ATENDE'), COR_STATUS.ATENDE.texto),
              numero(contar(g.itens, 'NAO_ATENDE'), COR_STATUS.NAO_ATENDE.texto),
              numero(contar(g.itens, 'PENDENTE'), COR.muted),
            ]),
          ],
        },
        layout: layoutTabela(1),
      },
    ],
  };
}

function secaoItens(dados: DadosRelatorio): Content[] {
  const grupos = gruposDoRelatorio(dados);
  if (!grupos.length) {
    return [
      tituloSecao('Itens do edital', 20),
      { text: 'Nenhum item cadastrado neste sistema.', color: COR.muted, italics: true },
    ];
  }
  return [
    { ...tituloSecao('Itens do edital por grupo'), pageBreak: 'before' },
    ...grupos.map((g) => tabelaGrupo(g)),
  ];
}

function tabelaGrupo(grupo: GrupoRelatorio): ContentTable {
  const atendidos = grupo.itens.filter((i) => i.status === 'ATENDE').length;
  const barra: TableCell[] = [
    {
      colSpan: 4,
      fillColor: COR.brand800,
      margin: [2, 2, 2, 2],
      columns: [
        { text: tituloGrupo(grupo), bold: true, fontSize: 10.5, color: COR.branco, width: '*' },
        {
          text: `${plural(grupo.itens.length, 'item', 'itens')} · ${atendidos}/${grupo.itens.length} atendidos`,
          alignment: 'right',
          fontSize: 8,
          color: COR.brand200,
          width: 'auto',
          margin: [0, 2, 0, 0],
        },
      ],
    },
    { text: '' },
    { text: '' },
    { text: '' },
  ];
  const cabecalho: TableCell[] = [
    { text: 'ITEM', style: 'cabecalhoTabela' },
    { text: 'REQUISITO', style: 'cabecalhoTabela' },
    { text: 'TIPO', style: 'cabecalhoTabela' },
    { text: 'STATUS', style: 'cabecalhoTabela', alignment: 'center' },
  ];

  const linhas: TableCell[][] = grupo.itens.map((item) => {
    const foraDoCalculo = item.tipo === 'COMPLEMENTAR' || item.tipo === 'DISPENSADO';
    const status = COR_STATUS[item.status];
    return [
      { text: rotuloItem(item.tipo, item.numero), bold: true, color: COR.brand800, noWrap: true },
      {
        stack: [
          { text: item.descricao, color: COR.ink },
        ],
      },
      {
        text: TIPOS[item.tipo].rotulo,
        fontSize: 8,
        color: foraDoCalculo ? COR.faint : COR.inkSoft,
      },
      {
        text: STATUS[item.status].rotulo,
        bold: true,
        fontSize: 8,
        alignment: 'center',
        color: status.texto,
        fillColor: status.fundo,
      },
    ];
  });
  if (!linhas.length) {
    linhas.push([
      {
        text: 'Nenhum item neste grupo.',
        colSpan: 4,
        italics: true,
        color: COR.faint,
        alignment: 'center',
      },
      { text: '' },
      { text: '' },
      { text: '' },
    ]);
  }

  return {
    margin: [0, 10, 0, 6],
    table: {
      headerRows: 2,
      keepWithHeaderRows: 1,
      dontBreakRows: true,
      widths: [58, '*', 70, 58],
      body: [barra, cabecalho, ...linhas],
    },
    layout: layoutTabela(2),
  };
}

// ----- Auxiliares -----

const layoutSemBordas: CustomTableLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 12,
};

/** Tabela zebrada; as `cabecalhos` primeiras linhas ficam com fundo azul claro (a barra do grupo tem fundo próprio). */
function layoutTabela(cabecalhos: number): CustomTableLayout {
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

function campo(rotulo: string, valor: string): ContentStack {
  return {
    stack: [
      { text: rotulo, style: 'rotulo' },
      { text: valor, fontSize: 10, color: COR.ink, margin: [0, 2, 0, 0] },
    ],
  };
}

function tituloSecao(texto: string, margemTopo = 0): ContentStack {
  return {
    margin: [0, margemTopo, 0, 8],
    stack: [{ text: texto, style: 'secao' }, linha(COR.brand600, 4, 36, 2)],
  };
}

/**
 * Campo de assinatura no fim do relatório: linha, nome do responsável e "Cidade, data do dia".
 * Fica inteiro numa página (não quebra entre a linha e o nome).
 */
function secaoAssinatura(sistema: Sistema, responsavel: string | null, geradoEm: Date): Content {
  const larguraLinha = 260;
  const local = [sistema.cidade?.trim(), formatoDataExtenso.format(geradoEm)]
    .filter(Boolean)
    .join(', ');
  return {
    unbreakable: true,
    margin: [0, 28, 0, 0],
    stack: [
      tituloSecao('Assinatura'),
      {
        margin: [0, 54, 0, 0],
        alignment: 'center',
        stack: [
          {
            canvas: [
              {
                type: 'line',
                x1: 0,
                y1: 0,
                x2: larguraLinha,
                y2: 0,
                lineWidth: 0.8,
                lineColor: COR.ink,
              },
            ],
            // Centraliza a linha na largura útil da página (515pt).
            margin: [(515.28 - larguraLinha) / 2, 0, 0, 0],
          },
          {
            text: responsavel ?? ' ',
            bold: true,
            fontSize: 10.5,
            color: COR.ink,
            margin: [0, 6, 0, 0],
          },
          { text: 'Responsável', fontSize: 8, color: COR.muted, margin: [0, 1, 0, 0] },
          { text: local, fontSize: 9, color: COR.inkSoft, margin: [0, 10, 0, 0] },
        ],
      },
    ],
  };
}

function linha(cor: string, margemTopo: number, largura = 515.28, espessura = 0.6): Content {
  return {
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: largura, y2: 0, lineWidth: espessura, lineColor: cor },
    ],
    margin: [0, margemTopo, 0, 0],
  };
}
