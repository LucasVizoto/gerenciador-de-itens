import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Sobrelinha + título dos cabeçalhos em gradiente azul, com ícones do Font Awesome.
 * O texto do título vem por conteúdo: `<app-titulo-pagina ...>Sistemas</app-titulo-pagina>`.
 */
@Component({
  selector: 'app-titulo-pagina',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <p class="eyebrow flex items-center gap-2">
      @if (iconeSobrelinha(); as icone) {
        <fa-icon [icon]="icone" class="text-[12px] text-brand-300" />
      }
      {{ sobrelinha() }}
    </p>
    <h1 class="mt-3 flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
      <span
        class="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-xl text-brand-200 ring-1 ring-white/15 print:hidden"
        aria-hidden="true"
      >
        <fa-icon [icon]="icone()" />
      </span>
      <span class="min-w-0"><ng-content /></span>
    </h1>
  `,
})
export class TituloPagina {
  readonly sobrelinha = input.required<string>();
  readonly icone = input.required<IconDefinition>();
  readonly iconeSobrelinha = input<IconDefinition | null>(null);
}
