import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { getFirestore, collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { NotesService, Note } from '../../services/notes';
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
export class AdminComponent implements OnInit {
  solicitudes: Solicitud[] = [];
  notas: Note[] = [];
  notasSeleccionadas: Set<string> = new Set();
  
  db = getFirestore();
  isDarkMode = false;

  constructor(
    private notesService: NotesService,
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.isDarkMode = localStorage.getItem('darkMode') === 'true';
      if (this.isDarkMode) document.body.classList.add('dark-body');
    }

    const solicitudesRef = collection(this.db, 'solicitudes');
    onSnapshot(solicitudesRef, (snapshot) => {
      this.zone.run(() => {
        this.solicitudes = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Solicitud))
                            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        this.cdr.detectChanges();
      });
    });

    this.notas = this.notesService.searchNotes('');
    this.notesService.onDataChange = () => {
      this.notas = this.notesService.searchNotes('');
      this.cdr.detectChanges();
    };
  }

  volverInicio() {
    this.router.navigate(['/notas']);
  }

  async marcarAprobada(id: string) {
    await updateDoc(doc(this.db, 'solicitudes', id), { estado: 'Aprobada' });
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Marcada como aprobada', showConfirmButton: false, timer: 2000 });
  }

  async eliminarSolicitud(id: string) {
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
      for (const id of this.notasSeleccionadas) {
        await this.notesService.deleteNote(id);
      }
      this.notasSeleccionadas.clear();
      Swal.fire('¡Eliminadas!', 'Las notas seleccionadas fueron borradas.', 'success');
    }
  }
}