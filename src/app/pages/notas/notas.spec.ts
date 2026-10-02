import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { vi } from 'vitest';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(), isVisible: () => false } }));

import { NotasComponent } from './notas';
import { NotesService, Note, normalizeText } from '../../services/notes';
import { AuthService } from '../../services/auth';
import { AiService } from '../../services/ai';
import Swal from 'sweetalert2';

const makeNotes = (n: number): Note[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${i}`, title: `Nota ${i}`, content: 'texto', tag: 'OTROS', creatorEmail: 'a@a.com' }));

describe('NotasComponent', () => {
  const notes = signal<Note[]>(makeNotes(20));
  const user = signal<{ email: string } | null>({ email: 'a@a.com' });
  const ai = { restructure: vi.fn(), saveExample: vi.fn() };
  const updateNote = vi.fn();

  beforeEach(async () => {
    notes.set(makeNotes(20));
    ai.restructure.mockReset().mockResolvedValue({ content: 'OBJETIVO\n1. Paso', redacted: 0 });
    vi.mocked(Swal.fire).mockReset();
    ai.saveExample.mockReset();
    updateNote.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [NotasComponent],
      providers: [
        provideRouter([]),
        {
          provide: NotesService,
          useValue: {
            notes,
            loaded: signal(true),
            error: signal(false),
            tags: computed(() => ['OTROS']),
            updateNote,
            search: (q: string, tag: string) =>
              notes().filter(n => (!tag || n.tag === tag) && normalizeText(n.title).includes(normalizeText(q)))
          }
        },
        { provide: AiService, useValue: ai },
        { provide: AuthService, useValue: { user, isAdmin: computed(() => false) } }
      ]
    }).compileComponents();
  });

  it('pagina de 9 en 9', () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    expect(c.totalPages()).toBe(3);
    expect(c.paginatedNotes().length).toBe(9);
    c.nextPage();
    c.nextPage();
    expect(c.page()).toBe(3);
    expect(c.paginatedNotes().length).toBe(2);
  });

  it('ajusta la página si los datos se reducen, sin saltar a la 1', () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.nextPage();
    c.nextPage();
    notes.set(makeNotes(12));
    expect(c.page()).toBe(2);
  });

  it('filtrar por etiqueta vuelve a la página 1 y alterna al repetir', () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.nextPage();
    c.setTagFilter('OTROS');
    expect(c.page()).toBe(1);
    c.setTagFilter('OTROS');
    expect(c.selectedTagFilter()).toBe('');
  });

  it('solo el dueño puede modificar una nota', () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.openNote({ id: '1', title: 't', content: 'c', tag: 'OTROS', creatorEmail: 'a@a.com' });
    expect(c.canModify()).toBe(true);
    c.openNote({ id: '2', title: 't', content: 'c', tag: 'OTROS', creatorEmail: 'otro@a.com' });
    expect(c.canModify()).toBe(false);
  });

  it('al crear una nota se puede elegir categoría existente o escribir una nueva', () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.createNote();
    expect(c.isEditing()).toBe(true);
    expect(c.canModify()).toBe(true);
    c.onTagSelect('SERVIDORES');
    expect(c.editTag()).toBe('SERVIDORES');
    expect(c.customTag()).toBe(false);
    c.onTagSelect('__nueva__');
    expect(c.customTag()).toBe(true);
    expect(c.editTag()).toBe('');
  });

  it('la IA propone una reestructuración que se aplica al editor sin guardar', async () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.openNote({ id: '1', title: 't', content: 'paso uno luego paso dos', tag: 'PROCEDIMIENTOS', creatorEmail: 'a@a.com' });
    await c.improveWithAi();
    expect(c.aiPreview()).toBe('OBJETIVO\n1. Paso');
    expect(c.aiLoading()).toBe(false);
    c.applyAiPreview();
    expect(c.aiPreview()).toBeNull();
    expect(c.isEditing()).toBe(true);
    expect(c.editContent()).toBe('OBJETIVO\n1. Paso');
  });

  it('descartar la propuesta no cambia la nota', async () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.openNote({ id: '1', title: 't', content: 'original', tag: 'OTROS', creatorEmail: 'a@a.com' });
    await c.improveWithAi();
    c.discardAiPreview();
    expect(c.aiPreview()).toBeNull();
    expect(c.selectedNote()?.content).toBe('original');
  });

  it('al guardar la versión final de una propuesta de IA se registra el ejemplo', async () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.openNote({ id: '1', title: 't', content: 'texto desordenado', tag: 'PROCEDIMIENTOS', creatorEmail: 'a@a.com' });
    await c.improveWithAi();
    c.applyAiPreview();
    c.editContent.set('OBJETIVO\n1. Paso (retocado)');
    await c.saveNote();
    expect(updateNote).toHaveBeenCalled();
    expect(ai.saveExample).toHaveBeenCalledWith({
      title: 't',
      tag: 'PROCEDIMIENTOS',
      original: 'texto desordenado',
      final: 'OBJETIVO\n1. Paso (retocado)'
    });
  });

  describe('notas con credenciales', () => {
    const secretNote = { id: '1', title: 'Acceso', content: 'servidor 10.0.0.1 password: hunter2', tag: 'SERVIDORES', creatorEmail: 'a@a.com' };

    it('pide confirmación antes de enviar a la IA y respeta la cancelación', async () => {
      vi.mocked(Swal.fire).mockResolvedValue({ isConfirmed: false } as never);
      const c = TestBed.createComponent(NotasComponent).componentInstance;
      c.openNote(secretNote);
      await c.improveWithAi();
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning' }));
      expect(ai.restructure).not.toHaveBeenCalled();
    });

    it('si el usuario confirma, envía la nota y muestra cuántos datos se ocultaron', async () => {
      vi.mocked(Swal.fire).mockResolvedValue({ isConfirmed: true } as never);
      ai.restructure.mockResolvedValue({ content: 'propuesta', redacted: 2 });
      const c = TestBed.createComponent(NotasComponent).componentInstance;
      c.openNote(secretNote);
      await c.improveWithAi();
      expect(ai.restructure).toHaveBeenCalled();
      expect(c.aiRedacted()).toBe(2);
    });

    it('las notas sin credenciales no piden confirmación', async () => {
      const c = TestBed.createComponent(NotasComponent).componentInstance;
      c.openNote({ ...secretNote, content: 'reiniciar nginx y revisar el estado' });
      await c.improveWithAi();
      expect(Swal.fire).not.toHaveBeenCalled();
      expect(ai.restructure).toHaveBeenCalled();
    });

    it('el editor avisa mientras el texto parece traer credenciales', () => {
      const c = TestBed.createComponent(NotasComponent).componentInstance;
      c.openNote(secretNote);
      c.toggleEdit();
      expect(c.editHasSecrets()).toBe(true);
      c.editContent.set('solo texto normal con la IP 10.0.0.1');
      expect(c.editHasSecrets()).toBe(false);
    });
  });

  it('editar a mano sin usar la IA no registra ejemplos', async () => {
    const c = TestBed.createComponent(NotasComponent).componentInstance;
    c.openNote({ id: '1', title: 't', content: 'x', tag: 'OTROS', creatorEmail: 'a@a.com' });
    c.toggleEdit();
    c.editContent.set('y');
    await c.saveNote();
    expect(updateNote).toHaveBeenCalled();
    expect(ai.saveExample).not.toHaveBeenCalled();
  });
});
