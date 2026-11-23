import type { Apresentacao } from '../../core/models';

/** Funções puras da agenda: horários no estilo do cronograma oficial ("10h30–11h15"), dias e agrupamento. */

type Faixa = Pick<Apresentacao, 'inicio' | 'fim'>;

export const minutos = (horario: string) => {
  const [h, m] = horario.split(':').map(Number);
  return h * 60 + m;
};

const paraHorario = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/** "08:00" → "8h"; "10:30" → "10h30". */
export function formatarHorario(horario: string): string {
  const [h, m] = horario.split(':');
  return `${Number(h)}h${m === '00' ? '' : m}`;
}

export const faixaHorario = ({ inicio, fim }: Faixa) => `${formatarHorario(inicio)}–${formatarHorario(fim)}`;

/** 45 → "45 min"; 60 → "1h"; 90 → "1h30". */
export function formatarDuracao(total: number): string {
  if (total < 60) return `${total} min`;
  const resto = total % 60;
  return `${Math.floor(total / 60)}h${resto ? String(resto).padStart(2, '0') : ''}`;
}

/** "45 min", "1h", "1h30". */
export const duracao = ({ inicio, fim }: Faixa) => formatarDuracao(minutos(fim) - minutos(inicio));

/** Mesmo horário somado de `delta` minutos, limitado a 23:55 (usado para sugerir o próximo bloco). */
export const somarMinutos = (horario: string, delta: number) =>
  paraHorario(Math.min(minutos(horario) + delta, 23 * 60 + 55));

export const sobrepoe = (a: Faixa, b: Faixa) =>
  minutos(a.inicio) < minutos(b.fim) && minutos(b.inicio) < minutos(a.fim);

/** "2026-11-24T00:00:00.000Z" → "2026-11-24" (a data é guardada como meia-noite UTC). */
export const chaveDia = (iso: string) => iso.slice(0, 10);

const dataUtc = (chave: string) => new Date(`${chave}T00:00:00Z`);
const formatoSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' });
const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const formatoMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'long' });

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const formatoSemanaCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short' });
const formatoMesCurto = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' });
const semPonto = (texto: string) => texto.replace('.', '');

/** { semana: "Terça-feira", data: "24/11", semanaCurta: "ter", numero: "24", mesCurto: "nov" } */
export function descreverDia(chave: string) {
  const data = dataUtc(chave);
  return {
    semana: capitalizar(formatoSemana.format(data)),
    data: formatoDiaMes.format(data),
    semanaCurta: semPonto(formatoSemanaCurta.format(data)),
    numero: String(data.getUTCDate()).padStart(2, '0'),
    mesCurto: semPonto(formatoMesCurto.format(data)),
  };
}

/** Período entre o primeiro e o último dia: "24 a 27 de novembro de 2026". */
export function descreverPeriodo(primeiro: string, ultimo: string): string {
  const [a, b] = [dataUtc(primeiro), dataUtc(ultimo)];
  const dia = (d: Date) => d.getUTCDate();
  const mes = (d: Date) => formatoMes.format(d);
  const ano = (d: Date) => d.getUTCFullYear();
  if (primeiro === ultimo) return `${dia(a)} de ${mes(a)} de ${ano(a)}`;
  if (ano(a) !== ano(b)) return `${dia(a)} de ${mes(a)} de ${ano(a)} a ${dia(b)} de ${mes(b)} de ${ano(b)}`;
  if (mes(a) !== mes(b)) return `${dia(a)} de ${mes(a)} a ${dia(b)} de ${mes(b)} de ${ano(b)}`;
  return `${dia(a)} a ${dia(b)} de ${mes(b)} de ${ano(b)}`;
}

/** Data e hora locais do navegador, nos mesmos formatos guardados na agenda. */
export function agoraLocal() {
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, '0');
  return {
    dia: `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}`,
    horario: `${dois(agora.getHours())}:${dois(agora.getMinutes())}`,
  };
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const ultima = partes.length > 1 ? partes[partes.length - 1] : '';
  return (partes[0].charAt(0) + ultima.charAt(0)).toUpperCase();
}

export interface DiaAgenda extends ReturnType<typeof descreverDia> {
  chave: string;
  /** Blocos temáticos do dia, na ordem em que aparecem (sem repetição). */
  temas: string[];
  apresentacoes: Apresentacao[];
}

/** Agrupa por dia; a lista já vem ordenada por data e horário da API. */
export function agruparPorDia(lista: Apresentacao[]): DiaAgenda[] {
  const dias = new Map<string, DiaAgenda>();
  for (const apresentacao of lista) {
    const chave = chaveDia(apresentacao.data);
    let dia = dias.get(chave);
    if (!dia) {
      dia = { chave, ...descreverDia(chave), temas: [], apresentacoes: [] };
      dias.set(chave, dia);
    }
    dia.apresentacoes.push(apresentacao);
    const tema = apresentacao.tema?.trim();
    if (tema && !dia.temas.includes(tema)) dia.temas.push(tema);
  }
  return [...dias.values()];
}
