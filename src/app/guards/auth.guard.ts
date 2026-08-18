import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth = getAuth();

  return new Promise((resolve) => {
    // Escuchamos el estado de Firebase una sola vez al intentar entrar
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Dejamos de escuchar inmediatamente para ahorrar memoria
      
      if (user) {
        resolve(true); // ¡Adelante, puedes pasar!
      } else {
        router.navigate(['/login']); // Te expulso al login
        resolve(false); 
      }
    });
  });
};