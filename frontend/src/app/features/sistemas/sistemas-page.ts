import { ChangeDetectionStrategy, Component, OnInit, booleanAttribute, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { faHeart, faLayerGroup, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import { formatarData, formatarPercentual } from '../../core/dominio';
import type { DadosSistema, SistemaComResumo } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';
import { Modal } from '../../shared/modal';
import { TituloPagina } from '../../shared/titulo-pagina';
import { VoltarTopo } from '../../shared/voltar-topo';
import { SistemaForm } from './sistema-form';

@Component({
  selector: 'app-sistemas-page',
  imports: [RouterLink, Icone, Modal, SistemaForm, TituloPagina, VoltarTopo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sistemas-page.html',
})
export class SistemasPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Página Favoritos: vem do `data` da rota. */
  readonly somenteFavoritos = input(false, { transform: booleanAttribute });

  protected readonly sistemas = signal<SistemaComResumo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly criando = signal(false);
  protected readonly salvando = signal(false);

  protected readonly icones = { conformidade: faShieldHalved, sistemas: faLayerGroup, favoritos: faHeart };
  protected readonly formatarPercentual = formatarPercentual;
  protected readonly formatarData = formatarData;

  async ngOnInit() {
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

  /** Marca/desmarca na hora e desfaz se a API falhar. Na lista geral o card não muda de lugar. */
  protected async alternarFavorito(sistema: SistemaComResumo, evento: Event) {
    evento.preventDefault();
    evento.stopPropagation();
    const favorito = !sistema.favorito;
    const aplicar = (valor: boolean) =>
      this.sistemas.update((lista) => lista.map((item) => (item.id === sistema.id ? { ...item, favorito: valor } : item)));

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
    if (!confirm(`Excluir o sistema "${sistema.nome}" com todas as etapas e itens? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await this.api.removerSistema(sistema.id);
      this.sistemas.update((lista) => lista.filter((item) => item.id !== sistema.id));
      this.toast.sucesso('Sistema excluído.');
    } catch (erro) {
      this.toast.erro(mensagemDeErro(erro));
    }
  }
}
