import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth'; // Revisa que la ruta sea correcta
import Swal from 'sweetalert2';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

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

  async solicitarCuenta() {
    const { value: formValues } = await Swal.fire({
      title: 'Solicitar Acceso',
      html:
        '<input id="swal-nombre" class="swal2-input" placeholder="Tu nombre completo">' +
        '<input id="swal-correo" type="email" class="swal2-input" placeholder="Tu correo electrónico">' +
        '<input id="swal-motivo" class="swal2-input" placeholder="Área o motivo de acceso">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Enviar Solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#94a3b8',
      preConfirm: () => {
        const nombre = (document.getElementById('swal-nombre') as HTMLInputElement).value;
        const correo = (document.getElementById('swal-correo') as HTMLInputElement).value;
        const motivo = (document.getElementById('swal-motivo') as HTMLInputElement).value;

        if (!nombre || !correo || !motivo) {
          Swal.showValidationMessage('Todos los campos son obligatorios');
          return false;
        }
        return { nombre, correo, motivo };
      }
    });

    if (formValues) {
      try {
        const db = getFirestore();
        const solicitudesRef = collection(db, 'solicitudes');
        await addDoc(solicitudesRef, {
          nombre: formValues.nombre,
          correo: formValues.correo,
          motivo: formValues.motivo,
          fecha: new Date().toISOString(),
          estado: 'pendiente'
        });

        Swal.fire({
          icon: 'success',
          title: '¡Enviado!',
          text: 'Tu solicitud ha sido registrada. El administrador la revisará pronto.'
        });
      } catch (error) {
        console.error("Error al guardar solicitud:", error);
        Swal.fire('Error', 'Hubo un problema al enviar la solicitud. Intenta de nuevo.', 'error');
      }
    }
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('darkMode', this.isDarkMode.toString());
    }
    document.body.classList.toggle('dark-body', this.isDarkMode);
  }

  async recuperarPassword() {
    const { value: emailToReset } = await Swal.fire({
      title: 'Recuperar Contraseña',
      text: 'Ingresa el correo con el que te registraste:',
      input: 'email',
      inputPlaceholder: 'ejemplo@empresa.com',
      showCancelButton: true,
      confirmButtonText: 'Enviar enlace',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#94a3b8'
    });

    if (emailToReset) {
      try {
        await this.authService.resetPassword(emailToReset);
        Swal.fire({
          icon: 'success',
          title: '¡Correo enviado!',
          text: 'Revisa tu bandeja de entrada (y la carpeta de SPAM) para crear tu nueva contraseña.'
        });
      } catch (error: any) {
        console.error(error);
        // Manejo de errores amigable
        if (error.code === 'auth/user-not-found') {
          Swal.fire('Error', 'No existe ninguna cuenta con este correo.', 'error');
        } else {
          Swal.fire('Error', 'No pudimos procesar la solicitud. Intenta de nuevo.', 'error');
        }
      }
    }
  }
}