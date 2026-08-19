import { Injectable, NgZone } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface Note {
  id?: string;
  title: string;
  content: string;
  tag: string;
  creatorEmail?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private db;
  private notesRef;
  private notes: Note[] = [];
  public onDataChange: () => void = () => {};

  private firebaseConfig = {
    apiKey: "AIzaSyBBa7pGw9FCFCs3_EdvNVWgEk-izd1oqQk",
    authDomain: "buscador-notas.firebaseapp.com",
    projectId: "buscador-notas",
    storageBucket: "buscador-notas.firebasestorage.app",
    messagingSenderId: "748370186114",
    appId: "1:748370186114:web:23b95c89bea7e6cbe1099b"
  };

  // 1. Inyectamos NgZone aquí
  constructor (private zone: NgZone) {
    const app = initializeApp(this.firebaseConfig); 
    this.db = getFirestore(app); 
    this.notesRef = collection(this.db, 'notas'); 

    // 2. Envolvemos la escucha de Firebase en la Zona de Angular.
    // Esto garantiza que CUALQUIER cambio en BD repinte la pantalla instantáneamente.
    onSnapshot(this.notesRef, (snapshot) => {
      this.zone.run(() => {
        this.notes = snapshot.docs.map(doc => ({
          id: doc.id,
          title: doc.data()['title'],
          content: doc.data()['content'],
          tag: doc.data()['tag'] || 'Sin definir',
          creatorEmail: doc.data()['creatorEmail']
        }));
        this.onDataChange(); 
      });
    });
  }

  async addNote(note: Note) {
    try {
      const docRef = await addDoc(collection(this.db, 'notas'), {
        title: note.title,
        content: note.content,
        tag: note.tag,
        creatorEmail: note.creatorEmail || 'desconocido' 
      });
    } catch (error) {
      console.error("Error agregando nota: ", error);
    }
  }

  searchNotes(query: string, tagFilter: string = ''): Note[] {
    let filtered = this.notes;

    if (tagFilter) {
      filtered = filtered.filter(note => note.tag === tagFilter);
    }

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery)
      );
    }
    return filtered;
  }

  async updateNote(id: string, title: string, content: string, tag: string) {
    const noteRef = doc(this.db, 'notas', id);
    await updateDoc(noteRef, { title, content, tag });
  }

  async deleteNote(id: string) {
    const noteRef = doc(this.db, 'notas', id);
    await deleteDoc(noteRef);
  }
}