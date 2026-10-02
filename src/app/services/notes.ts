import { Injectable, NgZone, computed, signal } from '@angular/core';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firestore';

export interface Note {
  id?: string;
  title: string;
  content: string;
  tag: string;
  creatorEmail?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Minúsculas y sin tildes: "Configuración" coincide con "configuracion"
export function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private notesRef = collection(db, 'notas');

  private readonly _notes = signal<Note[]>([]);
  private readonly _loaded = signal(false);
  private readonly _error = signal(false);

  readonly notes = this._notes.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly error = this._error.asReadonly();

  // Texto normalizado de cada nota, calculado una sola vez por cambio de datos (no por tecla)
  private readonly index = computed(() =>
    this._notes().map(note => ({ note, text: normalizeText(`${note.title}\n${note.content}`) }))
  );

  // Etiquetas existentes, para los filtros
  readonly tags = computed(() =>
    [...new Set(this._notes().map(n => n.tag))].sort((a, b) => a.localeCompare(b))
  );

  constructor(private zone: NgZone) {
    // Servicio singleton: la escucha vive mientras viva la app
    onSnapshot(
      this.notesRef,
      (snapshot) => {
        this.zone.run(() => {
          const notes = snapshot.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              title: data['title'] ?? '',
              content: data['content'] ?? '',
              tag: data['tag'] || 'Sin definir',
              creatorEmail: data['creatorEmail'],
              createdAt: data['createdAt'],
              updatedAt: data['updatedAt']
            } as Note;
          });
          // Más recientes primero; las notas antiguas sin fecha quedan al final, por título
          notes.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0) || a.title.localeCompare(b.title));
          this._notes.set(notes);
          this._loaded.set(true);
          this._error.set(false);
        });
      },
      (error) => {
        console.error('Error escuchando notas:', error);
        this.zone.run(() => {
          this._error.set(true);
          this._loaded.set(true);
        });
      }
    );
  }

  // Los errores se propagan para que quien llama pueda informar al usuario
  async addNote(note: Note) {
    await addDoc(this.notesRef, {
      title: note.title,
      content: note.content,
      tag: note.tag,
      creatorEmail: note.creatorEmail || 'desconocido',
      createdAt: Date.now()
    });
  }

  search(query: string, tagFilter: string = ''): Note[] {
    const q = normalizeText(query.trim());
    return this.index()
      .filter(entry => (!tagFilter || entry.note.tag === tagFilter) && (!q || entry.text.includes(q)))
      .map(entry => entry.note);
  }

  async updateNote(id: string, title: string, content: string, tag: string) {
    await updateDoc(doc(db, 'notas', id), { title, content, tag, updatedAt: Date.now() });
  }

  async deleteNote(id: string) {
    await deleteDoc(doc(db, 'notas', id));
  }

  async deleteNotes(ids: string[]) {
    // Firestore admite hasta 500 operaciones por batch
    for (let i = 0; i < ids.length; i += 500) {
      const batch = writeBatch(db);
      ids.slice(i, i + 500).forEach(id => batch.delete(doc(db, 'notas', id)));
      await batch.commit();
    }
  }
}

export interface TextPart {
  text: string;
  match: boolean;
}

// Divide el texto en trozos marcando las coincidencias (sin tildes ni mayúsculas).
// Devuelve partes de texto plano para pintarlas con <mark> sin usar innerHTML.
export function highlight(text: string, query: string): TextPart[] {
  const q = normalizeText(query.trim());
  const norm = normalizeText(text);
  // Si la normalización cambió el largo, los índices no coinciden: no resaltamos
  if (!q || norm.length !== text.length) return [{ text, match: false }];

  const parts: TextPart[] = [];
  let pos = 0;
  let idx = norm.indexOf(q);
  while (idx !== -1) {
    if (idx > pos) parts.push({ text: text.slice(pos, idx), match: false });
    parts.push({ text: text.slice(idx, idx + q.length), match: true });
    pos = idx + q.length;
    idx = norm.indexOf(q, pos);
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), match: false });
  return parts;
}

// Fragmento corto del contenido centrado en la primera coincidencia
export function snippet(content: string, query: string, length = 240): string {
  const q = normalizeText(query.trim());
  const norm = normalizeText(content);
  const idx = q && norm.length === content.length ? norm.indexOf(q) : -1;
  const start = idx > 60 ? idx - 60 : 0;
  const slice = content.slice(start, start + length);
  return (start > 0 ? '…' : '') + slice + (start + length < content.length ? '…' : '');
}
