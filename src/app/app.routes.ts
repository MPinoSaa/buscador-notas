import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { NotasComponent } from './pages/notas/notas';
import { authGuard } from './guards/auth.guard'; // 1. Importamos el guardián

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' }, 
  { path: 'login', component: LoginComponent },
  
  // 2. Protegemos esta ruta con el candado
  { 
    path: 'notas', 
    component: NotasComponent,
    canActivate: [authGuard] 
  },
  
  { path: '**', redirectTo: '/login' } 
];