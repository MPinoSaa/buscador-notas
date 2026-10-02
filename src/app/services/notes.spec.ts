import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

let snapshotCb: (s: any) => void;

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(),
  persistentMultipleTabManager: vi.fn(),
  collection: vi.fn(),
  addDoc: vi.fn(),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(),
  onSnapshot: vi.fn((_ref: unknown, cb: (s: any) => void) => { snapshotCb = cb; })
}));

import { NotesService, normalizeText, highlight, snippet } from './notes';

const docOf = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe('normalizeText', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizeText('Configuración ÁÉÍ')).toBe('configuracion aei');
  });
});

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(() => {
    service = TestBed.inject(NotesService);
    snapshotCb({
      docs: [
        docOf('1', { title: 'Backup', content: 'Configuración del servidor', tag: 'SERVIDORES', createdAt: 1 }),
        docOf('2', { title: 'Alta de usuario', content: 'Pasos', tag: 'PROCEDIMIENTOS', createdAt: 3 }),
        docOf('3', { title: 'Sin fecha', content: 'x' })
      ]
    });
  });

  it('marca como cargado y ordena por fecha descendente (sin fecha al final)', () => {
    expect(service.loaded()).toBe(true);
    expect(service.notes().map(n => n.id)).toEqual(['2', '1', '3']);
  });

  it('asigna "Sin definir" a notas sin etiqueta', () => {
    expect(service.notes().find(n => n.id === '3')?.tag).toBe('Sin definir');
  });

  it('busca sin distinguir tildes ni mayúsculas', () => {
    expect(service.search('CONFIGURACION').map(n => n.id)).toEqual(['1']);
  });

  it('filtra por etiqueta y combina con la búsqueda', () => {
    expect(service.search('', 'PROCEDIMIENTOS').map(n => n.id)).toEqual(['2']);
    expect(service.search('pasos', 'SERVIDORES')).toEqual([]);
  });

  it('expone las etiquetas existentes', () => {
    expect(service.tags()).toEqual(['PROCEDIMIENTOS', 'SERVIDORES', 'Sin definir']);
  });
});

describe('highlight y snippet', () => {
  it('marca coincidencias ignorando tildes', () => {
    expect(highlight('Configuración de red', 'configuracion')).toEqual([
      { text: 'Configuración', match: true },
      { text: ' de red', match: false }
    ]);
  });

  it('sin consulta devuelve el texto completo', () => {
    expect(highlight('hola', ' ')).toEqual([{ text: 'hola', match: false }]);
  });

  it('el fragmento se centra en la coincidencia', () => {
    const text = 'a'.repeat(300) + 'aguja' + 'b'.repeat(300);
    expect(snippet(text, 'aguja')).toContain('aguja');
  });
});
