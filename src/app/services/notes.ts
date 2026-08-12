import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface Note {
  id?: string;
  title: string;
  content: string;
  tag: string;
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

  constructor () {
    const app = initializeApp(this.firebaseConfig); // Inicializar conexión al proyecto
    this.db = getFirestore(app); // Conectar a la base de datos Firestore
    this.notesRef = collection(this.db, 'notas'); // Apuntamos a una "colección" llamada 'notas'

    // Escuchar la nube en tiempo real
    onSnapshot(this.notesRef, (snapshot) => {
      this.notes = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data()['title'],
        content: doc.data()['content'],
        tag: doc.data()['tag'] || 'Sin definir'
      }));
      this.onDataChange(); // Realiza la actualización visual
    })
  }

  // Guardar notas en Firebase
  async addNote(note: Note) {
    await addDoc(this.notesRef, {
      title: note.title,
      content: note.content,
      tag: note.tag
    });
  }


  // Búsqueda local sobre los datos ya cargados
  searchNotes(query: string): Note[] {
    if (!query.trim()) return this.notes; // Si no hay búsqueda, devuelve todo
    const lowerQuery = query.toLowerCase(); // Filtra buscando coincidencias en el título o en el contenido
    return this.notes.filter(note => 
      note.title.toLowerCase().includes(lowerQuery) || 
      note.content.toLowerCase().includes(lowerQuery)
    );
  }

  // Actualizar las notas
  async updateNote(id: string, title: string, content: string, tag: string) {
    const noteRef = doc(this.db, 'notas', id);
    await updateDoc(noteRef, { title, content, tag });
  }

  // Eliminar las notas
  async deleteNote(id: string) {
    const noteRef = doc(this.db, 'notas', id);
    await deleteDoc(noteRef);
  }
}