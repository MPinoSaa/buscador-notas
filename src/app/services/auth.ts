import { Injectable, NgZone, computed, signal } from '@angular/core';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User, sendPasswordResetEmail } from 'firebase/auth';
import { BehaviorSubject } from 'rxjs';
import { auth } from '../firebase';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = auth;

  // BehaviorSubject para mantener al usuario actual disponible y reactivo
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Signal con el usuario actual, para componentes OnPush
  readonly user = signal<User | null>(null);
  readonly isAdmin = computed(() => this.user()?.email === 'admin@admin.com');

  constructor(private zone: NgZone) {
    onAuthStateChanged(this.auth, (user) => {
      this.zone.run(() => {
        this.currentUserSubject.next(user);
        this.user.set(user);
      });
    });
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    return userCredential.user;
  }

  async logout() {
    await signOut(this.auth);
  }

  // Por ahora atado al correo del admin; las reglas de Firestore deben validar lo mismo
  isSuperAdmin(): boolean {
    return this.isAdmin();
  }

  async resetPassword(email: string) {
    await sendPasswordResetEmail(this.auth, email);
  }
}
