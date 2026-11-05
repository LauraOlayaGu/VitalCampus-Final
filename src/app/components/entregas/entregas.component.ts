import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-entregas',
  templateUrl: './entregas.component.html',
  styleUrls: ['./entregas.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class EntregasComponent implements OnInit {
  tipoActividad: 'TRABAJO' | 'PARCIAL' = 'TRABAJO';
  titulo: string = '';
  asignaturaSeleccionada: string = '';
  fechaLimite: string = '';
  horaLimite: string = '23:59';
  estresPercibido: number = 3;

  asignaturasList: any[] = [];
  entregasPendientesList: any[] = [];

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.cargarAsignaturas();
    this.suscripcionEntregas();
  }

  cargarAsignaturas(): void {
    this.vitalCampusService.asignaturas$.subscribe(asigs => {
      this.asignaturasList = asigs || [];
      if (this.asignaturasList.length > 0 && !this.asignaturaSeleccionada) {
        this.asignaturaSeleccionada = this.asignaturasList[0].nombre;
      }
    });
  }

  suscripcionEntregas(): void {
    this.vitalCampusService.entregas$.subscribe(entregas => {
      const ahora = new Date().getTime();

      this.entregasPendientesList = (entregas || [])
        .filter(e => e.estado !== 'COMPLETADA')
        .map(e => {
          let horasRestantes = 999;
          let esUrgente = false;
          let mensajeAlerta = '';

          if (e.fechaLimite) {
            const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
            const diffMs = limite - ahora;
            horasRestantes = Math.round(diffMs / (1000 * 60 * 60));

            if (horasRestantes < 0) {
              mensajeAlerta = '⚠️ ¡ATENCIÓN! Esta entrega ya se encuentra vencida.';
              esUrgente = true;
            } else if (horasRestantes <= 36) {
              mensajeAlerta = `⚠️ ¡ATENCIÓN! La fecha de esta entrega está cerca (Faltan ${horasRestantes}h)`;
              esUrgente = true;
            }
          }

          return {
            ...e,
            horasRestantes,
            esUrgente,
            mensajeAlerta
          };
        });
    });
  }

  seleccionarTipo(tipo: 'TRABAJO' | 'PARCIAL'): void {
    this.tipoActividad = tipo;
  }

  seleccionarEstres(nivel: number): void {
    this.estresPercibido = nivel;
  }

  guardarActividad(): void {
    if (!this.titulo.trim()) {
      alert('Por favor, ingresa el título de la actividad.');
      return;
    }

    if (!this.fechaLimite) {
      alert('Por favor, selecciona una fecha límite.');
      return;
    }

    const payload = {
      tipo: this.tipoActividad,
      titulo: this.titulo.trim(),
      asignatura: this.asignaturaSeleccionada || 'General',
      fechaLimite: this.fechaLimite,
      horaLimite: this.horaLimite,
      estresPercibido: this.estresPercibido
    };

    this.vitalCampusService.createEntrega(payload).subscribe(() => {
      this.titulo = '';
      this.fechaLimite = '';
    });
  }

  marcarComoHecha(id: any): void {
    this.vitalCampusService.cambiarEstadoEntrega(id, 'COMPLETADA').subscribe(() => {
      this.vitalCampusService.actualizarRiesgoBasePorEntregas();
    });
  }

  eliminarActividad(id: any): void {
    if (confirm('¿Deseas eliminar esta entrega programada?')) {
      this.vitalCampusService.deleteEntrega(id).subscribe(() => {
        this.vitalCampusService.actualizarRiesgoBasePorEntregas();
      });
    }
  }
}