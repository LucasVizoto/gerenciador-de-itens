import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  booleanAttribute,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { CdkDrag, type CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { faHeart, faLayerGroup, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { ConfirmacaoService } from '../../core/confirmacao.service';
import { formatarData, formatarPercentual, plural } from '../../core/dominio';
import type { DadosSistema, SistemaComResumo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { Modal } from '../../shared/modal';
import { TituloPagina } from '../../shared/titulo-pagina';
import { VoltarTopo } from '../../shared/voltar-topo';
import {
  ORDENS_POR_PAGINA,
  type OrdemSistemas,
  type PaginaSistemas,
  filtrarSistemas,
  lerOrdemSalva,
  ordenarSistemas,
  posicaoNaOrdem,
  salvarOrdem,
} from './ordenacao';
import { SistemaForm } from './sistema-form';

@Component({
  selector: 'app-sistemas-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    Icone,
    Modal,
    SistemaForm,
    TituloPagina,
    VoltarTopo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sistemas-page.html',
})
export class SistemasPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  /** Página Favoritos: vem do `data` da rota. */
  readonly somenteFavoritos = input(false, { transform: booleanAttribute });
  /** `?busca=` (vem da URL: a busca continua ao voltar da tela de um sistema). */
  readonly buscaUrl = input<string | undefined>(undefined, { alias: 'busca' });

  protected readonly pagina = computed<PaginaSistemas>(() => (this.somenteFavoritos() ? 'favoritos' : 'sistemas'));
  protected readonly sistemas = signal<SistemaComResumo[]>([]);
  protected readonly carregando = signal(true);

  /** Critério de ordenação (lembrado neste navegador, separado para Sistemas e Favoritos). */
  protected readonly ordem = linkedSignal<OrdemSistemas>(() => lerOrdemSalva(this.pagina()));
  protected readonly ordens = computed(() => ORDENS_POR_PAGINA[this.pagina()]);
  protected readonly sistemasOrdenados = computed(() => ordenarSistemas(this.sistemas(), this.ordem(), this.pagina()));

  protected readonly busca = signal('');
  protected readonly buscando = computed(() => this.busca().trim() !== '');
  /** O que aparece na grade: ordenado e filtrado pela busca. */
  protected readonly visiveis = computed(() => filtrarSistemas(this.sistemasOrdenados(), this.busca()));
  private readonly campoBusca = viewChild<ElementRef<HTMLInputElement>>('campoBusca');

  protected readonly plural = plural;
  /**
   * Na ordem personalizada os cards ganham a alça de arrastar (como os itens do edital). Com busca também:
   * só as posições dos sistemas visíveis são trocadas entre si.
   */
  protected readonly arrastavel = computed(() => this.ordem() === 'personalizada' && this.visiveis().length > 1);
  protected readonly criando = signal(false);
  protected readonly salvando = signal(false);

  protected readonly icones = { conformidade: faShieldHalved, sistemas: faLayerGroup, favoritos: faHeart };
  protected readonly formatarPercentual = formatarPercentual;
  protected readonly formatarData = formatarData;

  async ngOnInit() {
    this.busca.set(this.buscaUrl() ?? '');
    try {
      this.sistemas.set(await this.api.listarSistemas(this.somenteFavoritos()));
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  protected async criar(dados: DadosSistema) {
    this.salvando.set(true);
    try {
      const sistema = await this.api.criarSistema(dados);
      this.criando.set(false);
      this.toast.sucesso(`Sistema "${sistema.nome}" criado. Importe a planilha de itens do edital.`);
      await this.router.navigate(['/sistemas', sistema.id]);
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.salvando.set(false);
    }
  }

  protected mudarOrdem(valor: string) {
    const ordem = valor as OrdemSistemas;
    this.ordem.set(ordem);
    salvarOrdem(this.pagina(), ordem);
  }

  protected mudarBusca(valor: string) {
    this.busca.set(valor);
    void this.router.navigate([], { queryParams: { busca: valor.trim() ? valor : null }, replaceUrl: true });
  }

  protected limparBusca() {
    this.mudarBusca('');
    this.campoBusca()?.nativeElement.focus();
  }

  /**
   * Solta o card: aplica a nova ordem na hora e desfaz se a API falhar. Nos Sistemas muda a ordem geral
   * (para todos); em Favoritos, a ordem pessoal do usuário.
   */
  protected async soltar(evento: CdkDragDrop<unknown>) {
    if (evento.previousIndex === evento.currentIndex) return;
    const pagina = this.pagina();
    const antes = this.sistemas();
    const lista = [...this.visiveis()];
    moveItemInArray(lista, evento.previousIndex, evento.currentIndex);

    // Mesma regra da API: as posições que esses sistemas já ocupavam são redistribuídas na nova ordem.
    const posicoes = lista.map((s) => posicaoNaOrdem(s, pagina)).sort((a, b) => a - b);
    this.aplicarOrdem(pagina, new Map(lista.map((s, i) => [s.id, posicoes[i]])));
    try {
      const ids = lista.map((s) => s.id);
      const salvas = await (pagina === 'favoritos' ? this.api.reordenarFavoritos(ids) : this.api.reordenarSistemas(ids));
      this.aplicarOrdem(pagina, new Map(salvas.map((s) => [s.id, s.ordem])));
    } catch (erro) {
      this.sistemas.set(antes);
      this.toast.erro(`Não foi possível salvar a ordem: ${mensagemDeErro(erro)}`);
    }
  }

  private aplicarOrdem(pagina: PaginaSistemas, posicoes: Map<string, number>) {
    const campo = pagina === 'favoritos' ? 'ordemFavorito' : 'ordem';
    this.sistemas.update((lista) =>
      lista.map((s) => (posicoes.has(s.id) ? { ...s, [campo]: posicoes.get(s.id)! } : s)),
    );
  }

  /** Marca/desmarca na hora e desfaz se a API falhar. Na lista geral o card não muda de lugar. */
  protected async alternarFavorito(sistema: SistemaComResumo, evento: Event) {
    evento.preventDefault();
    evento.stopPropagation();
    const favorito = !sistema.favorito;
    const antes = sistema.ordemFavorito;
    // Como na API, o favorito novo entra no topo da ordem pessoal.
    const topo = Math.min(1, ...this.sistemas().map((s) => s.ordemFavorito ?? 1)) - 1;
    const aplicar = (valor: boolean) =>
      this.sistemas.update((lista) =>
        lista.map((item) =>
          item.id === sistema.id ? { ...item, favorito: valor, ordemFavorito: valor ? (antes ?? topo) : null } : item,
        ),
      );

    aplicar(favorito);
    try {
      await (favorito ? this.api.favoritar(sistema.id) : this.api.desfavoritar(sistema.id));
      if (!favorito && this.somenteFavoritos()) {
        this.sistemas.update((lista) => lista.filter((item) => item.id !== sistema.id));
      }
    } catch (erro) {
      aplicar(!favorito);
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected async remover(sistema: SistemaComResumo, evento: Event) {
    evento.preventDefault();
    evento.stopPropagation();
    const confirmado = await this.confirmacao.confirmar({
      titulo: 'Excluir sistema',
      mensagem: `O sistema "${sistema.nome}" será excluído com todas as etapas e itens. Esta ação não pode ser desfeita.`,
      confirmar: 'Excluir sistema',
    });
    if (!confirmado) return;
    try {
      await this.api.removerSistema(sistema.id);
      this.sistemas.update((lista) => lista.filter((item) => item.id !== sistema.id));
      this.toast.sucesso('Sistema excluído.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }
}
