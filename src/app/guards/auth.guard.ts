import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  return new Promise((resolve) => {
    // Escuchamos el estado de Firebase una sola vez al intentar entrar
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();

      if (user) {
        resolve(true);
      } else {
        router.navigate(['/login']);
        resolve(false);
      }
    });
  });
};
