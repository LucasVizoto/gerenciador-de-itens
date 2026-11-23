import type { Content, ContentTable, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { plural } from '../../core/dominio';
import type { Apresentacao, PessoaResumo } from '../../core/models';
import {
  BASE_DOCUMENTO,
  COR,
  MARGEM_X,
  cabecalhoPaginas,
  cartoesResumo,
  descreverGeracao,
  faixaTitulo,
  fundoFaixa,
  gerarPdf,
  linha,
  tituloSecao,
} from '../../core/pdf';
import {
  type DiaAgenda,
  descreverPeriodo,
  duracao,
  faixaHorario,
  formatarDuracao,
  formatarHorario,
  minutos,
} from './agenda-util';

/**
 * Roteiro de apresentações em PDF, no estilo "run of show": uma tabela por dia com a barra do dia,
 * faixas dos blocos temáticos, apresentações numeradas, intervalos entre elas e uma caixinha para
 * marcar à mão o que já foi apresentado.
 */

export interface DadosRoteiro {
  /** Dias já agrupados e ordenados, como aparecem na tela (respeitam a visão atual). */
  dias: DiaAgenda[];
  visao: 'geral' | 'minhas';
  /** Usuário logado: na visão "minhas" dá nome ao roteiro e destaca o papel dele. */
  usuario: PessoaResumo | null;
}

export type LinhaRoteiro =
  | { tipo: 'tema'; tema: string }
  | { tipo: 'intervalo'; minutos: number }
  | { tipo: 'apresentacao'; apresentacao: Apresentacao };

export function gerarRoteiroPdf(dados: DadosRoteiro): Promise<Blob> {
  return gerarPdf((imagemLogo) => montarRoteiro(dados, imagemLogo, new Date()));
}

/**
 * Linhas da tabela de um dia, na ordem: a faixa do bloco temático sempre que o tema muda,
 * um intervalo quando há folga desde o fim da última apresentação, e a apresentação.
 */
export function linhasDoDia(dia: DiaAgenda): LinhaRoteiro[] {
  const linhas: LinhaRoteiro[] = [];
  let temaAtual: string | null = null;
  let fimAnterior: number | null = null;
  for (const apresentacao of dia.apresentacoes) {
    const inicio = minutos(apresentacao.inicio);
    if (fimAnterior !== null && inicio > fimAnterior) {
      linhas.push({ tipo: 'intervalo', minutos: inicio - fimAnterior });
    }
    const tema = apresentacao.tema?.trim() || null;
    if (tema && tema !== temaAtual) linhas.push({ tipo: 'tema', tema });
    temaAtual = tema;
    linhas.push({ tipo: 'apresentacao', apresentacao });
    // Com sobreposição, o próximo intervalo conta a partir de quem termina por último.
    fimAnterior = Math.max(fimAnterior ?? 0, minutos(apresentacao.fim));
  }
  return linhas;
}

// ----- Documento -----

/** Colunas: Nº, horário, sistema, apresentador, apoio, marcação. */
const LARGURAS = [18, 58, '*', 92, 92, 14];
const COLUNAS = LARGURAS.length;

export function montarRoteiro(dados: DadosRoteiro, imagemLogo: string | null, geradoEm: Date): TDocumentDefinitions {
  const { dias, visao, usuario } = dados;
  const minhas = visao === 'minhas' && !!usuario;
  const apresentacoes = dias.flatMap((d) => d.apresentacoes);
  const periodo = dias.length ? descreverPeriodo(dias[0].chave, dias[dias.length - 1].chave) : null;
  const quando = descreverGeracao(geradoEm);
  const titulo = minhas ? `Roteiro de ${usuario.nomeCompleto}` : 'Agenda de apresentações';
  const subtitulo = [
    periodo,
    plural(dias.length, 'dia', 'dias'),
    plural(apresentacoes.length, 'apresentação', 'apresentações'),
  ]
    .filter(Boolean)
    .join(' · ');

  let numero = 0;
  const proximoNumero = () => String(++numero).padStart(2, '0');
  const destacar = minhas ? usuario.id : null;

  return {
    ...BASE_DOCUMENTO,
    info: {
      title: `Roteiro de apresentações${minhas ? ` · ${usuario.nomeCompleto}` : ''}${periodo ? ` · ${periodo}` : ''}`,
      author: 'Eddydata',
      subject: 'Agenda de apresentações',
    },
    background: fundoFaixa,
    header: cabecalhoPaginas(minhas ? titulo : 'Roteiro de apresentações', periodo ?? ''),
    footer: (pagina, total) => rodape(quando, pagina, total),

    content: [
      faixaTitulo({ sobrelinha: 'ROTEIRO DE APRESENTAÇÕES', titulo, subtitulo, quando, imagemLogo }),
      secaoResumo(dias, apresentacoes, minhas ? usuario : null),
      tituloSecao('Roteiro por dia', 20),
      ...(dias.length
        ? dias.map((dia) => tabelaDia(dia, proximoNumero, destacar))
        : [{ text: 'Nenhuma apresentação na agenda.', color: COR.muted, italics: true } as Content]),
    ],
  };
}

/** Rodapé como o do relatório de conformidade, com a legenda da coluna de marcação. */
function rodape(quando: string, pagina: number, total: number): Content {
  return {
    margin: [MARGEM_X, 14, MARGEM_X, 0],
    stack: [
      linha(COR.line, 0),
      {
        margin: [0, 6, 0, 0],
        fontSize: 7.5,
        color: COR.faint,
        columns: [
          { text: `Gerado em ${quando}`, width: '*' },
          { text: 'Marque a caixa ao concluir cada apresentação', alignment: 'center', width: 'auto' },
          { text: `Página ${pagina} de ${total}`, alignment: 'right', width: '*' },
        ],
      },
    ],
  };
}

function secaoResumo(dias: DiaAgenda[], apresentacoes: Apresentacao[], usuario: PessoaResumo | null): Content {
  const totalMinutos = apresentacoes.reduce((soma, a) => soma + minutos(a.fim) - minutos(a.inicio), 0);
  const sistemas = new Set(apresentacoes.map((a) => a.sistemaId)).size;
  const intervaloDias =
    dias.length > 1 ? `${dias[0].data} a ${dias[dias.length - 1].data}` : (dias[0]?.data ?? '—');

  const cartoes: Array<[string, string, string]> = [
    ['DIAS', String(dias.length), intervaloDias],
    ['APRESENTAÇÕES', String(apresentacoes.length), plural(sistemas, 'sistema', 'sistemas')],
    [
      'TEMPO DE APRESENTAÇÃO',
      totalMinutos ? formatarDuracao(totalMinutos) : '—',
      apresentacoes.length ? `média de ${formatarDuracao(Math.round(totalMinutos / apresentacoes.length))}` : 'sem horários',
    ],
  ];

  if (usuario) {
    const apresenta = apresentacoes.filter((a) => a.apresentadorId === usuario.id).length;
    const apoia = apresentacoes.filter((a) => a.apoioId === usuario.id).length;
    cartoes.push(['VOCÊ APRESENTA', String(apresenta), `e dá apoio em ${apoia}`]);
  } else {
    const apresentadores = new Set(apresentacoes.map((a) => a.apresentadorId).filter(Boolean));
    const apoios = new Set(apresentacoes.map((a) => a.apoioId).filter(Boolean));
    const equipe = new Set([...apresentadores, ...apoios]).size;
    cartoes.push([
      'EQUIPE',
      String(equipe),
      `${plural(apresentadores.size, 'apresentador', 'apresentadores')} · ${apoios.size} no apoio`,
    ]);
  }

  return { margin: [0, 18, 0, 0], stack: [cartoesResumo(cartoes)] };
}

function tabelaDia(dia: DiaAgenda, proximoNumero: () => string, destacar: string | null): ContentTable {
  const inicio = dia.apresentacoes[0]?.inicio;
  const fim = dia.apresentacoes.reduce((maior, a) => (a.fim > maior ? a.fim : maior), inicio ?? '00:00');
  const vazio = (n: number): TableCell[] => Array.from({ length: n }, () => ({ text: '' }));

  const barra: TableCell[] = [
    {
      colSpan: COLUNAS,
      fillColor: COR.brand800,
      margin: [3, 3, 3, 3],
      columns: [
        {
          width: '*',
          text: [
            { text: dia.semana, bold: true, color: COR.branco, fontSize: 10.5 },
            { text: ` · ${dia.data}`, color: COR.brand200, fontSize: 10.5 },
          ],
        },
        {
          width: 'auto',
          alignment: 'right',
          fontSize: 8,
          color: COR.brand200,
          margin: [0, 2, 0, 0],
          text: [
            inicio ? `${formatarHorario(inicio)}–${formatarHorario(fim)} · ` : '',
            plural(dia.apresentacoes.length, 'apresentação', 'apresentações'),
          ].join(''),
        },
      ],
    },
    ...vazio(COLUNAS - 1),
  ];

  const cabecalho: TableCell[] = [
    { text: 'Nº', style: 'cabecalhoTabela' },
    { text: 'HORÁRIO', style: 'cabecalhoTabela' },
    { text: 'SISTEMA', style: 'cabecalhoTabela' },
    { text: 'APRESENTADOR', style: 'cabecalhoTabela' },
    { text: 'APOIO', style: 'cabecalhoTabela' },
    { text: '' },
  ];

  const linhas = linhasDoDia(dia);
  const corpo: TableCell[][] = linhas.map((item): TableCell[] => {
    switch (item.tipo) {
      case 'tema':
        return [
          {
            colSpan: COLUNAS,
            text: item.tema.toUpperCase(),
            fontSize: 7.5,
            bold: true,
            color: COR.brand800,
            characterSpacing: 0.4,
            fillColor: COR.brand50,
          },
          ...vazio(COLUNAS - 1),
        ];
      case 'intervalo':
        return [
          { text: '' },
          {
            colSpan: COLUNAS - 1,
            text: `Intervalo · ${formatarDuracao(item.minutos)}`,
            italics: true,
            fontSize: 7.5,
            color: COR.faint,
          },
          ...vazio(COLUNAS - 2),
        ];
      case 'apresentacao':
        return linhaApresentacao(item.apresentacao, proximoNumero(), destacar);
    }
  });

  return {
    margin: [0, 10, 0, 6],
    table: {
      headerRows: 2,
      // A barra do dia não fica sozinha no pé da página: vai junto até a primeira apresentação (com a faixa do tema).
      keepWithHeaderRows: linhas.findIndex((l) => l.tipo === 'apresentacao') + 1,
      dontBreakRows: true,
      widths: LARGURAS,
      body: [barra, cabecalho, ...corpo],
    },
    layout: layoutRoteiro,
  };
}

function linhaApresentacao(apresentacao: Apresentacao, numero: string, destacar: string | null): TableCell[] {
  const { sistema, complemento } = apresentacao;
  const papel = destacar ? papelDe(apresentacao, destacar) : null;
  return [
    { text: numero, bold: true, color: COR.brand600, margin: [0, 1, 0, 0] },
    {
      stack: [
        { text: faixaHorario(apresentacao), bold: true, color: COR.ink, noWrap: true },
        { text: duracao(apresentacao), fontSize: 7.5, color: COR.muted },
      ],
    },
    {
      // Só as linhas que existem: um `{ text: '' }` ainda ocuparia a altura de uma linha.
      stack: [
        { text: sistema.nome + (sistema.versao ? ` · v${sistema.versao}` : ''), bold: true, color: COR.ink },
        ...(complemento ? [{ text: complemento, fontSize: 7.5, color: COR.brand800, margin: [0, 1, 0, 0] }] : []),
        ...(papel ? [{ text: papel, fontSize: 7, bold: true, color: COR.brand600, margin: [0, 1, 0, 0] }] : []),
      ] as Content[],
    },
    celulaPessoa(apresentacao.apresentador, destacar),
    celulaPessoa(apresentacao.apoio, destacar),
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 9, h: 9, r: 1.5, lineWidth: 0.8, lineColor: COR.faint }],
      margin: [2.5, 2, 0, 0],
    },
  ];
}

