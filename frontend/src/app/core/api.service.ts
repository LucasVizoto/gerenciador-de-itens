import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type {
  Categoria,
  DadosItem,
  DadosSistema,
  Item,
  PosicaoItem,
  ResultadoImportacao,
  Sistema,
  SistemaComResumo,
  SistemaDetalhe,
} from './models';

/** Sempre relativo: em dev o proxy do Angular encaminha /api, no Docker quem encaminha é o Nginx. */
const API = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private enviar<T>(requisicao: Observable<T>): Promise<T> {
    return firstValueFrom(requisicao);
  }

  listarSistemas() {
    return this.enviar(this.http.get<SistemaComResumo[]>(`${API}/sistemas`));
  }

  obterSistema(id: string) {
    return this.enviar(this.http.get<SistemaDetalhe>(`${API}/sistemas/${id}`));
  }

  criarSistema(dados: DadosSistema) {
    return this.enviar(this.http.post<Sistema>(`${API}/sistemas`, dados));
  }

  atualizarSistema(id: string, dados: DadosSistema) {
    return this.enviar(this.http.put<Sistema>(`${API}/sistemas/${id}`, dados));
  }

  removerSistema(id: string) {
    return this.enviar(this.http.delete<void>(`${API}/sistemas/${id}`));
  }

  reiniciarAvaliacao(sistemaId: string) {
    return this.enviar(this.http.post<{ reiniciados: number }>(`${API}/sistemas/${sistemaId}/reiniciar`, {}));
  }

  urlExportacao(sistemaId: string) {
    return `${API}/sistemas/${sistemaId}/exportar`;
  }

  criarCategoria(sistemaId: string, nome: string) {
    return this.enviar(this.http.post<Categoria>(`${API}/sistemas/${sistemaId}/categorias`, { nome }));
  }

  renomearCategoria(id: string, nome: string) {
    return this.enviar(this.http.patch<Categoria>(`${API}/categorias/${id}`, { nome }));
  }

  removerCategoria(id: string) {
    return this.enviar(this.http.delete<void>(`${API}/categorias/${id}`));
  }

  reordenarCategorias(sistemaId: string, ids: string[]) {
    return this.enviar(this.http.put<Categoria[]>(`${API}/sistemas/${sistemaId}/categorias/ordem`, { ids }));
  }

  criarItem(sistemaId: string, dados: DadosItem) {
    return this.enviar(this.http.post<Item>(`${API}/sistemas/${sistemaId}/itens`, dados));
  }

  atualizarItem(id: string, dados: DadosItem) {
    return this.enviar(this.http.patch<Item>(`${API}/itens/${id}`, dados));
  }

  removerItem(id: string) {
    return this.enviar(this.http.delete<void>(`${API}/itens/${id}`));
  }

  reordenarItens(sistemaId: string, itens: PosicaoItem[]) {
    return this.enviar(this.http.put<{ atualizados: number }>(`${API}/sistemas/${sistemaId}/itens/ordem`, { itens }));
  }

  importarCsv(sistemaId: string, arquivo: File) {
    const formulario = new FormData();
    formulario.append('arquivo', arquivo, arquivo.name);
    return this.enviar(
      this.http.post<ResultadoImportacao>(`${API}/sistemas/${sistemaId}/itens/importar`, formulario),
    );
  }
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) return 'Não foi possível conectar à API. Verifique se o backend está no ar.';
    const corpo = erro.error as { mensagem?: string; erros?: Array<{ mensagem: string }> } | null;
    const detalhe = corpo?.erros?.[0]?.mensagem;
    if (corpo?.mensagem) return detalhe ? `${corpo.mensagem}: ${detalhe}` : corpo.mensagem;
    return `Erro ${erro.status} ao comunicar com a API.`;
  }
  return erro instanceof Error ? erro.message : 'Erro inesperado.';
}
