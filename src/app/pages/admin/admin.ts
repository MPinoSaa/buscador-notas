import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firestore';
import { ThemeService } from '../../services/theme';
import { NotesService } from '../../services/notes';
import Swal from 'sweetalert2';

interface Solicitud {
  id: string;
  nombre: string;
  correo: string;
  motivo: string;
  fecha: string;
  estado: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  solicitudes: Solicitud[] = [];
  readonly notas = inject(NotesService).notes;
  notasSeleccionadas: Set<string> = new Set();
  private unsubscribeSolicitudes?: () => void;

  db = db;
  readonly isDarkMode = inject(ThemeService).dark;

  constructor(
    private notesService: NotesService,
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const solicitudesRef = collection(this.db, 'solicitudes');
    this.unsubscribeSolicitudes = onSnapshot(solicitudesRef, (snapshot) => {
      this.zone.run(() => {
        this.solicitudes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Solicitud))
                            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        this.cdr.detectChanges();
      });
    });

  }

  ngOnDestroy() {
    this.unsubscribeSolicitudes?.();
  }

  volverInicio() {
    this.router.navigate(['/notas']);
  }

  async marcarAprobada(id: string) {
    await updateDoc(doc(this.db, 'solicitudes', id), { estado: 'Aprobada' });
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Marcada como aprobada', showConfirmButton: false, timer: 2000 });
  }

  async eliminarSolicitud(id: string) {
    const result = await Swal.fire({
      title: '¿Eliminar solicitud?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, eliminar'
    });
    if (!result.isConfirmed) return;
    await deleteDoc(doc(this.db, 'solicitudes', id));
  }

  toggleSeleccion(id: string) {
    if (this.notasSeleccionadas.has(id)) {
      this.notasSeleccionadas.delete(id);
    } else {
      this.notasSeleccionadas.add(id);
    }
  }

  async borrarNotasSeleccionadas() {
    if (this.notasSeleccionadas.size === 0) return;

    const result = await Swal.fire({
      title: '¿Eliminar múltiples notas?',
      text: `Estás a punto de borrar ${this.notasSeleccionadas.size} nota(s) definitivamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Sí, borrar todas'
    });

    if (result.isConfirmed) {
      try {
        await this.notesService.deleteNotes([...this.notasSeleccionadas]);
        this.notasSeleccionadas.clear();
        Swal.fire('¡Eliminadas!', 'Las notas seleccionadas fueron borradas.', 'success');
      } catch (error) {
        console.error('Error borrando notas:', error);
        Swal.fire('Error', 'No se pudieron borrar las notas. Intenta de nuevo.', 'error');
      }
    }
  }
}