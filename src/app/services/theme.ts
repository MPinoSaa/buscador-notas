import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'darkMode';

// Tema compartido por todas las páginas. Respeta la preferencia guardada y,
// si no hay ninguna, la del sistema (prefers-color-scheme).
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly dark = signal(this.initial());

  constructor() {
    effect(() => {
      if (typeof document !== 'undefined') {
        document.body.classList.toggle('dark-body', this.dark());
      }
    });
  }

  toggle() {
    const next = !this.dark();
    this.dark.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch { /* almacenamiento no disponible */ }
  }

  private initial(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) return saved === 'true';
    } catch { /* ignorar */ }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
