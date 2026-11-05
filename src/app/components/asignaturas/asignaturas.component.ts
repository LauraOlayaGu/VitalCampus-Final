import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-asignaturas',
  templateUrl: './asignaturas.component.html',
  styleUrls: ['./asignaturas.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class AsignaturasComponent implements OnInit {
  asignaturaForm!: FormGroup;
  asignaturas: any[] = [];
  editandoId: number | string | null = null;
  guardando: boolean = false;
  exitoMsg: string = '';

  diasSemana = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

  cargas = [
    { valor: 'Baja', etiqueta: 'Baja' },
    { valor: 'Media-Baja', etiqueta: 'Media-Baja' },
    { valor: 'Media', etiqueta: 'Media' },
    { valor: 'Alta', etiqueta: 'Alta' },
    { valor: 'Muy Alta', etiqueta: 'Muy Alta' }
  ];

  constructor(
    private fb: FormBuilder,
    private vitalCampusService: VitalCampusService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.vitalCampusService.asignaturas$.subscribe(datos => {
      this.asignaturas = datos;
    });
  }

  initForm(): void {
    this.asignaturaForm = this.fb.group({
      nombre: ['', Validators.required],
      diaClase: ['LUNES', Validators.required],
      horaInicio: ['08:00', Validators.required],
      carga: ['Media', Validators.required]
    });
  }

  obtenerClasesPorDia(dia: string): any[] {
    return this.asignaturas.filter(a => (a.diaClase || '').toUpperCase() === dia.toUpperCase());
  }

  onSubmit(): void {
    if (this.asignaturaForm.invalid) return;

    this.guardando = true;
    const payload = this.asignaturaForm.value;

    if (this.editandoId) {
      this.vitalCampusService.updateAsignatura(this.editandoId, payload).subscribe(() => {
        this.guardando = false;
        this.editandoId = null;
        this.exitoMsg = 'Asignatura actualizada correctamente';
        this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
        setTimeout(() => this.exitoMsg = '', 3000);
      });
    } else {
      this.vitalCampusService.createAsignatura(payload).subscribe(() => {
        this.guardando = false;
        this.exitoMsg = 'Asignatura guardada y añadida al horario';
        this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
        setTimeout(() => this.exitoMsg = '', 3000);
      });
    }
  }

  editar(asig: any): void {
    this.editandoId = asig.id;
    this.asignaturaForm.patchValue({
      nombre: asig.nombre,
      diaClase: asig.diaClase,
      horaInicio: asig.horaInicio,
      carga: asig.carga || 'Media'
    });
  }

  // ELIMINACIÓN CON CONTEO UNIFICADO POR BLOQUES/OBJETIVOS DE ESTUDIO VISIBLES
  eliminar(id: any): void {
    const materia = this.asignaturas.find(a => String(a.id) === String(id));
    const nombreMateria = materia ? materia.nombre : 'esta asignatura';
    const nombreNorm = nombreMateria.trim().toLowerCase();

    // 1. Contar entregas pendientes activas
    const entregasAsociadas = (this.vitalCampusService.entregas$.getValue() || [])
      .filter(e => e.estado !== 'COMPLETADA' && (e.asignatura || '').trim().toLowerCase() === nombreNorm).length;

    // 2. Contar BLOQUES / CATEGORÍAS ÚNICAS de estudio (coincidiendo con las tarjetas visuales de la interfaz)
    const sesionesMateria = (this.vitalCampusService.sesionesEstudio$.getValue() || [])
      .filter(s => (s.asignatura || '').trim().toLowerCase() === nombreNorm);

    const categoriasUnicas = new Set(sesionesMateria.map(s => s.objetivo || 'Taller / Guía'));
    const bloquesEstudioCount = categoriasUnicas.size;

    let mensajeConfirmacion = `⚠️ ¿Estás seguro de que deseas eliminar la asignatura "${nombreMateria}"?`;

    if (entregasAsociadas > 0 || bloquesEstudioCount > 0) {
      mensajeConfirmacion += `\n\nAl eliminarla, también se removerán automáticamente de la plataforma:`;
      if (entregasAsociadas > 0) {
        mensajeConfirmacion += `\n • ${entregasAsociadas} ${entregasAsociadas === 1 ? 'entrega o actividad pendiente' : 'entregas o actividades pendientes'}.`;
      }
      if (bloquesEstudioCount > 0) {
        mensajeConfirmacion += `\n • ${bloquesEstudioCount} ${bloquesEstudioCount === 1 ? 'registro/bloque de horas de estudio' : 'registros/bloques de horas de estudio'}.`;
      }
    }

    const confirmado = window.confirm(mensajeConfirmacion);

    if (confirmado) {
      this.vitalCampusService.deleteAsignatura(id).subscribe(() => {
        this.exitoMsg = `Asignatura "${nombreMateria}" y sus datos asociados fueron eliminados correctamente.`;
        setTimeout(() => this.exitoMsg = '', 4000);
      });
    }
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.asignaturaForm.reset({ diaClase: 'LUNES', horaInicio: '08:00', carga: 'Media' });
  }
}