function celulaPessoa(pessoa: PessoaResumo | null, destacar: string | null): TableCell {
  if (!pessoa) return { text: '—', color: COR.faint };
  const eu = pessoa.id === destacar;
  return { text: pessoa.nomeCompleto, color: eu ? COR.brand800 : COR.inkSoft, bold: eu };
}

function papelDe(apresentacao: Apresentacao, id: string): string | null {
  const apresenta = apresentacao.apresentadorId === id;
  const apoia = apresentacao.apoioId === id;
  if (apresenta && apoia) return 'VOCÊ APRESENTA E DÁ APOIO';
  if (apresenta) return 'VOCÊ APRESENTA';
  if (apoia) return 'VOCÊ DÁ APOIO';
  return null;
}

/** Linhas finas entre as apresentações; o cabeçalho das colunas em azul claro, sem zebra (as faixas de tema têm fundo próprio). */
const layoutRoteiro: CustomTableLayout = {
  hLineWidth: (i, no) => (i === 0 || i === no.table.body.length ? 0.8 : 0.5),
  vLineWidth: () => 0,
  hLineColor: (i) => (i <= 2 ? COR.brand200 : COR.line),
  fillColor: (indice) => (indice === 1 ? COR.brand100 : null),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 5,
  paddingBottom: () => 5,
};
