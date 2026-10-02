import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBBa7pGw9FCFCs3_EdvNVWgEk-izd1oqQk",
  authDomain: "buscador-notas.firebaseapp.com",
  projectId: "buscador-notas",
  storageBucket: "buscador-notas.firebasestorage.app",
  messagingSenderId: "748370186114",
  appId: "1:748370186114:web:23b95c89bea7e6cbe1099b"
};

// Única inicialización de Firebase para toda la app (evita duplicate-app / no-app)
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(firebaseApp);
