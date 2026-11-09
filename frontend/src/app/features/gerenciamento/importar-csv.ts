import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ApiService, mensagemDeErro } from '../../core/api.service';
import type { ResultadoImportacao } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icone } from '../../shared/icone';

/** Botão de importação: abre o seletor de arquivo e envia o CSV (multipart) para a API. */
@Component({
  selector: 'app-importar-csv',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <input #arquivo type="file" accept=".csv,text/csv" class="hidden" (change)="selecionar(arquivo)" />
    <button type="button" class="btn btn-primary" [disabled]="enviando()" (click)="arquivo.click()">
      @if (enviando()) {
        <span class="spinner"></span> Importando…
      } @else {
        <app-icone nome="upload" /> Importar CSV
      }
    </button>
  `,
})
export class ImportarCsv {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly sistemaId = input.required<string>();
  readonly importado = output<ResultadoImportacao>();

  protected readonly enviando = signal(false);

  protected async selecionar(campo: HTMLInputElement) {
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) return;

    this.enviando.set(true);
    try {
      this.importado.emit(await this.api.importarCsv(this.sistemaId(), arquivo));
    } catch (erro) {
      this.toast.erro(`Falha ao importar "${arquivo.name}": ${mensagemDeErro(erro)}`);
    } finally {
      this.enviando.set(false);
    }
  }
}
