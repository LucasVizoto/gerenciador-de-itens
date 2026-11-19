/**
 * Cores dos gráficos por tema. Os status espelham os tokens --color-atende / --color-nao-atende /
 * --color-pendente do styles.css (o canvas do ECharts não lê variáveis CSS).
 * Atende × Não atende foram validados para daltonismo (deuteranopia ΔE ≥ 10) nos dois temas.
 */
export interface CoresGrafico {
  atende: string;
  naoAtende: string;
  pendente: string;
  /** "Em avaliação" na rosca de situação. */
  avaliacao: string;
  marca: string;
  superficie: string;
  tinta: string;
  tintaSuave: string;
  apagado: string;
  linha: string;
}

const CLARO: CoresGrafico = {
  atende: '#16a34a',
  naoAtende: '#be123c',
  pendente: '#c2cfe1',
  avaliacao: '#d97706',
  marca: '#2563eb',
  superficie: '#ffffff',
  tinta: '#0f1f3d',
  tintaSuave: '#2c3e60',
  apagado: '#5a6a88',
  linha: '#dce4ef',
};

const ESCURO: CoresGrafico = {
  atende: '#12a874',
  naoAtende: '#c41a42',
  pendente: '#2a3f6a',
  avaliacao: '#c98500',
  marca: '#4f8ff7',
  superficie: '#0d1730',
  tinta: '#e6edf9',
  tintaSuave: '#c2cee4',
  apagado: '#8696b8',
  linha: '#1c2c4f',
};

export const coresDoTema = (escuro: boolean): CoresGrafico => (escuro ? ESCURO : CLARO);
