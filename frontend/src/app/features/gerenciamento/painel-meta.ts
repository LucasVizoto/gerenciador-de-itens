import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatarPercentual, plural } from '../../core/dominio';
import type { Resumo } from '../../core/models';

type Situacao = 'vazio' | 'atingida' | 'inalcancavel' | 'andamento';

const ESTILO_BANNER: Record<Situacao, string> = {
  vazio: 'border-line bg-surface-2 text-muted',
  andamento: 'border-line bg-surface-2 text-ink-soft',
  atingida:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
  inalcancavel: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200',
};

/** Indicadores da meta: essenciais (meta configurável), obrigatórios (100%) e pendências. */
@Component({
  selector: 'app-painel-meta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr]">
      <div class="card col-span-2 p-4 md:col-span-1">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">Essenciais · meta {{ meta() }}%</p>
        <p class="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{{ percentual() }}</p>
        <div class="relative my-2.5 h-2 overflow-hidden rounded-full bg-surface-3">
          <div class="h-full rounded-full bg-brand-500 transition-[width] duration-300" [style.width.%]="resumo().essenciais.percentual"></div>
          <div class="absolute inset-y-0 w-0.5 bg-ink/60" [style.left.%]="meta()" title="Meta"></div>
        </div>
        <p class="text-xs text-muted tabular-nums">
          {{ resumo().essenciais.atendidos }} de {{ resumo().essenciais.total }} atendidos · mínimo {{ resumo().essenciais.minimo }}
        </p>
      </div>
      <div class="card p-4">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">Obrigatórios · meta 100%</p>
        <p class="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">
          {{ resumo().obrigatorios.atendidos }} <span class="text-faint">/</span> {{ resumo().obrigatorios.total }}
        </p>
        <p class="mt-2.5 text-xs text-muted tabular-nums">{{ resumo().obrigatorios.percentual.toFixed(0) }}% atendidos</p>
      </div>
      <div class="card p-4">
        <p class="text-xs font-medium tracking-wide text-muted uppercase">Essenciais pendentes</p>
        <p class="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{{ resumo().essenciais.pendentes }}</p>
        <p class="mt-2.5 text-xs text-muted tabular-nums">
          {{ resumo().essenciais.naoAtendidos }} não atendidos
        </p>
      </div>
    </div>
  `,
})
export class PainelMeta {
  readonly resumo = input.required<Resumo>();
  readonly meta = input.required<number>();

  protected readonly percentual = computed(() => formatarPercentual(this.resumo().essenciais.percentual));
}

/** Mensagem de status da meta (mesma lógica do checklist original, com aviso de meta inalcançável). */
export function situacaoDaMeta(r: Resumo, meta: number): { texto: string; estilo: string } {
  const faltamEssenciais = Math.max(0, r.essenciais.minimo - r.essenciais.atendidos);
  const faltamObrigatorios = r.obrigatorios.total - r.obrigatorios.atendidos;
  const maximoPossivel = r.essenciais.atendidos + r.essenciais.pendentes;

  let situacao: Situacao = 'andamento';
  let texto: string;

  if (r.totalItens === 0) {
    situacao = 'vazio';
    texto = 'Importe a planilha de itens do edital (CSV) para acompanhar a meta.';
  } else if (r.metaAtingida) {
    situacao = 'atingida';
    texto = 'Meta de atendimento atingida · essenciais e obrigatórios completos para o limiar.';
  } else if (maximoPossivel < r.essenciais.minimo) {
    situacao = 'inalcancavel';
    texto =
      `Meta de ${meta}% inalcançável: mesmo atendendo os ${r.essenciais.pendentes} pendentes, ` +
      `seriam ${maximoPossivel} dos ${r.essenciais.minimo} essenciais necessários.`;
  } else if (faltamEssenciais === 0) {
    texto = `${meta}% dos essenciais atingidos · ${faltar(faltamObrigatorios, 'obrigatório', 'obrigatórios')}.`;
  } else {
    texto =
      `Para atingir ${meta}%, ${faltar(faltamEssenciais, 'essencial atendido', 'essenciais atendidos')}` +
      (faltamObrigatorios > 0 ? ` e ${plural(faltamObrigatorios, 'obrigatório', 'obrigatórios')}.` : '.');
  }

  return { texto, estilo: ESTILO_BANNER[situacao] };
}

const faltar = (quantidade: number, singular: string, varios: string) =>
  `${quantidade === 1 ? 'falta' : 'faltam'} ${plural(quantidade, singular, varios)}`;
