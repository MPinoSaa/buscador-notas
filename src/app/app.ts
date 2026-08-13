import { Component, ChangeDetectorRef, OnInit, NgZone } from '@angular/core';
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
export class App implements OnInit {
  searchTerm = '';
  notes: Note[] = [];
  
  selectedNote: Note | null = null;
  isEditing = false;
  isDarkMode = false;
  selectedTagFilter = '';

  // Variables para la paginación
  currentPage = 1;
  itemsPerPage = 10;

  constructor(
    private notesService: NotesService, 
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  // --- GETTERS DE PAGINACIÓN ---
  get totalPages(): number {
    return Math.ceil(this.notes.length / this.itemsPerPage) || 1;
  }

  get paginatedNotes(): Note[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.notes.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // --- INICIO Y CONFIGURACIÓN ---
  ngOnInit() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('darkMode');
      if (savedTheme === 'true') {
        this.isDarkMode = true;
        document.body.classList.add('dark-body');
      }
    }

    this.onSearch(); 
    
    // Vigila los cambios en la base de datos en tiempo real
    this.notesService.onDataChange = () => {
      this.zone.run(() => {
        this.onSearch();
        this.cdr.detectChanges();
      });
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

  // --- BÚSQUEDA Y FILTROS ---
  onSearch() {
    this.notes = this.notesService.searchNotes(this.searchTerm, this.selectedTagFilter);
    this.currentPage = 1; // Vuelve a la página 1 al buscar
  }

  filterByTag(tag: string, event: Event) {
    event.stopPropagation();
    this.selectedTagFilter = tag;
    this.onSearch();
  }

  clearTagFilter() {
    this.selectedTagFilter = '';
    this.onSearch();
  }

  // --- CONTROLES DE PAGINACIÓN ---
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // --- SUBIDA DE ARCHIVOS ---
  async onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    let uploadedCount = 0;
    let duplicatedCount = 0;
    
    for (let i = 0; i < files.length; i++) { 
      const file = files[i];
      const newTitle = file.name.replace('.txt', '');
      
      const isDuplicate = this.notes.some(n => n.title.toLowerCase() === newTitle.toLowerCase());
      if (isDuplicate) {
        duplicatedCount++;
        continue;
      }

      const { value: tagValue, isDismissed } = await Swal.fire({
        title: 'Asignar Etiqueta',
        text: `¿Qué etiqueta deseas para la nota: "${newTitle}"?`,
        input: 'text',
        inputPlaceholder: 'Ej. Procedimientos, Servidores...',
        showCancelButton: true,
        confirmButtonText: 'Subir archivo',
        cancelButtonText: 'Omitir archivo',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444'
      });

      if (isDismissed) continue;

      const finaltag = (tagValue && tagValue.trim() !== '') ? tagValue.trim() : 'Sin definir'; 

      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          const newNote: Note = { title: newTitle, content: e.target.result, tag: finaltag };
          await this.notesService.addNote(newNote);
          uploadedCount++;
          resolve(true);
        };
        reader.readAsText(file);
      });
    }

    event.target.value = ''; 

    if (uploadedCount > 0 && duplicatedCount === 0) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${uploadedCount} nota(s) cargada(s)`, showConfirmButton: false, timer: 2500 });
    } else if (uploadedCount > 0 && duplicatedCount > 0) {
      Swal.fire({ icon: 'info', title: 'Carga parcial', text: `Se subieron ${uploadedCount} notas. Se omitieron ${duplicatedCount} duplicadas.` });
    } else if (uploadedCount === 0 && duplicatedCount > 0) {
      Swal.fire({ icon: 'warning', title: 'Archivos Duplicados', text: 'No se subió nada. Todos los archivos ya existen.' });
    }

    // FORZAMOS A ANGULAR A REPINTAR LA PAGINACIÓN INMEDIATAMENTE
    this.zone.run(() => {
      this.onSearch();
      this.cdr.detectChanges();
    });
  }

  // --- GESTIÓN DEL MODAL (VER, EDITAR, ELIMINAR) ---
  openNote(note: Note) {
    this.selectedNote = { ...note }; 
    this.isEditing = false;
  }

  closeNote() {
    this.zone.run(() => {
      this.selectedNote = null;
      this.isEditing = false;
      this.cdr.detectChanges();
    });
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
      Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'La nota se ha actualizado correctamente.', timer: 2000, showConfirmButton: false });
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
        this.zone.run(async () => {
          const idToDelete = this.selectedNote!.id!;
          this.closeNote(); 
          await this.notesService.deleteNote(idToDelete);
          Swal.fire('¡Eliminada!', 'Tu nota ha sido borrada.', 'success');
        });
      }
    }
  }
}