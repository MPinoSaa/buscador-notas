import { Injectable, NgZone } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Tu misma configuración de Firebase
  private firebaseConfig = {
    apiKey: "AIzaSyBBa7pGw9FCFCs3_EdvNVWgEk-izd1oqQk",
    authDomain: "buscador-notas.firebaseapp.com",
    projectId: "buscador-notas",
    storageBucket: "buscador-notas.firebasestorage.app",
    messagingSenderId: "748370186114",
    appId: "1:748370186114:web:23b95c89bea7e6cbe1099b"
  };

  private auth;
  
  // BehaviorSubject para mantener al usuario actual disponible y reactivo
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private zone: NgZone) {
    // Seguridad: Revisamos si Firebase ya fue inicializado por notes.service.ts
    // Si no existe, lo inicializamos. Si ya existe, tomamos la conexión activa.
    const app = getApps().length === 0 ? initializeApp(this.firebaseConfig) : getApp();
    this.auth = getAuth(app);

    // Escuchar cambios en la sesión de Firebase en tiempo real
    onAuthStateChanged(this.auth, (user) => {
      this.zone.run(() => {
        this.currentUserSubject.next(user);
      });
    });
  }

  // Getter para consultar quién está logueado en cualquier momento
  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Función para iniciar sesión
  async login(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error;
    }
  }

  // Función para cerrar sesión
  async logout() {
    await signOut(this.auth);
  }
  
  // Función para identificar al Súper Administrador
  isSuperAdmin(): boolean {
    const user = this.currentUser;
    // Por ahora lo atamos a tu correo de prueba, luego podemos usar una BD de roles
    return user?.email === 'admin@admin.com';
  }
}