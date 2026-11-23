import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { faCalendarDays, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ConfirmacaoService } from '../../core/confirmacao.service';
import { plural } from '../../core/dominio';
import type { Apresentacao, DadosApresentacao } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { Modal } from '../../shared/modal';
import { TituloPagina } from '../../shared/titulo-pagina';
import { VoltarTopo } from '../../shared/voltar-topo';
import {
  type DiaAgenda,
  agoraLocal,
  agruparPorDia,
  chaveDia,
  descreverDia,
  descreverPeriodo,
  duracao,
  faixaHorario,
  iniciais,
} from './agenda-util';
import { ApresentacaoForm, type EnvioApresentacao, type SugestaoApresentacao } from './apresentacao-form';

type Visao = 'geral' | 'minhas';

interface Edicao {
  apresentacao: Apresentacao | null;
  sugestao: SugestaoApresentacao | null;
}

const ordenar = (lista: Apresentacao[]) =>
  [...lista].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim),
  );

/** Agenda de apresentações: cronograma por dia, com a visão geral e a do usuário logado. */
@Component({
  selector: 'app-agenda-page',
  imports: [RouterLink, Icone, Modal, TituloPagina, VoltarTopo, ApresentacaoForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './agenda-page.html',
})
export class AgendaPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirmacao = inject(ConfirmacaoService);
  private readonly router = inject(Router);

  /** `?visao=minhas` (vem da URL, assim a visão sobrevive ao recarregar e pode ser compartilhada). */
  readonly visaoUrl = input<string | undefined>(undefined, { alias: 'visao' });
  protected readonly visao = computed<Visao>(() => (this.visaoUrl() === 'minhas' ? 'minhas' : 'geral'));

  protected readonly apresentacoes = signal<Apresentacao[]>([]);
  protected readonly carregando = signal(true);
  protected readonly salvando = signal(false);
  protected readonly edicao = signal<Edicao | null>(null);
  /** Atualizado a cada 30 s para os selos "Hoje" e "Agora". */
  protected readonly agora = signal(agoraLocal());

  private readonly formulario = viewChild(ApresentacaoForm);

  protected readonly icones = { conformidade: faShieldHalved, agenda: faCalendarDays };
  protected readonly faixaHorario = faixaHorario;
  protected readonly duracao = duracao;
  protected readonly iniciais = iniciais;
  protected readonly plural = plural;

  private readonly meuId = computed(() => this.auth.usuario()?.id ?? null);

  protected readonly minhas = computed(() => {
    const id = this.meuId();
    return id ? this.apresentacoes().filter((a) => a.apresentadorId === id || a.apoioId === id) : [];
  });

  protected readonly dias = computed<DiaAgenda[]>(() =>
    agruparPorDia(this.visao() === 'minhas' ? this.minhas() : this.apresentacoes()),
  );

  protected readonly periodo = computed(() => {
    const lista = this.apresentacoes();
    if (!lista.length) return null;
    return descreverPeriodo(chaveDia(lista[0].data), chaveDia(lista[lista.length - 1].data));
  });

  protected readonly totalDias = computed(() => new Set(this.apresentacoes().map((a) => chaveDia(a.data))).size);

  constructor() {
    const relogio = setInterval(() => this.agora.set(agoraLocal()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(relogio));
  }

  async ngOnInit() {
    try {
      this.apresentacoes.set(await this.api.listarApresentacoes());
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.carregando.set(false);
    }
  }

  protected mudarVisao(visao: Visao) {
    void this.router.navigate([], {
      queryParams: { visao: visao === 'minhas' ? 'minhas' : null },
      replaceUrl: true,
    });
  }

  /** Papel do usuário logado na apresentação ("Você apresenta", "Você dá apoio"), ou null. */
  protected meuPapel(apresentacao: Apresentacao): string | null {
    const id = this.meuId();
    if (!id) return null;
    const apresenta = apresentacao.apresentadorId === id;
    const apoia = apresentacao.apoioId === id;
    if (apresenta && apoia) return 'Você apresenta e dá apoio';
    if (apresenta) return 'Você apresenta';
    if (apoia) return 'Você dá apoio';
    return null;
  }

  protected souEu(id: string | null | undefined) {
    return !!id && id === this.meuId();
  }

  protected acontecendo(apresentacao: Apresentacao) {
    const { dia, horario } = this.agora();
    return chaveDia(apresentacao.data) === dia && apresentacao.inicio <= horario && horario < apresentacao.fim;
  }

  protected diaPassado(chave: string) {
    return chave < this.agora().dia;
  }

  protected nova(sugestao: SugestaoApresentacao | null = null) {
    this.edicao.set({ apresentacao: null, sugestao });
  }

  /** "Adicionar neste dia": mesmo dia e bloco, começando quando a última do dia termina. */
  protected novaNoDia(dia: DiaAgenda) {
    const ultima = dia.apresentacoes[dia.apresentacoes.length - 1];
    this.nova({ data: dia.chave, tema: dia.temas[0] ?? null, inicio: ultima?.fim });
  }

  protected editar(apresentacao: Apresentacao) {
    this.edicao.set({ apresentacao, sugestao: null });
  }

  protected async salvar({ dados, continuar }: EnvioApresentacao) {
    const emEdicao = this.edicao()?.apresentacao;
    this.salvando.set(true);
    try {
      const salva = emEdicao
        ? await this.api.atualizarApresentacao(emEdicao.id, dados)
        : await this.api.criarApresentacao(dados);
      this.apresentacoes.update((lista) => ordenar([...lista.filter((a) => a.id !== salva.id), salva]));
      this.toast.sucesso(emEdicao ? 'Apresentação atualizada.' : `${this.descrever(dados, salva)} agendada.`);
      if (continuar) this.formulario()?.prepararProxima(salva);
      else this.edicao.set(null);
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    } finally {
      this.salvando.set(false);
    }
  }

  protected async remover(apresentacao: Apresentacao) {
    const { semana, data } = descreverDia(chaveDia(apresentacao.data));
    const confirmado = await this.confirmacao.confirmar({
      titulo: 'Remover apresentação',
      mensagem: `${this.nomeNaAgenda(apresentacao)} (${semana}, ${data}, ${faixaHorario(apresentacao)}) sairá da agenda.`,
      confirmar: 'Remover',
      tom: 'perigo',
    });
    if (!confirmado) return;
    try {
      await this.api.removerApresentacao(apresentacao.id);
      this.apresentacoes.update((lista) => lista.filter((a) => a.id !== apresentacao.id));
      this.toast.sucesso('Apresentação removida da agenda.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }

  protected nomeNaAgenda(apresentacao: Apresentacao) {
    return apresentacao.sistema.nome + (apresentacao.complemento ? ` · ${apresentacao.complemento}` : '');
  }

  private descrever(dados: DadosApresentacao, salva: Apresentacao) {
    const { semana } = descreverDia(dados.data);
    return `${this.nomeNaAgenda(salva)} (${semana}, ${faixaHorario(salva)})`;
  }
}
