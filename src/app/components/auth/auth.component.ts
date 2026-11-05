import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AuthComponent {
  isLoginMode: boolean = true;

  // CAMPOS DE FORMULARIO
  nombre: string = '';
  correo: string = '';
  carrera: string = 'Ingeniería de Software';
  password: string = '';
  confirmPassword: string = '';

  errorMensaje: string = '';
  exitoMensaje: string = '';
  cargando: boolean = false;

  // LISTA EXACTA DE PROGRAMAS ACADÉMICOS DE LA INSTITUCIÓN
  carrerasDisponibles: string[] = [
    'Ingeniería Eléctrica',
    'Ingeniería de Software',
    'Seguridad y Salud en el Trabajo',
    'Ingeniería de Alimentos'
  ];

  constructor(
    private vitalCampusService: VitalCampusService,
    private router: Router
  ) {}

  cambiarModo(isLogin: boolean): void {
    this.isLoginMode = isLogin;
    this.errorMensaje = '';
    this.exitoMensaje = '';
  }

  // MÉTODO AUXILIAR PARA VALIDAR CORREO INSTITUCIONAL EXCLUSIVO @fet.edu.co
  private esCorreoValido(correoInput: string): boolean {
    const regex = /^[a-zA-Z0-9._%+-]+@fet\.edu\.co$/;
    return regex.test(correoInput.trim());
  }

  // MÉTODO AUXILIAR REFORZADO PARA VALIDAR FORTALEZA DE CONTRASEÑA
  private esPasswordSegura(passInput: string): { valida: boolean; mensaje: string } {
    const pass = passInput.trim();
    const passLwr = pass.toLowerCase();

    // 1. Longitud mínima de 8 caracteres
    if (pass.length < 8) {
      return { valida: false, mensaje: 'La contraseña es muy débil. Debe tener al menos 8 caracteres.' };
    }

    // 2. Palabras y secuencias comunes o inseguras
    const palabrasInseguras = [
      '123', '1234', '12345', '123456', '12345678', 'password', 'qwerty', 
      'laura', 'admin', 'usuario', 'estudiante', 'fet', 'vitalcampus', 'contrasena'
    ];

    for (const palabra of palabrasInseguras) {
      if (passLwr.includes(palabra)) {
        return { 
          valida: false, 
          mensaje: `La contraseña es muy débil. Evita usar nombres comunes o secuencias como "${palabra}".` 
        };
      }
    }

    // 3. Exigir combinación de letras (mayúsculas o minúsculas) y números
    const tieneLetra = /[a-zA-Z]/.test(pass);
    const tieneNumero = /[0-9]/.test(pass);

    if (!tieneLetra || !tieneNumero) {
      return { 
        valida: false, 
        mensaje: 'La contraseña debe ser más fuerte e incluir una combinación de letras y números.' 
      };
    }

    return { valida: true, mensaje: '' };
  }

  onSubmit(): void {
    if (this.isLoginMode) {
      this.procesarLogin();
    } else {
      this.procesarRegistro();
    }
  }

  private procesarLogin(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    const correoLwr = this.correo.trim().toLowerCase();

    if (!correoLwr) {
      this.errorMensaje = 'Por favor ingresa tu correo institucional.';
      return;
    }

    // VALIDACIÓN ESTRICTA DEL DOMINIO EN LOGIN
    if (!this.esCorreoValido(correoLwr)) {
      this.errorMensaje = 'Debes ingresar un correo institucional válido terminado en @fet.edu.co';
      return;
    }

    if (!this.password) {
      this.errorMensaje = 'Por favor ingresa tu contraseña.';
      return;
    }

    this.cargando = true;

    this.vitalCampusService.iniciarSesion(correoLwr, this.password).subscribe({
      next: () => {
        this.cargando = false;
        this.vitalCampusService.mostrarToastGlobal('Bienvenido/a', 'Sesión iniciada correctamente', 'INFO', false);
        this.router.navigate(['/resumen']);
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorMensaje = err.message || 'Error al iniciar sesión. Verifica tus credenciales.';
      }
    });
  }

  private procesarRegistro(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    const nombreLimpio = this.nombre.trim();
    const correoLwr = this.correo.trim().toLowerCase();

    // 1. VALIDACIÓN DE NOMBRE COMPLETO
    if (!nombreLimpio) {
      this.errorMensaje = 'Por favor ingresa tu nombre completo.';
      return;
    }

    if (nombreLimpio.length < 7 || !nombreLimpio.includes(' ')) {
      this.errorMensaje = 'Ingresa un nombre completo válido (ej. Laura Olaya) con al menos nombre y apellido.';
      return;
    }

    // 2. VALIDACIÓN DE CORREO INSTITUCIONAL (@fet.edu.co)
    if (!correoLwr) {
      this.errorMensaje = 'Por favor ingresa tu correo institucional.';
      return;
    }

    if (!this.esCorreoValido(correoLwr)) {
      this.errorMensaje = 'Debes usar un correo institucional válido terminado en @fet.edu.co';
      return;
    }

    // 3. VALIDACIÓN REFORZADA DE CONTRASEÑA
    if (!this.password) {
      this.errorMensaje = 'Por favor crea una contraseña.';
      return;
    }

    const checkPass = this.esPasswordSegura(this.password);
    if (!checkPass.valida) {
      this.errorMensaje = checkPass.mensaje;
      return;
    }

    // 4. COINCIDENCIA DE CONTRASEÑAS
    if (this.password !== this.confirmPassword) {
      this.errorMensaje = 'Las contraseñas no coinciden.';
      return;
    }

    this.cargando = true;

    const datosRegistro = {
      nombre: nombreLimpio,
      email: correoLwr,
      carrera: this.carrera,
      password: this.password
    };

    this.vitalCampusService.registrarUsuario(datosRegistro).subscribe({
      next: () => {
        this.cargando = false;
        this.exitoMensaje = '🎉 ¡Cuenta creada con éxito! Iniciando sesión automáticamente...';
        
        setTimeout(() => {
          this.vitalCampusService.iniciarSesion(correoLwr, this.password).subscribe(() => {
            this.router.navigate(['/resumen']);
          });
        }, 1000);
      },
      error: (err: any) => {
        this.cargando = false;
        this.errorMensaje = err.message || 'Error al crear la cuenta. El correo podría estar en uso.';
      }
    });
  }
}