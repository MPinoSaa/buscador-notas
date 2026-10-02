import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { firebaseApp } from './firebase';

// Separado de firebase.ts para que Firestore no pese en la carga inicial (solo Auth).
// En el navegador usa caché persistente: las notas se ven sin conexión y se sincronizan al volver.
export const db = typeof window !== 'undefined'
  ? initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    })
  : getFirestore(firebaseApp);
