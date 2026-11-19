import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { faChartPie, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { TIPOS, formatarData, formatarPercentual, normalizarBusca, plural } from '../../core/dominio';
import type { SistemaDashboard } from '../../core/models';
import { TemaService } from '../../core/tema.service';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { TituloPagina } from '../../shared/titulo-pagina';
import { PainelMeta } from '../gerenciamento/painel-meta';
import { coresDoTema, type CoresGrafico } from './cores';
import {
  SITUACOES,
  TIPOS_AVALIADOS,
  atendimento,
  dispensados,
  nomeCompleto,
  situacaoDo,
  somarContagens,
  type Atendimento,
  type FiltroTipo,
  type Ordenacao,
  type Situacao,
} from './dashboard-dados';

type Escala = 'percentual' | 'quantidade';

/** Altura da faixa de cada sistema nos gráficos de barras horizontais. */
const ALTURA_LINHA = 34;

@Component({
  selector: 'app-dashboard-page',
  imports: [FormsModule, RouterLink, NgxEchartsDirective, Icone, PainelMeta, TituloPagina],
  providers: [provideEchartsCore({ echarts: () => import('./echarts').then((m) => m.default) })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly tema = inject(TemaService);

  protected readonly sistemas = signal<SistemaDashboard[]>([]);
  protected readonly carregando = signal(true);
  protected readonly atualizando = signal(false);

  // Filtros
  protected readonly busca = signal('');
  protected readonly orgao = signal('');
  protected readonly tipo = signal<FiltroTipo>('TODOS');
  protected readonly situacao = signal<Situacao | ''>('');
  protected readonly somenteFavoritos = signal(false);
  protected readonly ordenacao = signal<Ordenacao>('atendimento');
  protected readonly escala = signal<Escala>('percentual');
  private readonly selecionadoId = signal<string | null>(null);

  protected readonly icones = { conformidade: faShieldHalved, dashboard: faChartPie };
  protected readonly SITUACOES = SITUACOES;
  protected readonly TIPOS_AVALIADOS = TIPOS_AVALIADOS;
  protected readonly TIPOS = TIPOS;
  protected readonly formatarPercentual = formatarPercentual;
  protected readonly formatarData = formatarData;
  protected readonly nomeCompleto = nomeCompleto;
  protected readonly situacaoDo = situacaoDo;
  protected readonly plural = plural;

  private readonly cores = computed(() => coresDoTema(this.tema.escuro()));

  // ---- Visão global (sempre todos os sistemas, sem filtros) ----
  protected readonly global = computed(() => atendimento(somarContagens(this.sistemas())));
  protected readonly globalPorTipo = computed(() => {
    const contagens = somarContagens(this.sistemas());
    return TIPOS_AVALIADOS.map((tipo) => ({ tipo, rotulo: TIPOS[tipo].rotulo, ...atendimento(contagens, tipo) }));
  });
  protected readonly globalDispensados = computed(() => dispensados(somarContagens(this.sistemas())));

  // ---- Filtros ----
  protected readonly orgaos = computed(() =>
    [...new Set(this.sistemas().flatMap((s) => (s.orgao ? [s.orgao] : [])))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  );

  /** Complemento do título quando há filtro de tipo (" · essenciais"). */
  protected readonly sufixoTipo = computed(() => {
    const tipo = this.tipo();
    return tipo === 'TODOS' ? '' : ` · ${TIPOS[tipo].rotulo.toLowerCase()}s`;
  });

  protected readonly filtrosAtivos = computed(
    () => !!this.busca().trim() || !!this.orgao() || this.tipo() !== 'TODOS' || !!this.situacao() || this.somenteFavoritos(),
  );

  /** Sistemas que passam na busca, órgão e favoritos (a rosca de situação parte daqui). */
  private readonly semFiltroDeSituacao = computed(() => {
    const termo = normalizarBusca(this.busca().trim());
    return this.sistemas().filter(
      (s) =>
        (!termo || normalizarBusca(`${s.nome} ${s.numero ?? ''} ${s.orgao ?? ''}`).includes(termo)) &&
        (!this.orgao() || s.orgao === this.orgao()) &&
        (!this.somenteFavoritos() || s.favorito),
    );
  });

  /** Sistemas que passam em todos os filtros, já com o atendimento do tipo escolhido e na ordem escolhida. */
  protected readonly filtrados = computed(() => {
    const tipo = this.tipo();
    const lista = this.semFiltroDeSituacao()
      .filter((s) => !this.situacao() || situacaoDo(s) === this.situacao())
      .map((sistema) => ({ sistema, atendimento: atendimento(sistema.contagens, tipo) }));

    const porNome = (a: (typeof lista)[number], b: (typeof lista)[number]) =>
      a.sistema.nome.localeCompare(b.sistema.nome, 'pt-BR', { numeric: true });
    const criterio: Record<Ordenacao, (a: (typeof lista)[number], b: (typeof lista)[number]) => number> = {
      atendimento: (a, b) => b.atendimento.percentual - a.atendimento.percentual || porNome(a, b),
      nome: porNome,
      itens: (a, b) => b.atendimento.total - a.atendimento.total || porNome(a, b),
      pendentes: (a, b) => b.atendimento.pendente - a.atendimento.pendente || porNome(a, b),
    };
    return lista.sort(criterio[this.ordenacao()]);
  });

  protected readonly totaisFiltrados = computed(() => {
    const lista = this.filtrados();
    return {
      sistemas: lista.length,
      metaAtingida: lista.filter((l) => l.sistema.resumo.metaAtingida).length,
      atendimento: atendimento(
        lista.flatMap((l) => l.sistema.contagens),
        this.tipo(),
      ),
    };
  });

  /** Sistema em destaque: o escolhido, se ainda estiver visível; senão o primeiro da lista. */
  protected readonly selecionado = computed(() => {
    const lista = this.filtrados();
    return lista.find((l) => l.sistema.id === this.selecionadoId())?.sistema ?? lista[0]?.sistema ?? null;
  });

  protected readonly idDestaque = computed(() => this.selecionado()?.id ?? null);

  // ---- Gráficos ----
  protected readonly alturaPorSistema = computed(() => Math.max(288, this.filtrados().length * ALTURA_LINHA + 70));

  protected readonly graficoSistemas = computed<EChartsCoreOption>(() => {
    const c = this.cores();
    const lista = this.filtrados();
    const percentual = this.escala() === 'percentual';
    const valor = (a: Atendimento, campo: 'atende' | 'naoAtende' | 'pendente') =>
      percentual ? (a.total ? (a[campo] / a.total) * 100 : 0) : a[campo];

    const serie = (nome: string, campo: 'atende' | 'naoAtende' | 'pendente', cor: string) => ({
      name: nome,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 22,
      itemStyle: { color: cor, borderColor: c.superficie, borderWidth: 1 },
      emphasis: { focus: 'series' },
      data: lista.map((l) => valor(l.atendimento, campo)),
      label:
        campo === 'atende'
          ? {
              show: true,
              position: 'insideLeft',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 600,
              formatter: (p: { dataIndex: number }) => {
                const a = lista[p.dataIndex]!.atendimento;
                const largura = a.total ? a.atende / a.total : 0;
                return largura >= 0.14 ? formatarPercentual(a.percentual) : '';
              },
            }
          : undefined,
    });

    return {
      ...base(c),
      grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
      legend: legenda(c, { top: 0, left: 0 }),
      tooltip: {
        ...dica(c),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: c.linha, opacity: 0.4 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const { sistema, atendimento: a } = lista[params[0]!.dataIndex]!;
          return (
            `<b>${escapar(nomeCompleto(sistema))}</b><br/>` +
            linhaDica(c.atende, 'Atende', a.atende, a.total) +
            linhaDica(c.naoAtende, 'Não atende', a.naoAtende, a.total) +
            linhaDica(c.pendente, 'Pendente', a.pendente, a.total) +
            `<span style="color:${c.apagado}">${plural(a.total, 'item', 'itens')} · clique para detalhar</span>`
          );
        },
      },
      xAxis: {
        type: 'value',
        max: percentual ? 100 : undefined,
        axisLabel: { color: c.apagado, formatter: percentual ? '{value}%' : '{value}' },
        splitLine: { lineStyle: { color: c.linha } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: lista.map((l) => nomeCompleto(l.sistema)),
        axisLabel: { color: c.tintaSuave, width: 180, overflow: 'truncate' },
        axisLine: { lineStyle: { color: c.linha } },
        axisTick: { show: false },
      },
      series: [
        serie('Atende', 'atende', c.atende),
        serie('Não atende', 'naoAtende', c.naoAtende),
        serie('Pendente', 'pendente', c.pendente),
      ],
    };
  });

  protected readonly graficoSituacao = computed<EChartsCoreOption>(() => {
    const c = this.cores();
    // A rosca ignora o próprio filtro de situação para continuar mostrando as três fatias.
    const lista = this.semFiltroDeSituacao();
    const contar = (situacao: Situacao) => lista.filter((s) => situacaoDo(s) === situacao).length;
    const cor: Record<Situacao, string> = { atingida: c.atende, avaliacao: c.avaliacao, vazio: c.pendente };
    const ativo = this.situacao();

    return {
      ...base(c),
      legend: legenda(c, { bottom: 0, left: 'center' }),
      tooltip: { ...dica(c), trigger: 'item', formatter: '{b}: <b>{c}</b> ({d}%)' },
      graphic: {
        type: 'text',
        left: 'center',
        top: '38%',
        style: {
          text: `${lista.length}\n{rotulo|${lista.length === 1 ? 'sistema' : 'sistemas'}}`,
          fill: c.tinta,
          font: '700 26px Inter, system-ui, sans-serif',
          align: 'center',
          lineHeight: 30,
          rich: { rotulo: { fill: c.apagado, font: '500 12px Inter, system-ui, sans-serif' } },
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['54%', '76%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          label: { show: false },
          itemStyle: { borderColor: c.superficie, borderWidth: 2, borderRadius: 4 },
          data: (Object.keys(SITUACOES) as Situacao[]).map((situacao) => ({
            name: SITUACOES[situacao],
            value: contar(situacao),
            situacao,
            // Fatia zerada sem borda, senão a borda desenha um risco na rosca.
            itemStyle: {
              color: cor[situacao],
              opacity: !ativo || ativo === situacao ? 1 : 0.3,
              ...(contar(situacao) === 0 ? { borderWidth: 0 } : {}),
            },
          })),
        },
      ],
    };
  });

  protected readonly graficoTipos = computed<EChartsCoreOption>(() => {
    const c = this.cores();
    const contagens = this.filtrados().flatMap((l) => l.sistema.contagens);
    const filtro = this.tipo();
    const tipos = filtro === 'TODOS' ? TIPOS_AVALIADOS : [filtro];
    const dados = tipos.map((tipo) => ({ tipo, ...atendimento(contagens, tipo) }));
    const serie = (nome: string, campo: 'atende' | 'naoAtende' | 'pendente', cor: string) => ({
      name: nome,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 36,
      itemStyle: { color: cor, borderColor: c.superficie, borderWidth: 1 },
      emphasis: { focus: 'series' },
      data: dados.map((d) => d[campo]),
    });

    return {
      ...base(c),
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: legenda(c, { top: 0, left: 0 }),
      tooltip: {
        ...dica(c),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: c.linha, opacity: 0.4 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const d = dados[params[0]!.dataIndex]!;
          return (
            `<b>${TIPOS[d.tipo].rotulo}</b><br/>` +
            linhaDica(c.atende, 'Atende', d.atende, d.total) +
            linhaDica(c.naoAtende, 'Não atende', d.naoAtende, d.total) +
            linhaDica(c.pendente, 'Pendente', d.pendente, d.total)
          );
        },
      },
      xAxis: {
        type: 'category',
        data: dados.map((d) => TIPOS[d.tipo].rotulo),
        axisLabel: { color: c.tintaSuave, interval: 0 },
        axisLine: { lineStyle: { color: c.linha } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLabel: { color: c.apagado },
        splitLine: { lineStyle: { color: c.linha } },
      },
      series: [
        serie('Atende', 'atende', c.atende),
        serie('Não atende', 'naoAtende', c.naoAtende),
        serie('Pendente', 'pendente', c.pendente),
      ],
    };
  });

  /** Essenciais atendidos de cada sistema contra a meta dele. */
  protected readonly graficoMeta = computed<EChartsCoreOption>(() => {
    const c = this.cores();
    const lista = this.filtrados().filter((l) => l.sistema.resumo.essenciais.total > 0);
    return {
      ...base(c),
      grid: { left: 8, right: 24, top: 36, bottom: 8, containLabel: true },
      legend: legenda(c, { top: 0, left: 0 }),
      tooltip: {
        ...dica(c),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: c.linha, opacity: 0.4 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const { sistema } = lista[params[0]!.dataIndex]!;
          const e = sistema.resumo.essenciais;
          return (
            `<b>${escapar(nomeCompleto(sistema))}</b><br/>` +
            `Essenciais: <b>${formatarPercentual(e.percentual)}</b> (${e.atendidos} de ${e.total})<br/>` +
            `Meta: <b>${sistema.metaPercentual}%</b> · mínimo ${e.minimo}<br/>` +
            `<span style="color:${c.apagado}">${sistema.resumo.metaAtingida ? 'Meta atingida' : `Faltam ${Math.max(0, e.minimo - e.atendidos)} essenciais`}</span>`
          );
        },
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: c.apagado, formatter: '{value}%' },
        splitLine: { lineStyle: { color: c.linha } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: lista.map((l) => nomeCompleto(l.sistema)),
        axisLabel: { color: c.tintaSuave, width: 180, overflow: 'truncate' },
        axisLine: { lineStyle: { color: c.linha } },
        axisTick: { show: false },
      },
      series: [
        {
          name: 'Essenciais atendidos',
          type: 'bar',
          barMaxWidth: 16,
          itemStyle: { color: c.marca, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: c.tintaSuave,
            fontSize: 11,
            formatter: (p: { value: number }) => formatarPercentual(p.value),
          },
          data: lista.map((l) => l.sistema.resumo.essenciais.percentual),
        },
        {
          name: 'Meta',
          type: 'scatter',
          symbol: 'rect',
          symbolSize: [3, 22],
          itemStyle: { color: c.tinta },
          z: 3,
          data: lista.map((l) => l.sistema.metaPercentual),
        },
      ],
    };
  });

  protected readonly alturaMeta = computed(
    () => Math.max(288, this.filtrados().filter((l) => l.sistema.resumo.essenciais.total > 0).length * ALTURA_LINHA + 70),
  );

  /** Etapas do sistema em destaque, em percentual (respeita o filtro de tipo). */
  protected readonly etapasSelecionado = computed(() => {
    const sistema = this.selecionado();
    if (!sistema) return [];
    return sistema.etapas
      .map((etapa) => ({ nome: etapa.nome, ...atendimento(etapa.contagens, this.tipo()) }))
      .filter((e) => e.total > 0);
  });

  protected readonly graficoEtapas = computed<EChartsCoreOption>(() => {
    const c = this.cores();
    const etapas = this.etapasSelecionado();
    const serie = (nome: string, campo: 'atende' | 'naoAtende' | 'pendente', cor: string) => ({
      name: nome,
      type: 'bar',
      stack: 'total',
      barMaxWidth: 18,
      itemStyle: { color: cor, borderColor: c.superficie, borderWidth: 1 },
      emphasis: { focus: 'series' },
      data: etapas.map((e) => (e.total ? (e[campo] / e.total) * 100 : 0)),
    });
    return {
      ...base(c),
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      legend: legenda(c, { top: 0, left: 0 }),
      tooltip: {
        ...dica(c),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: c.linha, opacity: 0.4 } },
        formatter: (params: Array<{ dataIndex: number }>) => {
          const e = etapas[params[0]!.dataIndex]!;
          return (
            `<b>${escapar(e.nome)}</b><br/>` +
            linhaDica(c.atende, 'Atende', e.atende, e.total) +
            linhaDica(c.naoAtende, 'Não atende', e.naoAtende, e.total) +
            linhaDica(c.pendente, 'Pendente', e.pendente, e.total)
          );
        },
      },
      xAxis: {
        type: 'value',
        max: 100,
        axisLabel: { color: c.apagado, formatter: '{value}%' },
        splitLine: { lineStyle: { color: c.linha } },
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: etapas.map((e) => e.nome),
        axisLabel: { color: c.tintaSuave, width: 200, overflow: 'truncate' },
        axisLine: { lineStyle: { color: c.linha } },
        axisTick: { show: false },
      },
      series: [
        serie('Atende', 'atende', c.atende),
        serie('Não atende', 'naoAtende', c.naoAtende),
        serie('Pendente', 'pendente', c.pendente),
      ],
    };
  });

  protected readonly alturaEtapas = computed(() => Math.max(180, this.etapasSelecionado().length * 30 + 60));

  async ngOnInit() {
    await this.carregar();
  }

  protected async carregar() {
    this.atualizando.set(true);
    try {
      this.sistemas.set(await this.api.obterDashboard());
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
      this.atualizando.set(false);
    }
  }

  protected selecionar(id: string) {
    this.selecionadoId.set(id);
  }

  protected aoClicarSistema(evento: { dataIndex?: number }) {
    const item = evento.dataIndex !== undefined ? this.filtrados()[evento.dataIndex] : undefined;
    if (item) this.selecionar(item.sistema.id);
  }

  protected aoClicarSituacao(evento: { data?: unknown }) {
    const situacao = (evento.data as { situacao?: Situacao } | undefined)?.situacao;
    if (situacao) this.situacao.update((atual) => (atual === situacao ? '' : situacao));
  }

  protected limparFiltros() {
    this.busca.set('');
    this.orgao.set('');
    this.tipo.set('TODOS');
    this.situacao.set('');
    this.somenteFavoritos.set(false);
  }

  /** Largura (%) de cada parte da barra de progresso. */
  protected parte(valor: number, total: number) {
    return total ? (valor / total) * 100 : 0;
  }
}

// ---- Peças comuns das opções do ECharts ----

const base = (c: CoresGrafico) => ({
  backgroundColor: 'transparent',
  animationDuration: 400,
  textStyle: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', color: c.tintaSuave },
});

const legenda = (c: CoresGrafico, posicao: Record<string, string | number>) => ({
  ...posicao,
  icon: 'roundRect',
  itemWidth: 12,
  itemHeight: 12,
  itemGap: 16,
  textStyle: { color: c.tintaSuave, fontSize: 12 },
});

const dica = (c: CoresGrafico) => ({
  backgroundColor: c.superficie,
  borderColor: c.linha,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { color: c.tinta, fontSize: 12 },
  extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(11,31,77,.15);',
});

const linhaDica = (cor: string, rotulo: string, valor: number, total: number) =>
  `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${cor};margin-right:6px"></span>` +
  `${rotulo}: <b>${valor}</b> (${formatarPercentual(total ? (valor / total) * 100 : 0)})<br/>`;

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
