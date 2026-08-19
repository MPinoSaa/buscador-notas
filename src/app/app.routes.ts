import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { NotasComponent } from './pages/notas/notas';
import { AdminComponent } from './pages/admin/admin'
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' }, 
  { path: 'login', component: LoginComponent },
  { path: 'notas', component: NotasComponent, canActivate: [authGuard] },
  
  { 
    path: 'admin', 
    component: AdminComponent,
    canActivate: [authGuard, adminGuard] 
  },
  
  { path: '**', redirectTo: '/login' } 
];