import { CdkDrag, CdkDropList, CdkDropListGroup, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import {
  ORDEM_TIPOS,
  calcularResumo,
  compararNumero,
  formatarData,
  formatarPercentual,
  normalizarBusca,
  plural,
} from '../../core/dominio';
import type {
  Categoria,
  DadosItem,
  DadosSistema,
  EventoEdital,
  Item,
  PosicaoItem,
  ResultadoImportacao,
  Sistema,
  StatusItem,
  TipoItem,
} from '../../core/models';
import { RealtimeService, type EstadoConexao } from '../../core/realtime.service';
import { ToastService } from '../../core/toast.service';
import { AutoFoco } from '../../shared/auto-foco';
import { Icone } from '../../shared/icone';
import { Modal } from '../../shared/modal';
import { SistemaForm } from '../sistemas/sistema-form';
import { EtapasPainel, type MovimentoEtapa, type ProgressoEtapa } from './etapas-painel';
import { ImportarCsv } from './importar-csv';
import { ItemForm } from './item-form';
import { ItemLinha } from './item-linha';
import { PainelMeta, situacaoDaMeta } from './painel-meta';

type ModoOrdem = 'etapas' | 'numerica';
type Filtro = 'TODOS' | StatusItem;

type SelecaoGrupo = 'nenhum' | 'alguns' | 'todos';

interface Grupo {
  id: string;
  categoriaId: string | null;
  numero: number | null;
  titulo: string;
  /** Itens visíveis (após filtro/busca). */
  itens: Item[];
  atendidos: number;
  total: number;
}

const SEM_ETAPA = 'sem-etapa';
const DURACAO_DESTAQUE_MS = 1600;

const TITULO_TIPO: Record<TipoItem, (n: number) => string> = {
  OBRIGATORIO: (n) => `${n} requisitos obrigatórios`,
  ESSENCIAL: (n) => `${n} requisitos essenciais`,
  COMPLEMENTAR: (n) => `${n} complementares · não entram no cálculo`,
  DISPENSADO: (n) => `${n} dispensados da POC · não entram no cálculo`,
};

const CAMPOS_CSV: Record<string, string> = {
  numero: 'numeração',
  descricao: 'requisito',
  tipo: 'tipo',
  categoria: 'grupo',
  status: 'status',
  observacao: 'observação',
};

@Component({
  selector: 'app-gerenciamento-page',
  imports: [
    RouterLink,
    CdkDropListGroup,
    CdkDropList,
    CdkDrag,
    AutoFoco,
    Icone,
    Modal,
    SistemaForm,
    EtapasPainel,
    ImportarCsv,
    ItemForm,
    ItemLinha,
    PainelMeta,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gerenciamento-page.html',
})
export class GerenciamentoPage {
  private readonly api = inject(ApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  /** Vem do parâmetro de rota `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly sistema = signal<Sistema | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly itens = signal<Item[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erroCarga = signal<string | null>(null);
  protected readonly conexao = signal<EstadoConexao>('conectando');

  protected readonly modo = signal<ModoOrdem>('etapas');
  protected readonly filtro = signal<Filtro>('TODOS');
  protected readonly busca = signal('');

  protected readonly salvando = signal<ReadonlySet<string>>(new Set());
  protected readonly destaques = signal<ReadonlySet<string>>(new Set());
  protected readonly editandoSistema = signal(false);
  protected readonly salvandoSistema = signal(false);
  protected readonly itemEmEdicao = signal<Item | 'novo' | null>(null);
  protected readonly ultimaImportacao = signal<ResultadoImportacao | null>(null);

  /** Itens marcados para mover em lote (só na visão por grupos). */
  protected readonly selecionados = signal<ReadonlySet<string>>(new Set());
  /** Grupos recolhidos na lista principal (por `Grupo.id`). */
  protected readonly recolhidos = signal<ReadonlySet<string>>(new Set());
  /** Nome digitado na barra de seleção para criar um grupo novo; `null` = campo fechado. */
  protected readonly nomeNovoGrupo = signal<string | null>(null);
  protected readonly movendoSelecao = signal(false);

  protected readonly formatarData = formatarData;
  protected readonly camposCsv = CAMPOS_CSV;

  /** Garante que cliques rápidos no mesmo item cheguem à API na ordem em que foram feitos. */
  private readonly filaPorItem = new Map<string, Promise<unknown>>();
  private readonly versaoPorItem = new Map<string, number>();

  protected readonly meta = computed(() => this.sistema()?.metaPercentual ?? 85);
  protected readonly resumo = computed(() => calcularResumo(this.itens(), this.meta()));
  protected readonly situacao = computed(() => situacaoDaMeta(this.resumo(), this.meta()));
  protected readonly filtrando = computed(() => this.filtro() !== 'TODOS' || this.busca().trim() !== '');
  protected readonly podeArrastar = computed(() => this.modo() === 'etapas' && !this.filtrando());
  protected readonly podeSelecionar = computed(() => this.modo() === 'etapas');
  protected readonly urlExportacao = computed(() => this.api.urlExportacao(this.id()));
  protected readonly colunasImportadas = computed(() => Object.entries(this.ultimaImportacao()?.colunas ?? {}));

  protected readonly progressoEtapas = computed(() => {
    const progresso = new Map<string, ProgressoEtapa>();
    for (const item of this.itens()) {
      if (!item.categoriaId) continue;
      const atual = progresso.get(item.categoriaId) ?? { atendidos: 0, total: 0 };
      atual.total++;
      if (item.status === 'ATENDE') atual.atendidos++;
      progresso.set(item.categoriaId, atual);
    }
    return progresso;
  });

  protected readonly grupos = computed<Grupo[]>(() => {
    const filtro = this.filtro();
    const termo = normalizarBusca(this.busca().trim());
    const visivel = (item: Item) =>
      (filtro === 'TODOS' || item.status === filtro) &&
      (!termo || normalizarBusca(`${item.numero ?? ''} ${item.descricao} ${item.observacao ?? ''}`).includes(termo));
    const montar = (id: string, categoriaId: string | null, numero: number | null, titulo: string, todos: Item[]): Grupo => ({
      id,
      categoriaId,
      numero,
      titulo,
      itens: todos.filter(visivel),
      atendidos: todos.filter((i) => i.status === 'ATENDE').length,
      total: todos.length,
    });

    let grupos: Grupo[];
    if (this.modo() === 'etapas') {
      const listas = this.listasPorEtapa();
      grupos = this.categorias().map((c, i) => montar(c.id, c.id, i + 1, c.nome, listas.get(c.id) ?? []));
      const semEtapa = listas.get(null);
      if (semEtapa?.length) grupos.push(montar(SEM_ETAPA, null, null, 'Sem grupo', semEtapa));
    } else {
      const ordenados = [...this.itens()].sort((a, b) => compararNumero(a.numero, b.numero));
      grupos = ORDEM_TIPOS.map((tipo) => {
        const doTipo = ordenados.filter((i) => i.tipo === tipo);
        return montar(tipo, null, null, TITULO_TIPO[tipo](doTipo.length), doTipo);
      }).filter((g) => g.total > 0);
    }

    return this.filtrando() ? grupos.filter((g) => g.itens.length > 0) : grupos;
  });

  /**
   * Todos os itens (sem filtro) de cada grupo, na ordem de apresentação. A chave `null` reúne os itens
   * sem grupo ou cujo grupo não existe mais. A ordem do Map é a ordem dos grupos na tela.
   */
  private readonly listasPorEtapa = computed(() => {
    const listas = new Map<string | null, Item[]>(this.categorias().map((c) => [c.id, []]));
    listas.set(null, []);
    const ordenados = [...this.itens()].sort((a, b) => a.ordem - b.ordem || compararNumero(a.numero, b.numero));
    for (const item of ordenados) {
      const chave = item.categoriaId && listas.has(item.categoriaId) ? item.categoriaId : null;
      listas.get(chave)!.push(item);
    }
    return listas;
  });

  protected readonly selecaoPorGrupo = computed(() => {
    const selecionados = this.selecionados();
    const estado = new Map<string, SelecaoGrupo>();
    for (const grupo of this.grupos()) {
      const marcados = grupo.itens.filter((i) => selecionados.has(i.id)).length;
      estado.set(grupo.id, !marcados ? 'nenhum' : marcados === grupo.itens.length ? 'todos' : 'alguns');
    }
    return estado;
  });

  protected readonly todosRecolhidos = computed(() => {
    const grupos = this.grupos();
    const recolhidos = this.recolhidos();
    return grupos.length > 0 && grupos.every((g) => recolhidos.has(g.id));
  });

  protected readonly contagemImportacao = computed(() => {
    const r = this.ultimaImportacao();
    if (!r) return '';
    return [
      plural(r.linhasLidas, 'linha lida', 'linhas lidas'),
      plural(r.criados, 'item criado', 'itens criados'),
      plural(r.atualizados, 'atualizado', 'atualizados'),
      plural(r.categoriasCriadas.length, 'grupo criado', 'grupos criados'),
      ...(r.titulosIgnorados ? [plural(r.titulosIgnorados, 'título/subtítulo ignorado', 'títulos/subtítulos ignorados')] : []),
    ].join(' · ');
  });

  protected readonly notaCalculo = computed(() => {
    const { essenciais, obrigatorios } = this.resumo();
    const complementares = this.itens().filter((i) => i.tipo === 'COMPLEMENTAR').length;
    const dispensados = this.itens().filter((i) => i.tipo === 'DISPENSADO').length;
    if (!essenciais.total) {
      return (
        'Cálculo: essenciais atendidos ÷ total de essenciais. Pendentes não contam como atendidos; ' +
        'complementares e dispensados da POC ficam fora do percentual.'
      );
    }
    const foraDoCalculo = [
      complementares ? plural(complementares, 'item complementar', 'itens complementares') : '',
      dispensados ? plural(dispensados, 'item dispensado da POC', 'itens dispensados da POC') : '',
    ].filter(Boolean);
    return (
      `Cálculo: essenciais atendidos ÷ ${essenciais.total}. Pendentes não contam como atendidos. ` +
      `São necessários ${essenciais.minimo} de ${essenciais.total} (${formatarPercentual((essenciais.minimo / essenciais.total) * 100)})` +
      (obrigatorios.total ? ` e os ${obrigatorios.total} obrigatórios.` : '.') +
      (foraDoCalculo.length
        ? ` ${foraDoCalculo.join(' e ')} ${complementares + dispensados === 1 ? 'não entra' : 'não entram'} no percentual.`
        : '')
    );
  });

  constructor() {
    effect((onCleanup) => {
      const id = this.id();
      const desconectar = untracked(() => {
        void this.carregar(id, true);
        return this.realtime.conectar(id, {
          aoEvento: (evento) => this.aplicarEvento(evento),
          aoMudarEstado: (estado) => this.conexao.set(estado),
          aoReconectar: () => void this.carregar(id, false),
        });
      });
      onCleanup(desconectar);
    });

    // Seleção só existe na visão por grupos: trocar de visão limpa tudo.
    effect(() => {
      this.modo();
      untracked(() => this.limparSelecao());
    });

    // Recarga ou evento em tempo real pode remover itens: tira da seleção os que não existem mais.
    effect(() => {
      const existentes = new Set(this.itens().map((i) => i.id));
      const atual = untracked(this.selecionados);
      if ([...atual].some((id) => !existentes.has(id))) {
        this.selecionados.set(new Set([...atual].filter((id) => existentes.has(id))));
      }
    });
  }

  protected async carregar(id = this.id(), inicial = true) {
    if (inicial) {
      this.carregando.set(true);
      this.erroCarga.set(null);
    }
    try {
      const { categorias, itens, ...sistema } = await this.api.obterSistema(id);
      this.sistema.set(sistema);
      this.categorias.set(categorias);
      this.itens.set(itens);
      this.title.setTitle(`${sistema.nome} · Conformidade de Editais`);
    } catch (erro) {
      if (inicial) this.erroCarga.set(mensagemDeErro(erro));
      else this.toast.erro(mensagemDeErro(erro));
    } finally {
      if (inicial) this.carregando.set(false);
    }
  }

  // ----- Marcação Atende / Não atende (salva na hora) -----

  protected async marcar(item: Item, status: StatusItem) {
    if (item.status === status) return;
    const anterior = item.status;
    const versao = (this.versaoPorItem.get(item.id) ?? 0) + 1;
    const ultima = () => this.versaoPorItem.get(item.id) === versao;
    this.versaoPorItem.set(item.id, versao);

    this.atualizarLocal(item.id, { status });
    this.marcarSalvando(item.id, true);
    try {
      const salvo = await this.enfileirar(item.id, () => this.api.atualizarItem(item.id, { status }));
      if (ultima()) this.substituir(salvo);
    } catch (erro) {
      if (ultima()) this.atualizarLocal(item.id, { status: anterior });
      this.toast.erro(`Não foi possível salvar a marcação: ${mensagemDeErro(erro)}`);
    } finally {
      if (ultima()) this.marcarSalvando(item.id, false);
    }
  }

  // ----- Reordenação (arrastar, posição digitada e mover em lote) -----

  protected soltarItem(evento: CdkDragDrop<Grupo, Grupo, Item>) {
    const mesmaLista = evento.previousContainer.data.id === evento.container.data.id;
    if (mesmaLista && evento.previousIndex === evento.currentIndex) return;
    void this.moverItens([evento.item.data.id], evento.container.data.categoriaId, evento.currentIndex);
  }

  /** Posição digitada na linha (1-based, já limitada pela linha ao tamanho do grupo). */
  protected moverParaPosicao(item: Item, grupo: Grupo, posicao: number) {
    void this.moverItens([item.id], grupo.categoriaId, posicao - 1);
  }

  /**
   * Move `ids` para o grupo `categoriaIdDestino` (null = sem grupo), começando no índice `indiceDestino`
   * da lista de destino já sem os itens movidos (índices fora da faixa são limitados; `Infinity` = no fim).
   * Os itens movidos mantêm a ordem relativa em que aparecem na tela. Renumera 0..n-1 todos os grupos
   * afetados, aplica de forma otimista e persiste numa única chamada; desfaz se a API recusar.
   * Retorna `true` se a nova ordem foi salva (ou se não havia nada a mudar).
   */
  protected async moverItens(ids: string[], categoriaIdDestino: string | null, indiceDestino: number): Promise<boolean> {
    const listas = this.listasPorEtapa();
    const chaveDestino = categoriaIdDestino !== null && listas.has(categoriaIdDestino) ? categoriaIdDestino : null;
    const alvo = new Set(ids);

    const movidos: Item[] = [];
    const novas = new Map<string | null, Item[]>();
    for (const [chave, lista] of listas) {
      const restantes = lista.filter((item) => {
        if (!alvo.has(item.id)) return true;
        movidos.push(item);
        return false;
      });
      if (restantes.length !== lista.length) novas.set(chave, restantes);
    }
    if (!movidos.length) return true;

    const destino = [...(novas.get(chaveDestino) ?? listas.get(chaveDestino) ?? [])];
    const indice = Math.min(Math.max(Math.trunc(Number.isFinite(indiceDestino) ? indiceDestino : destino.length), 0), destino.length);
    destino.splice(indice, 0, ...movidos);
    novas.set(chaveDestino, destino);

    const inalterado = [...novas].every(([chave, lista]) => {
      const original = listas.get(chave) ?? [];
      return original.length === lista.length && original.every((item, i) => item.id === lista[i].id);
    });
    if (inalterado) return true;

    const posicoes: PosicaoItem[] = [];
    for (const [chave, lista] of novas) {
      lista.forEach((item, ordem) => posicoes.push({ id: item.id, categoriaId: chave, ordem }));
    }

    const anterior = this.itens();
    this.aplicarPosicoes(posicoes);
    try {
      await this.api.reordenarItens(this.id(), posicoes);
      return true;
    } catch (erro) {
      this.itens.set(anterior);
      this.toast.erro(`Não foi possível salvar a nova ordem: ${mensagemDeErro(erro)}`);
      return false;
    }
  }

  protected async reordenarEtapas({ de, para }: MovimentoEtapa) {
    const anterior = this.categorias();
    if (de === para || para < 0 || para >= anterior.length) return;
    const lista = [...anterior];
    moveItemInArray(lista, de, para);
    this.categorias.set(lista.map((c, ordem) => ({ ...c, ordem })));
    try {
      await this.api.reordenarCategorias(this.id(), lista.map((c) => c.id));
    } catch (erro) {
      this.categorias.set(anterior);
      this.toast.erro(`Não foi possível reordenar os grupos: ${mensagemDeErro(erro)}`);
    }
  }

  // ----- Seleção e ações em lote -----

  protected alternarItem(id: string, marcado: boolean) {
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  protected alternarGrupo(grupo: Grupo) {
    const marcar = this.selecaoPorGrupo().get(grupo.id) !== 'todos';
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      for (const item of grupo.itens) {
        if (marcar) novo.add(item.id);
        else novo.delete(item.id);
      }
      return novo;
    });
  }

  protected limparSelecao() {
    this.selecionados.set(new Set());
    this.nomeNovoGrupo.set(null);
  }

  /** `valor` vem do select da barra: id do grupo ou '' para "Sem grupo". */
  protected async moverSelecaoPara(valor: string) {
    if (valor === '__nenhum') return;
    await this.moverSelecao(valor || null);
  }

  protected async criarGrupoComSelecao() {
    const nome = this.nomeNovoGrupo()?.trim();
    if (!nome || this.movendoSelecao()) return;
    this.movendoSelecao.set(true);
    try {
      const categoria = await this.criarEtapa(nome);
      if (!categoria) return;
      this.nomeNovoGrupo.set(null);
      await this.moverSelecao(categoria.id, false);
    } finally {
      this.movendoSelecao.set(false);
    }
  }

  /** Leva os selecionados para o fim do grupo, mantendo a ordem em que aparecem na tela. */
  private async moverSelecao(categoriaId: string | null, controlarEstado = true) {
    const selecionados = this.selecionados();
    if (!selecionados.size) return;
    const ids = [...this.listasPorEtapa().values()].flat().filter((i) => selecionados.has(i.id)).map((i) => i.id);
    if (controlarEstado) this.movendoSelecao.set(true);
    try {
      const ok = await this.moverItens(ids, categoriaId, Infinity);
      if (!ok) return;
      const nome = categoriaId ? this.categorias().find((c) => c.id === categoriaId)?.nome : 'Sem grupo';
      this.toast.sucesso(`${plural(ids.length, 'item movido', 'itens movidos')} para "${nome ?? 'grupo'}".`);
      this.limparSelecao();
      if (categoriaId) this.expandir(categoriaId);
      else this.expandir(SEM_ETAPA);
    } finally {
      if (controlarEstado) this.movendoSelecao.set(false);
    }
  }

  // ----- Recolher / expandir grupos -----

  protected alternarRecolhido(id: string) {
    this.recolhidos.update((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  protected alternarTodos() {
    this.recolhidos.set(this.todosRecolhidos() ? new Set() : new Set(this.grupos().map((g) => g.id)));
  }

  private expandir(id: string) {
    if (!this.recolhidos().has(id)) return;
    this.recolhidos.update((atual) => {
      const novo = new Set(atual);
      novo.delete(id);
      return novo;
    });
  }

  // ----- Etapas (categorias) -----

  protected async criarEtapa(nome: string): Promise<Categoria | null> {
    try {
      const categoria = await this.api.criarCategoria(this.id(), nome);
      // O evento em tempo real pode ter recarregado a lista antes da resposta chegar.
      this.categorias.update((lista) => (lista.some((c) => c.id === categoria.id) ? lista : [...lista, categoria]));
      return categoria;
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
      return null;
    }
  }

  protected async renomearEtapa({ categoria, nome }: { categoria: Categoria; nome: string }) {
    try {
      const atualizada = await this.api.renomearCategoria(categoria.id, nome);
      this.categorias.update((lista) => lista.map((c) => (c.id === atualizada.id ? atualizada : c)));
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected async removerEtapa(categoria: Categoria) {
    const quantidade = this.itens().filter((i) => i.categoriaId === categoria.id).length;
    const aviso = quantidade ? ` ${plural(quantidade, 'item dele ficará', 'itens dele ficarão')} em "Sem grupo".` : '';
    if (!confirm(`Excluir o grupo "${categoria.nome}"?${aviso}`)) return;
    try {
      await this.api.removerCategoria(categoria.id);
      this.categorias.update((lista) => lista.filter((c) => c.id !== categoria.id));
      this.itens.update((lista) => lista.map((i) => (i.categoriaId === categoria.id ? { ...i, categoriaId: null } : i)));
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected irParaEtapa(categoria: Categoria) {
    this.modo.set('etapas');
    this.filtro.set('TODOS');
    this.busca.set('');
    this.expandir(categoria.id);
    setTimeout(() => document.getElementById(`etapa-${categoria.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // ----- Itens -----

  protected async salvarItem(dados: DadosItem) {
    const alvo = this.itemEmEdicao();
    try {
      if (alvo === 'novo') {
        this.substituir(await this.api.criarItem(this.id(), dados));
        this.toast.sucesso('Item adicionado.');
      } else if (alvo) {
        this.substituir(await this.api.atualizarItem(alvo.id, dados));
        this.toast.sucesso('Item atualizado.');
      }
      this.itemEmEdicao.set(null);
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected async removerItemEmEdicao() {
    const alvo = this.itemEmEdicao();
    if (!alvo || alvo === 'novo' || !confirm('Excluir este item do sistema?')) return;
    try {
      await this.api.removerItem(alvo.id);
      this.itens.update((lista) => lista.filter((i) => i.id !== alvo.id));
      this.itemEmEdicao.set(null);
      this.toast.sucesso('Item excluído.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected async aoImportar(resultado: ResultadoImportacao) {
    this.ultimaImportacao.set(resultado);
    await this.carregar(this.id(), false);
    this.toast.sucesso(
      `${plural(resultado.criados, 'item criado', 'itens criados')} e ` +
        `${plural(resultado.atualizados, 'atualizado', 'atualizados')} a partir de "${resultado.arquivo}".`,
    );
  }

  // ----- Edital -----

  protected async salvarSistema(dados: DadosSistema) {
    this.salvandoSistema.set(true);
    try {
      this.sistema.set(await this.api.atualizarSistema(this.id(), dados));
      this.editandoSistema.set(false);
      this.toast.sucesso('Sistema atualizado.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.salvandoSistema.set(false);
    }
  }

  protected async reiniciar() {
    if (!confirm('Limpar todas as marcações desta avaliação? Todos os itens voltam para Pendente.')) return;
    const anterior = this.itens();
    this.itens.update((lista) => lista.map((i) => ({ ...i, status: 'PENDENTE' as const })));
    try {
      await this.api.reiniciarAvaliacao(this.id());
      this.toast.info('Avaliação reiniciada.');
    } catch (erro) {
      this.itens.set(anterior);
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected imprimir() {
    window.print();
  }

  protected definirModo(valor: string) {
    this.modo.set(valor === 'numerica' ? 'numerica' : 'etapas');
  }

  protected definirFiltro(valor: string) {
    this.filtro.set(valor as Filtro);
  }

  // ----- Tempo real -----

  private aplicarEvento(evento: EventoEdital) {
    switch (evento.tipo) {
      case 'item.criado':
      case 'item.atualizado': {
        const item = evento.dados as Item;
        if (this.salvando().has(item.id)) return;
        this.substituir(item);
        this.destacar(item.id);
        break;
      }
      case 'item.removido': {
        const { id } = evento.dados as { id: string };
        this.itens.update((lista) => lista.filter((i) => i.id !== id));
        break;
      }
      case 'itens.reordenados':
        this.aplicarPosicoes(evento.dados as PosicaoItem[]);
        break;
      case 'sistema.atualizado':
        this.sistema.set(evento.dados as Sistema);
        break;
      case 'sistema.removido':
        this.toast.info('Este sistema foi excluído em outra sessão.');
        void this.router.navigate(['/']);
        break;
      default:
        void this.carregar(this.id(), false);
    }
  }

  // ----- Auxiliares de estado -----

  private enfileirar<T>(itemId: string, tarefa: () => Promise<T>): Promise<T> {
    const proxima = (this.filaPorItem.get(itemId) ?? Promise.resolve()).catch(() => undefined).then(tarefa);
    this.filaPorItem.set(itemId, proxima);
    return proxima;
  }

  private atualizarLocal(id: string, alteracao: Partial<Item>) {
    this.itens.update((lista) => lista.map((i) => (i.id === id ? { ...i, ...alteracao } : i)));
  }

  private substituir(item: Item) {
    this.itens.update((lista) =>
      lista.some((i) => i.id === item.id) ? lista.map((i) => (i.id === item.id ? item : i)) : [...lista, item],
    );
  }

  private aplicarPosicoes(posicoes: PosicaoItem[]) {
    const porId = new Map(posicoes.map((p) => [p.id, p]));
    this.itens.update((lista) =>
      lista.map((i) => {
        const posicao = porId.get(i.id);
        return posicao ? { ...i, categoriaId: posicao.categoriaId, ordem: posicao.ordem } : i;
      }),
    );
  }

  private marcarSalvando(id: string, ativo: boolean) {
    this.salvando.update((atual) => {
      const novo = new Set(atual);
      if (ativo) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  private destacar(id: string) {
    this.destaques.update((atual) => new Set(atual).add(id));
    setTimeout(() => {
      this.destaques.update((atual) => {
        const novo = new Set(atual);
        novo.delete(id);
        return novo;
      });
    }, DURACAO_DESTAQUE_MS);
  }
}
