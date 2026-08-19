import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotesService, Note } from '../../services/notes';
import { AuthService } from '../../services/auth';
import Swal from 'sweetalert2';
import { getAuth } from 'firebase/auth';

@Component({
  selector: 'app-notas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notas.html',
  styleUrls: ['./notas.css']
})
export class NotasComponent implements OnInit {
  searchTerm = '';
  notes: Note[] = [];
  selectedNote: Note | null = null;
  isEditing = false;
  isDarkMode = false;
  selectedTagFilter = '';
  standardTags = ['PROCEDIMIENTOS', 'SERVIDORES', 'INSTRUCTIVOS', 'OTROS'];
  currentPage = 1;
  itemsPerPage = 9;

  get currentUserEmail(): string | null {
  const auth = getAuth();
  return auth.currentUser?.email || null;
}

  get isSuperAdmin(): boolean {
    return this.authService.isSuperAdmin();
  }

  // 1. Devolvemos el ChangeDetectorRef
  constructor(
    private notesService: NotesService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) {}

  get totalPages(): number {
    return Math.ceil(this.notes.length / this.itemsPerPage) || 1;
  }

  get paginatedNotes(): Note[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.notes.slice(startIndex, startIndex + this.itemsPerPage);
  }

  ngOnInit() {
    this.checkDarkMode();
    this.onSearch(); 
    
    // 2. Le ordenamos a Angular que repinte la pantalla apenas lleguen los datos
    this.notesService.onDataChange = () => {
      this.onSearch();
      this.cdr.detectChanges(); 
    };
  }

  private checkDarkMode() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.isDarkMode = localStorage.getItem('darkMode') === 'true';
      if (this.isDarkMode) document.body.classList.add('dark-body');
    }
  }

  irAlAdmin() {
    this.router.navigate(['/admin']);
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('darkMode', this.isDarkMode.toString());
    }
    document.body.classList.toggle('dark-body', this.isDarkMode);
  }

  // --- BÚSQUEDA Y FILTROS ---
  onSearch() {
    this.notes = this.notesService.searchNotes(this.searchTerm, this.selectedTagFilter);
    this.currentPage = 1; 
  }

  setTagFilter(tag: string) {
    this.selectedTagFilter = this.selectedTagFilter === tag ? '' : tag;
    this.onSearch();
  }

  filterByTag(tag: string, event: Event) {
    event.stopPropagation();
    this.setTagFilter(tag);
  }

  clearTagFilter() {
    this.selectedTagFilter = '';
    this.onSearch();
  }

  // --- CONTROLES DE PAGINACIÓN ---
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  previousPage() { if (this.currentPage > 1) this.currentPage--; }

  // --- SUBIDA DE ARCHIVOS ---
  async onFilesSelected(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    let uploadedCount = 0;
    let duplicatedCount = 0;
    
    for (let i = 0; i < files.length; i++) { 
      const file = files[i];
      const newTitle = file.name.replace('.txt', '');
      
      if (this.notes.some(n => n.title.toLowerCase() === newTitle.toLowerCase())) {
        duplicatedCount++;
        continue;
      }

      const { value: tagValue, isDismissed } = await Swal.fire({
        title: 'Asignar Etiqueta',
        text: `¿Qué categoría describe mejor a: "${newTitle}"?`,
        input: 'select',
        inputOptions: {
          'PROCEDIMIENTOS': 'Procedimientos',
          'SERVIDORES': 'Servidores',
          'INSTRUCTIVOS': 'Instructivos',
          'OTROS': 'Otros'
        },
        inputPlaceholder: 'Selecciona una categoría...',
        showCancelButton: true,
        confirmButtonText: 'Subir archivo',
        cancelButtonText: 'Omitir archivo',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#ef4444',
        inputValidator: (value) => value ? null : 'Debes seleccionar una etiqueta para continuar'
      });

      if (isDismissed) continue;

      const content = await this.readFileAsync(file);
      const userEmail = this.currentUserEmail || 'desconocido';
      await this.notesService.addNote({ 
        title: newTitle, 
        content, 
        tag: tagValue,
        creatorEmail: userEmail 
      });
      uploadedCount++;
    }

    event.target.value = ''; 
    this.showUploadSummary(uploadedCount, duplicatedCount);
  }

  private readFileAsync(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: any) => resolve(e.target.result);
      reader.readAsText(file);
    });
  }

  private showUploadSummary(uploaded: number, duplicated: number) {
    if (uploaded > 0 && duplicated === 0) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${uploaded} nota(s) cargada(s)`, showConfirmButton: false, timer: 2500 });
    } else if (uploaded > 0 && duplicated > 0) {
      Swal.fire({ icon: 'info', title: 'Carga parcial', text: `Se subieron ${uploaded} notas. Se omitieron ${duplicated} duplicadas.` });
    } else if (uploaded === 0 && duplicated > 0) {
      Swal.fire({ icon: 'warning', title: 'Archivos Duplicados', text: 'No se subió nada. Todos los archivos ya existen.' });
    }
  }

  // --- GESTIÓN DEL MODAL (VER, EDITAR, ELIMINAR) ---
  openNote(note: Note) {
    this.selectedNote = { ...note }; 
    this.isEditing = false;
  }

  closeNote() {
    this.selectedNote = null;
    this.isEditing = false;
    this.cdr.detectChanges(); // 3. Forzamos cierre visual
  }

  toggleEdit() {
    this.isEditing = true;
  }

  async saveNote() {
    if (this.selectedNote && this.selectedNote.id) {
      await this.notesService.updateNote(this.selectedNote.id, this.selectedNote.title, this.selectedNote.content, this.selectedNote.tag);
      this.isEditing = false;
      Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'La nota se ha actualizado correctamente.', timer: 2000, showConfirmButton: false });
    }
  }

  async deleteSelectedNote() {
    if (!this.selectedNote || !this.selectedNote.id) return;

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
      const idToDelete = this.selectedNote.id;
      this.closeNote(); 
      await this.notesService.deleteNote(idToDelete);
      Swal.fire('¡Eliminada!', 'Tu nota ha sido borrada.', 'success');
    }
  }

  async onLogout() {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: 'Tendrás que volver a ingresar tu correo y contraseña para acceder.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    })
    if (result.isConfirmed) {
      await this.authService.logout();
      this.router.navigate(['/login'])
    }
  }
}