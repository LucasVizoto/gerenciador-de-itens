import { Injectable } from '@angular/core';
import { CLIENT_ID } from './client-id';
import type { EventoEdital } from './models';

export type EstadoConexao = 'conectando' | 'online' | 'reconectando';

export interface OuvintesEdital {
  aoEvento: (evento: EventoEdital) => void;
  aoMudarEstado: (estado: EstadoConexao) => void;
  /** Chamado quando a conexão volta após uma queda: eventos podem ter sido perdidos. */
  aoReconectar: () => void;
}

/** Assina o stream SSE do sistema; o EventSource reconecta sozinho em caso de queda. */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  conectar(sistemaId: string, ouvintes: OuvintesEdital): () => void {
    const fonte = new EventSource(`/api/sistemas/${sistemaId}/eventos`);
    let caiu = false;
    ouvintes.aoMudarEstado('conectando');

    fonte.onopen = () => {
      if (caiu) ouvintes.aoReconectar();
      caiu = false;
      ouvintes.aoMudarEstado('online');
    };

    fonte.onerror = () => {
      caiu = true;
      ouvintes.aoMudarEstado('reconectando');
    };

    fonte.onmessage = (mensagem: MessageEvent<string>) => {
      const evento = JSON.parse(mensagem.data) as EventoEdital;
      if (evento.origem !== CLIENT_ID) ouvintes.aoEvento(evento);
    };

    return () => fonte.close();
  }
}
