import { normalizarBusca } from '../../core/dominio';
import type { SistemaComResumo } from '../../core/models';

export type OrdemSistemas =
  | 'favoritos'
  | 'personalizada'
  | 'nome'
  | 'recentes'
  | 'maior-atendimento'
  | 'menor-atendimento'
  | 'apresentacao';

/** A listagem de Sistemas e a página Favoritos lembram a ordenação separadamente. */
export type PaginaSistemas = 'sistemas' | 'favoritos';

const ORDENS: ReadonlyArray<{ valor: OrdemSistemas; rotulo: string }> = [
  { valor: 'favoritos', rotulo: 'Favoritos primeiro' },
  { valor: 'personalizada', rotulo: 'Ordem personalizada' },
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'recentes', rotulo: 'Mais recentes' },
  { valor: 'maior-atendimento', rotulo: 'Maior atendimento' },
  { valor: 'menor-atendimento', rotulo: 'Menor atendimento' },
  { valor: 'apresentacao', rotulo: 'Data da apresentação' },
];

/**
 * Em Favoritos todos já são favoritos ("Favoritos primeiro" não faz sentido) e a ordem personalizada é a
 * pessoal do usuário, por isso vem primeiro e com outro nome.
 */
export const ORDENS_POR_PAGINA: Record<PaginaSistemas, ReadonlyArray<{ valor: OrdemSistemas; rotulo: string }>> = {
  sistemas: ORDENS,
  favoritos: [
    { valor: 'personalizada', rotulo: 'Minha ordem' },
    ...ORDENS.filter((o) => o.valor !== 'favoritos' && o.valor !== 'personalizada'),
  ],
};

const PADRAO: Record<PaginaSistemas, OrdemSistemas> = { sistemas: 'favoritos', favoritos: 'personalizada' };
const CHAVE: Record<PaginaSistemas, string> = { sistemas: 'sistemas.ordem', favoritos: 'favoritos.ordem' };

type Comparador = (a: SistemaComResumo, b: SistemaComResumo) => number;

const porNome: Comparador = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true });

/** Sistemas sem itens não têm percentual de verdade: ficam sempre no fim nas ordens por atendimento. */
const porAtendimento =
  (sentido: 1 | -1): Comparador =>
  (a, b) => {
    const semItens = Number(a.resumo.totalItens === 0) - Number(b.resumo.totalItens === 0);
    return (
      semItens ||
      sentido * (a.resumo.essenciais.percentual - b.resumo.essenciais.percentual) ||
      porNome(a, b)
    );
  };

/** Posição usada pela ordem personalizada: a geral nos Sistemas, a pessoal em Favoritos. */
export const posicaoNaOrdem = (sistema: SistemaComResumo, pagina: PaginaSistemas) =>
  pagina === 'favoritos' ? (sistema.ordemFavorito ?? Number.MAX_SAFE_INTEGER) : sistema.ordem;

const COMPARADORES: Record<Exclude<OrdemSistemas, 'favoritos' | 'personalizada'>, Comparador> = {
  nome: porNome,
  recentes: (a, b) => b.criadoEm.localeCompare(a.criadoEm) || porNome(a, b),
  'maior-atendimento': porAtendimento(-1),
  'menor-atendimento': porAtendimento(1),
  // Sem data definida vai para o fim.
  apresentacao: (a, b) =>
    (a.dataApresentacao ?? '9999').localeCompare(b.dataApresentacao ?? '9999') || porNome(a, b),
};

/**
 * "Favoritos primeiro" mantém a ordem da API (favoritos e depois os mais recentes) e não reordena
 * ao clicar no coração, para o card não mudar de lugar debaixo do cursor.
 */
export function ordenarSistemas(
  lista: SistemaComResumo[],
  ordem: OrdemSistemas,
  pagina: PaginaSistemas,
): SistemaComResumo[] {
  if (ordem === 'favoritos') return lista;
  // Definida arrastando os cards; empate (não deveria acontecer) desempata pelo nome.
  const comparar: Comparador =
    ordem === 'personalizada'
      ? (a, b) => posicaoNaOrdem(a, pagina) - posicaoNaOrdem(b, pagina) || porNome(a, b)
      : COMPARADORES[ordem];
  return [...lista].sort(comparar);
}

/** Cada palavra da busca precisa aparecer em algum dos campos do card (sem diferenciar acentos). */
export function filtrarSistemas(lista: SistemaComResumo[], busca: string): SistemaComResumo[] {
  const termos = normalizarBusca(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) return lista;
  return lista.filter((s) => {
    const texto = normalizarBusca(
      [s.nome, s.versao && `v${s.versao}`, s.numero, s.orgao, s.descricao, s.objeto, s.cidade].filter(Boolean).join(' '),
    );
    return termos.every((termo) => texto.includes(termo));
  });
}

/** Preferência do navegador; o armazenamento pode estar bloqueado, então tudo cai no padrão. */
export function lerOrdemSalva(pagina: PaginaSistemas): OrdemSistemas {
  try {
    const valor = localStorage.getItem(CHAVE[pagina]);
    return ORDENS_POR_PAGINA[pagina].find((o) => o.valor === valor)?.valor ?? PADRAO[pagina];
  } catch {
    return PADRAO[pagina];
  }
}

export function salvarOrdem(pagina: PaginaSistemas, ordem: OrdemSistemas): void {
  try {
    localStorage.setItem(CHAVE[pagina], ordem);
  } catch {
    // sem armazenamento: a escolha vale só até sair da página
  }
}
