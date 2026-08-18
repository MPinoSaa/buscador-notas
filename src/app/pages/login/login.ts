import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth'; // Revisa que la ruta sea correcta
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginEmail = '';
  loginPassword = '';
  isLoggingIn = false;
  isDarkMode = false; 

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.isDarkMode = localStorage.getItem('darkMode') === 'true';
      if (this.isDarkMode) document.body.classList.add('dark-body');
    }
  }

  async onLogin() {
    if (!this.loginEmail.trim() || !this.loginPassword.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campos vacíos', text: 'Por favor ingresa tu correo y contraseña.' });
      return;
    }
    
    this.isLoggingIn = true;
    try {
      await this.authService.login(this.loginEmail, this.loginPassword);
      // ¡Magia! Si el login es exitoso, navegamos a la página de notas
      this.router.navigate(['/notas']);
    } catch (error: any) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Error de acceso', text: 'Credenciales inválidas. Inténtalo de nuevo.' });
    } finally {
      this.isLoggingIn = false;
      this.loginPassword = ''; 
    }
  }

  solicitarCuenta() {
    const adminEmail = 'matiaspinosaa@gmail.com';
    const subject = encodeURIComponent('Solicitud de Acceso - Buscador de Notas');
    const body = encodeURIComponent('Hola Administrador,\n\nMe gustaría solicitar una cuenta para acceder al Buscador de Notas.\n\nMi nombre es: [Escribe tu nombre]\nEl correo que deseo registrar es: [Tu correo]\nMotivo/Área: [Tu área de trabajo]\n\nQuedo atento a la confirmación. Saludos.')
    window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('darkMode', this.isDarkMode.toString());
    }
    document.body.classList.toggle('dark-body', this.isDarkMode);
  }
}