import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NotesService, Note } from './services/notes';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit{
  searchTerm = '';
  notes: Note[] = [];

  selectedNote: Note | null = null;
  isEditing = false;
  isDarkMode = false;
  newTagToUpload = '';

  constructor(
    private notesService: NotesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('darkMode');
      if (savedTheme === 'true') {
        this.isDarkMode = true;
        document.body.classList.add('dark-body');
    }
  }
    this.onSearch(); // Cargamos las notas que bajo el Firebase  
    this.notesService.onDataChange = () => { // Se queda escuchando futuros cambios en tiempo real
      this.onSearch();
      this.cdr.detectChanges();
    };
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('darkMode', this.isDarkMode.toString());
    }
    if (this.isDarkMode) {
      document.body.classList.add('dark-body');
    } else {
      document.body.classList.remove('dark-body');
    }
  }

  onSearch() {
    this.notes = this.notesService.searchNotes(this.searchTerm);
  }

  // Permite procesar los archivos .txt subidos
  onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const newTitle = file.name.replace('.txt', '')
      const isDuplicate = this.notes.some(n => n.title.toLowerCase() === newTitle.toLocaleLowerCase())

      if (isDuplicate) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: `Omitido: "${newTitle}" ya existe.`,
          showConfirmButton: false,
          timer: 3500
        });
        continue; 
      }
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const newNote: Note = {
          title: newTitle,
          content: e.target.result,
          tag: this.newTagToUpload.trim() !== '' ? this.newTagToUpload.trim() : 'Sin definir'
        };

        await this.notesService.addNote(newNote);

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Nota cargada',
          showConfirmButton: false,
          timer: 1500
        });
      };
      reader.readAsText(file);
    }
    event.target.value = '';
    this.newTagToUpload = '';
  }

  // Vista detallada
  openNote(note: Note) {
    this.selectedNote = { ...note }; 
    this.isEditing = false;
  }

  closeNote() {
    this.selectedNote = null;
    this.isEditing = false;
    this.cdr.detectChanges();
  }

  toggleEdit() {
    this.isEditing = true;
  }

  async saveNote() {
    if (this.selectedNote && this.selectedNote.id) {
      await this.notesService.updateNote(
        this.selectedNote.id, 
        this.selectedNote.title, 
        this.selectedNote.content,
        this.selectedNote.tag
      );
      this.isEditing = false;

      Swal.fire({
        icon: 'success',
        title: '¡Guardado!',
        text: 'La nota se ha actualizado correctamente.',
        timer: 2000,
        showConfirmButton: false
      });
    }
  }

  async deleteSelectedNote() {
    if (this.selectedNote && this.selectedNote.id) {
      const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3b82f6',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        await this.notesService.deleteNote(this.selectedNote.id);
        this.closeNote();
        Swal.fire(
          '¡Eliminada!',
          'Tu nota ha sido borrada.',
          'success'
        );
      }
    }
  }
}