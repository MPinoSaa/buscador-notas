import { ChangeDetectionStrategy, Component, HostListener, effect, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { NotesService, Note, TextPart, highlight, snippet } from '../../services/notes';
import { ThemeService } from '../../services/theme';
import { AuthService } from '../../services/auth';
import { AiService } from '../../services/ai';
import { looksSensitive } from '../../services/sensitive';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-notas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './notas.html',
  styleUrls: ['./notas.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotasComponent implements OnInit {
  private notesService = inject(NotesService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ai = inject(AiService);
  private destroyRef = inject(DestroyRef);

  readonly loaded = this.notesService.loaded;
  readonly loadError = this.notesService.error;

  // Texto del input (inmediato) y consulta efectiva (con debounce)
  searchTerm = '';
  private readonly search$ = new Subject<string>();
  private readonly query = signal('');

  readonly selectedTagFilter = signal('');
  readonly currentPage = signal(1);
  readonly itemsPerPage = 9;
  readonly isDarkMode = inject(ThemeService).dark;
  private theme = inject(ThemeService);

  // Modal
  readonly selectedNote = signal<Note | null>(null);
  readonly isEditing = signal(false);
  readonly editTitle = signal('');
  readonly editTag = signal('');
  private aiDraft: { noteId: string; original: string } | null = null;
  readonly aiLoading = signal(false);
  readonly aiElapsed = signal(0); // segundos que lleva la solicitud a la IA
  readonly aiPreview = signal<string | null>(null); // propuesta de la IA pendiente de aceptar
  readonly aiRedacted = signal(0); // datos sensibles ocultados antes de enviar a la IA
  // Aviso en el editor cuando el texto parece traer credenciales
  readonly editHasSecrets = computed(() => this.isEditing() && looksSensitive(this.editContent()));
  readonly customTag = signal(false); // true = el usuario escribe una etiqueta nueva
  readonly editContent = signal('');

  private readonly standardTags = ['PROCEDIMIENTOS', 'SERVIDORES', 'INSTRUCTIVOS', 'OTROS'];
  private readonly maxFileSize = 1_000_000; // límite de documento de Firestore ~1 MiB

  // Etiquetas estándar + cualquier otra que exista en las notas
  readonly filterTags = computed(() => {
    const extra = this.notesService.tags().filter(t => !this.standardTags.includes(t));
    return [...this.standardTags, ...extra];
  });

  readonly filteredNotes = computed(() =>
    this.notesService.search(this.query(), this.selectedTagFilter())
  );
  readonly totalPages = computed(() => Math.ceil(this.filteredNotes().length / this.itemsPerPage) || 1);
  // Si cambian los datos y la página queda fuera de rango, se ajusta sin saltar a la 1
  readonly page = computed(() => Math.min(this.currentPage(), this.totalPages()));
  readonly paginatedNotes = computed(() => {
    const start = (this.page() - 1) * this.itemsPerPage;
    return this.filteredNotes().slice(start, start + this.itemsPerPage);
  });

  // Tarjetas de la página actual con título y fragmento ya resaltados
  readonly cards = computed(() => {
    const q = this.query();
    return this.paginatedNotes().map(note => ({
      note,
      title: highlight(note.title, q) as TextPart[],
      excerpt: highlight(snippet(note.content, q), q) as TextPart[]
    }));
  });

  readonly currentUserEmail = computed(() => this.authService.user()?.email ?? null);
  readonly isSuperAdmin = this.authService.isAdmin;

  // ¿El usuario actual puede editar/borrar la nota abierta?
  readonly canModify = computed(() => {
    const note = this.selectedNote();
    return !!note && (!note.id || this.isSuperAdmin() || this.currentUserEmail() === note.creatorEmail);
  });

  constructor() {
    // Mantiene búsqueda, etiqueta y página en la URL (enlaces compartibles, botón Atrás)
    effect(() => {
      const queryParams = {
        q: this.query() || null,
        tag: this.selectedTagFilter() || null,
        page: this.page() > 1 ? this.page() : null
      };
      this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.searchTerm = params.get('q') ?? '';
    this.query.set(this.searchTerm);
    this.selectedTagFilter.set(params.get('tag') ?? '');
    this.currentPage.set(Math.max(1, Number(params.get('page')) || 1));

    this.search$
      .pipe(debounceTime(200), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => {
        this.query.set(term);
        this.currentPage.set(1);
      });
  }

  irAlAdmin() {
    this.router.navigate(['/admin']);
  }

  toggleDarkMode() {
    this.theme.toggle();
  }

  // --- BÚSQUEDA Y FILTROS ---
  onSearch() {
    this.search$.next(this.searchTerm);
  }

  setTagFilter(tag: string) {
    this.selectedTagFilter.set(this.selectedTagFilter() === tag ? '' : tag);
    this.currentPage.set(1);
  }

  filterByTag(tag: string, event: Event) {
    event.stopPropagation();
    this.setTagFilter(tag);
  }

  // --- CONTROLES DE PAGINACIÓN ---
  nextPage() { if (this.page() < this.totalPages()) this.currentPage.set(this.page() + 1); }
  previousPage() { if (this.page() > 1) this.currentPage.set(this.page() - 1); }

  // --- SUBIDA DE ARCHIVOS ---
  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    let uploadedCount = 0;
    let duplicatedCount = 0;
    let failedCount = 0;
    // Duplicados contra TODAS las notas (no solo las filtradas) y las de este lote
    const existingTitles = new Set(this.notesService.notes().map(n => n.title.toLowerCase()));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const newTitle = file.name.replace(/\.txt$/i, '');

      if (existingTitles.has(newTitle.toLowerCase())) {
        duplicatedCount++;
        continue;
      }

      if (file.size > this.maxFileSize) {
        failedCount++;
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

      try {
        const content = await this.readFileAsync(file);
        await this.notesService.addNote({
          title: newTitle,
          content,
          tag: tagValue,
          creatorEmail: this.currentUserEmail() || 'desconocido'
        });
        existingTitles.add(newTitle.toLowerCase());
        uploadedCount++;
      } catch (error) {
        console.error('Error subiendo archivo:', error);
        failedCount++;
      }
    }

    input.value = '';
    this.showUploadSummary(uploadedCount, duplicatedCount, failedCount);
  }

  private readFileAsync(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private showUploadSummary(uploaded: number, duplicated: number, failed: number) {
    if (failed > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Algunos archivos no se subieron',
        text: `Subidas: ${uploaded}. Duplicadas: ${duplicated}. Con error o mayores a 1 MB: ${failed}.`
      });
    } else if (uploaded > 0 && duplicated === 0) {
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `${uploaded} nota(s) cargada(s)`, showConfirmButton: false, timer: 2500 });
    } else if (uploaded > 0 && duplicated > 0) {
      Swal.fire({ icon: 'info', title: 'Carga parcial', text: `Se subieron ${uploaded} notas. Se omitieron ${duplicated} duplicadas.` });
    } else if (uploaded === 0 && duplicated > 0) {
      Swal.fire({ icon: 'warning', title: 'Archivos Duplicados', text: 'No se subió nada. Todos los archivos ya existen.' });
    }
  }

  // --- GESTIÓN DEL MODAL (VER, EDITAR, ELIMINAR) ---
  openNote(note: Note) {
    this.selectedNote.set(note);
    this.isEditing.set(false);
  }

  closeNote() {
    this.selectedNote.set(null);
    this.isEditing.set(false);
    this.aiPreview.set(null);
    this.aiDraft = null;
  }

  // --- ASISTENTE DE IA: reestructura la nota y muestra una propuesta para aceptar o descartar ---
  async improveWithAi() {
    const note = this.selectedNote();
    if (!note || this.aiLoading()) return;

    // Si la nota parece traer credenciales, se avisa antes de enviarla a la IA
    if (looksSensitive(note.content)) {
      const answer = await Swal.fire({
        icon: 'warning',
        title: 'Esta nota parece contener contraseñas o claves',
        text: 'Antes de enviarla a la IA, las contraseñas, tokens e IPs se reemplazan por marcadores y se restauran en el resultado, así que la IA no los ve. Aun así, verifica la propuesta antes de guardar.',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#6d28d9'
      });
      if (!answer.isConfirmed) return;
    }

    this.aiLoading.set(true);
    this.aiElapsed.set(0);
    const timer = setInterval(() => this.aiElapsed.update(s => s + 1), 1000);
    try {
      const { content, redacted } = await this.ai.restructure({ title: note.title, tag: note.tag, content: note.content });
      // Si el usuario cerró o cambió de nota mientras esperaba, se descarta el resultado
      if (this.selectedNote()?.id === note.id) {
        this.aiRedacted.set(redacted);
        this.aiPreview.set(content);
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo ajustar la nota',
        text: error instanceof Error ? error.message : 'Intenta de nuevo.'
      });
    } finally {
      clearInterval(timer);
      this.aiLoading.set(false);
    }
  }

  // Pasa la propuesta al editor para poder retocarla antes de guardar
  applyAiPreview() {
    const proposal = this.aiPreview();
    if (proposal === null) return;
    const note = this.selectedNote();
    if (!note?.id) return;
    this.toggleEdit();
    this.editContent.set(proposal);
    this.aiPreview.set(null);
    // Se recuerda el original para registrar el ejemplo cuando el usuario guarde su versión final
    this.aiDraft = { noteId: note.id, original: note.content };
  }

  discardAiPreview() {
    this.aiPreview.set(null);
  }

  onTagSelect(value: string) {
    if (value === '__nueva__') {
      this.customTag.set(true);
      this.editTag.set('');
    } else {
      this.customTag.set(false);
      this.editTag.set(value);
    }
  }

  // Abre el modal en modo edición con una nota vacía
  createNote() {
    this.selectedNote.set({ title: '', content: '', tag: this.selectedTagFilter() || 'OTROS' });
    this.editTitle.set('');
    this.editTag.set(this.selectedTagFilter() || 'OTROS');
    this.customTag.set(false);
    this.editContent.set('');
    this.isEditing.set(true);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.selectedNote() && !Swal.isVisible()) this.closeNote();
  }

  toggleEdit() {
    const note = this.selectedNote();
    if (!note) return;
    this.editTitle.set(note.title);
    this.editTag.set(note.tag);
    this.customTag.set(false);
    this.editContent.set(note.content);
    this.isEditing.set(true);
  }

  async copyNote() {
    const note = this.selectedNote();
    if (!note) return;
    try {
      await navigator.clipboard.writeText(note.content);
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Contenido copiado', showConfirmButton: false, timer: 1500 });
    } catch {
      Swal.fire({ icon: 'error', title: 'No se pudo copiar', text: 'El navegador bloqueó el acceso al portapapeles.' });
    }
  }

  downloadNote() {
    const note = this.selectedNote();
    if (!note) return;
    const url = URL.createObjectURL(new Blob([note.content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = note.title.replace(/[\/:*?"<>|]/g, '_') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Si la nota partió de una propuesta de la IA, registra "original -> versión final" para que aprenda el estilo
  private recordAiExample(noteId: string, title: string, tag: string, finalContent: string) {
    const draft = this.aiDraft;
    this.aiDraft = null;
    if (!draft || draft.noteId !== noteId || draft.original.trim() === finalContent.trim()) return;
    void this.ai.saveExample({ title, tag, original: draft.original, final: finalContent });
  }

  async saveNote() {
    const note = this.selectedNote();
    if (!note) return;

    const title = this.editTitle().trim();
    // Las etiquetas nuevas se guardan en mayúsculas, como las demás
    const tag = this.customTag() ? this.editTag().trim().toUpperCase() : this.editTag().trim();
    if (!title || !tag) {
      Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'El título y la etiqueta no pueden estar vacíos.' });
      return;
    }
    try {
      if (note.id) {
        await this.notesService.updateNote(note.id, title, this.editContent(), tag);
        this.recordAiExample(note.id, title, tag, this.editContent());
        this.selectedNote.set({ ...note, title, tag, content: this.editContent() });
        this.isEditing.set(false);
        Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'La nota se ha actualizado correctamente.', timer: 2000, showConfirmButton: false });
      } else {
        const exists = this.notesService.notes().some(n => n.title.toLowerCase() === title.toLowerCase());
        if (exists) {
          Swal.fire({ icon: 'warning', title: 'Título duplicado', text: 'Ya existe una nota con ese título.' });
          return;
        }
        await this.notesService.addNote({ title, content: this.editContent(), tag, creatorEmail: this.currentUserEmail() || 'desconocido' });
        this.closeNote();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota creada', showConfirmButton: false, timer: 2000 });
      }
    } catch (error) {
      console.error('Error guardando nota:', error);
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: 'Revisa tus permisos o tu conexión e intenta de nuevo.' });
    }
  }

  async deleteSelectedNote() {
    const note = this.selectedNote();
    if (!note?.id) return;
    const noteId = note.id;

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
      try {
        await this.notesService.deleteNote(noteId);
        this.closeNote();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota borrada', showConfirmButton: false, timer: 2000 });
      } catch (error) {
        console.error('Error eliminando nota:', error);
        Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: 'Revisa tus permisos o tu conexión e intenta de nuevo.' });
      }
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
