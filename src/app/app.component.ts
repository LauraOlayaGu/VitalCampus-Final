import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { VitalCampusService } from './services/vitalcampus.service';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive]
})
export class AppComponent implements OnInit {
  title = 'VitalCampus';

  usuarioActual$!: Observable<any | null>;
  alertasNoLeidasCount$!: Observable<number>;
  entregasPendientesCount$!: Observable<number>;

  constructor(
    public vitalCampusService: VitalCampusService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.usuarioActual$ = this.vitalCampusService.usuarioActualSubject$;

    // Redirigir al login si al cargar la app no hay un usuario autenticado
    if (!this.vitalCampusService.usuarioActualSubject$.value) {
      this.router.navigate(['/login']);
    }

    this.alertasNoLeidasCount$ = this.vitalCampusService.alertasSubject$.pipe(
      map(alertas => (alertas || []).filter(a => !a.leida).length)
    );

    this.entregasPendientesCount$ = this.vitalCampusService.entregas$.pipe(
      map(entregas => (entregas || []).filter(e => e.estado !== 'COMPLETADA').length)
    );
  }

  cerrarSesion(): void {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      this.vitalCampusService.cerrarSesionApp();
      this.router.navigate(['/login']);
    }
  }

  obtenerIniciales(nombre: string): string {
    if (!nombre) return 'LA';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  }
}