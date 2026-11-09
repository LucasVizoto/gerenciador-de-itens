import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Foca (e seleciona) o campo assim que ele aparece; `autofocus` nativo só vale no carregamento da página. */
@Directive({ selector: '[appAutoFoco]' })
export class AutoFoco implements AfterViewInit {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit() {
    const elemento = this.elemento.nativeElement;
    elemento.focus();
    if (elemento instanceof HTMLInputElement) elemento.select();
  }
}
