import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-estudio',
  templateUrl: './estudio.component.html',
  styleUrls: ['./estudio.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class EstudioComponent implements OnInit, OnDestroy {
  exitoMsg: string = '';
  errorMsg: string = '';
  mostrarFormularioManual: boolean = false;

  asignaturasDisponibles: any[] = [];
  asignaturaSeleccionadaCronometro: string = '';
  tipoActividadSeleccionada: string = 'Taller / Guía';

  minutosPersonalizadosInput: number = 25;
  modoInvestigacionLibre: boolean = true;
  private yaPenalizadoEnEstaSalida: boolean = false;
  private autoSaveSub: Subscription | null = null;

  // FORMULARIO MANUAL
  manualAsignatura: string = '';
  manualObjetivo: string = 'Taller / Guía';
  manualHoras: number = 1;
  manualFecha: string = new Date().toISOString().substring(0, 10);

  // ESTRUCTURA POR MATERIAS Y CATEGORÍAS
  materiasConCategorias: any[] = [];
  totalAcumuladoTextoSemestre: string = '0 min';

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.cargarAsignaturas();
    this.suscripcionSesiones();
    this.sincronizarConServicioGlobal();

    // ESCUCHAR CUANDO EL TEMPORIZADOR LLEGA A 00:00 COMPLETADO
    this.autoSaveSub = this.vitalCampusService.sesionCompletadaAuto$.subscribe(completada => {
      if (completada) {
        this.guardarRegistroAutoAlFinalizar();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.autoSaveSub) {
      this.autoSaveSub.unsubscribe();
    }
    this.vitalCampusService.pomodoroAsignatura = this.asignaturaSeleccionadaCronometro;
    this.vitalCampusService.pomodoroObjetivo = this.tipoActividadSeleccionada;
    this.vitalCampusService.pomodoroModoInvestigacionLibre = this.modoInvestigacionLibre;
  }

  sincronizarConServicioGlobal(): void {
    this.minutosPersonalizadosInput = this.vitalCampusService.pomodoroMinutosConfig;
    this.modoInvestigacionLibre = this.vitalCampusService.pomodoroModoInvestigacionLibre;
    
    if (this.vitalCampusService.pomodoroAsignatura) {
      this.asignaturaSeleccionadaCronometro = this.vitalCampusService.pomodoroAsignatura;
    }
    if (this.vitalCampusService.pomodoroObjetivo) {
      this.tipoActividadSeleccionada = this.vitalCampusService.pomodoroObjetivo;
    }
  }

  get enfoqueEnCurso(): boolean {
    return this.vitalCampusService.pomodoroActivo;
  }

  get segundosRestantes(): number {
    return this.vitalCampusService.pomodoroSegundosRestantes;
  }

  @HostListener('window:blur')
  onWindowBlur(): void {
    if (this.enfoqueEnCurso && !this.modoInvestigacionLibre && !this.yaPenalizadoEnEstaSalida) {
      this.yaPenalizadoEnEstaSalida = true;
      this.vitalCampusService.registrarDistraccion();
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.yaPenalizadoEnEstaSalida = false;
  }

  cargarAsignaturas(): void {
    this.vitalCampusService.asignaturas$.subscribe(asigs => {
      this.asignaturasDisponibles = asigs || [];
      if (this.asignaturasDisponibles.length > 0) {
        // Garantizar que si no hay selección o la selección actual ya no existe, seleccione la primera
        const existeActual = this.asignaturasDisponibles.some(a => a.nombre === this.asignaturaSeleccionadaCronometro);
        if (!this.asignaturaSeleccionadaCronometro || !existeActual) {
          this.asignaturaSeleccionadaCronometro = this.asignaturasDisponibles[0].nombre;
          this.vitalCampusService.pomodoroAsignatura = this.asignaturasDisponibles[0].nombre;
        }
        if (!this.manualAsignatura) {
          this.manualAsignatura = this.asignaturasDisponibles[0].nombre;
        }
      }
      this.procesarAgrupacionPorCategorias();
    });
  }

  suscripcionSesiones(): void {
    this.vitalCampusService.sesionesEstudio$.subscribe(() => {
      this.procesarAgrupacionPorCategorias();
    });
  }

  procesarAgrupacionPorCategorias(): void {
    const sesiones = this.vitalCampusService.sesionesEstudio$.getValue() || [];
    let sumaTotalMinutos = 0;

    const mapaMaterias: { [materia: string]: { [categoria: string]: { minutos: number; fecha: string; ids: any[] } } } = {};

    this.asignaturasDisponibles.forEach(a => {
      mapaMaterias[a.nombre] = {};
    });

    sesiones.forEach(s => {
      const min = Number(s.duracionMinutos || (s.horas ? s.horas * 60 : 0));
      sumaTotalMinutos += min;

      const materiaKey = s.asignatura || 'General';
      const catKey = s.objetivo || 'Taller / Guía';

      if (!mapaMaterias[materiaKey]) {
        mapaMaterias[materiaKey] = {};
      }

      if (!mapaMaterias[materiaKey][catKey]) {
        mapaMaterias[materiaKey][catKey] = {
          minutos: 0,
          fecha: s.fecha || new Date().toISOString().substring(0, 10),
          ids: []
        };
      }

      mapaMaterias[materiaKey][catKey].minutos += min;
      mapaMaterias[materiaKey][catKey].ids.push(s.id);
      mapaMaterias[materiaKey][catKey].fecha = s.fecha || mapaMaterias[materiaKey][catKey].fecha;
    });

    if (sumaTotalMinutos >= 60) {
      const horas = Math.floor(sumaTotalMinutos / 60);
      const minRestantes = Math.round(sumaTotalMinutos % 60);
      this.totalAcumuladoTextoSemestre = minRestantes > 0 ? `${horas}h ${minRestantes} min` : `${horas}h`;
    } else {
      this.totalAcumuladoTextoSemestre = `${Math.round(sumaTotalMinutos)} min`;
    }

    this.materiasConCategorias = Object.keys(mapaMaterias).map(nombreMateria => {
      const categoriasMap = mapaMaterias[nombreMateria];
      const categoriasList = Object.keys(categoriasMap).map(catNombre => {
        const totalMin = categoriasMap[catNombre].minutos;
        
        let textoFormateado = `${Math.round(totalMin)} min`;
        if (totalMin >= 60) {
          const h = Math.floor(totalMin / 60);
          const m = Math.round(totalMin % 60);
          textoFormateado = m > 0 ? `${h}h ${m}m` : `${h}.0h`;
        }

        return {
          categoria: catNombre,
          minutosNum: totalMin,
          tiempoFormateado: textoFormateado,
          fecha: categoriasMap[catNombre].fecha,
          ids: categoriasMap[catNombre].ids
        };
      });

      return {
        nombre: nombreMateria,
        categorias: categoriasList
      };
    });
  }

  obtenerHorasTotalesSemestre(): string {
    return this.totalAcumuladoTextoSemestre;
  }

  toggleRegistroManual(): void {
    this.mostrarFormularioManual = !this.mostrarFormularioManual;
    this.exitoMsg = '';
    this.errorMsg = '';
  }

  cambiarAsignaturaCronometro(event: any): void {
    const valor = event.target ? event.target.value : event;
    this.asignaturaSeleccionadaCronometro = valor;
    this.vitalCampusService.pomodoroAsignatura = valor;
  }

  cambiarTipoActividad(event: any): void {
    const valor = event.target ? event.target.value : event;
    this.tipoActividadSeleccionada = valor;
    this.vitalCampusService.pomodoroObjetivo = valor;
  }

  cambiarTiempoConfig(minutos: number): void {
    if (this.enfoqueEnCurso) this.pausarEnfoque();
    this.minutosPersonalizadosInput = minutos;
    this.vitalCampusService.pomodoroMinutosConfig = minutos;
    this.vitalCampusService.pomodoroSegundosRestantes = minutos * 60;
    this.vitalCampusService.pomodoroSegundosTranscurridosTotal = 0;
  }

  actualizarTiempoInput(event: any): void {
    const val = Number(event.target.value);
    if (val >= 1) {
      this.minutosPersonalizadosInput = val;
      if (!this.enfoqueEnCurso) {
        this.vitalCampusService.pomodoroMinutosConfig = val;
        this.vitalCampusService.pomodoroSegundosRestantes = val * 60;
        this.vitalCampusService.pomodoroSegundosTranscurridosTotal = 0;
      }
    }
  }

  toggleModoInvestigacion(): void {
    this.modoInvestigacionLibre = !this.modoInvestigacionLibre;
    this.vitalCampusService.pomodoroModoInvestigacionLibre = this.modoInvestigacionLibre;
  }

  iniciarOpausar(): void {
    if (this.vitalCampusService.pausaEnCurso$.getValue()) {
      this.vitalCampusService.mostrarToastGlobal(
        '☕ Pausa Activa en Curso',
        'No puedes iniciar una sesión de estudio mientras estás en tu descanso obligatorio de 15 minutos.',
        'ADVERTENCIA',
        false
      );
      return;
    }

    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    } else {
      this.iniciarEnfoque();
    }
  }

  iniciarEnfoque(): void {
    this.errorMsg = '';
    this.vitalCampusService.iniciarPomodoro(this.minutosPersonalizadosInput);
  }

  pausarEnfoque(): void {
    this.vitalCampusService.pausarPomodoro();
  }

  private guardarRegistroAutoAlFinalizar(): void {
    const segundosTotalesAcumulados = this.vitalCampusService.pomodoroSegundosTranscurridosTotal;
    const minutosGuardar = Math.max(1, Math.round(segundosTotalesAcumulados / 60));

    const materiaAAsignar = this.asignaturaSeleccionadaCronometro || 
                            this.vitalCampusService.pomodoroAsignatura || 
                            (this.asignaturasDisponibles.length > 0 ? this.asignaturasDisponibles[0].nombre : 'General');

    const payload = {
      asignatura: materiaAAsignar,
      objetivo: this.tipoActividadSeleccionada || this.vitalCampusService.pomodoroObjetivo || 'Taller / Guía',
      duracionMinutos: minutosGuardar,
      fecha: new Date().toISOString().substring(0, 10)
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 ¡Tiempo Completado! Se registraron automáticamente ${minutosGuardar} min en "${payload.objetivo}" de ${payload.asignatura}.`;
      this.errorMsg = '';
      
      this.vitalCampusService.pomodoroSegundosRestantes = this.minutosPersonalizadosInput * 60;
      this.vitalCampusService.pomodoroSegundosTranscurridosTotal = 0;
      
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 6000);
    });
  }

  guardarRegistroManualCronometro(): void {
    const segundosRealesTranscurridos = this.vitalCampusService.pomodoroSegundosTranscurridosTotal;

    if (segundosRealesTranscurridos < 60) {
      this.errorMsg = '⚠️ Debes estudiar al menos 1 minuto (60 segundos reales) para poder guardar un registro parcial.';
      this.vitalCampusService.mostrarToastGlobal('⚠️ Tiempo Insuficiente', 'Debes estudiar al menos 1 minuto real para registrar.', 'ADVERTENCIA', false);
      setTimeout(() => this.errorMsg = '', 5000);
      return;
    }

    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    }

    const minutosGuardar = Math.round(segundosRealesTranscurridos / 60);

    const materiaAAsignar = this.asignaturaSeleccionadaCronometro || 
                            this.vitalCampusService.pomodoroAsignatura || 
                            (this.asignaturasDisponibles.length > 0 ? this.asignaturasDisponibles[0].nombre : 'General');

    const payload = {
      asignatura: materiaAAsignar,
      objetivo: this.tipoActividadSeleccionada || this.vitalCampusService.pomodoroObjetivo || 'Taller / Guía',
      duracionMinutos: minutosGuardar,
      fecha: new Date().toISOString().substring(0, 10)
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 Sesión parcial guardada: ${minutosGuardar} min registrados en "${payload.objetivo}" de ${payload.asignatura}.`;
      this.errorMsg = '';
      
      this.vitalCampusService.pomodoroSegundosRestantes = this.minutosPersonalizadosInput * 60;
      this.vitalCampusService.pomodoroSegundosTranscurridosTotal = 0;
      
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 5000);
    });
  }

  reanudarCategoriaEspecifica(materiaNombre: string, categoriaNombre: string): void {
    if (this.vitalCampusService.pausaEnCurso$.getValue()) {
      this.vitalCampusService.mostrarToastGlobal(
        '☕ Pausa Activa en Curso',
        'Debes completar o finalizar tu descanso activo antes de reanudar la sesión de estudio.',
        'ADVERTENCIA',
        false
      );
      return;
    }

    if (this.enfoqueEnCurso) {
      this.pausarEnfoque();
    }

    this.asignaturaSeleccionadaCronometro = materiaNombre;
    this.tipoActividadSeleccionada = categoriaNombre;
    this.vitalCampusService.pomodoroAsignatura = materiaNombre;
    this.vitalCampusService.pomodoroObjetivo = categoriaNombre;
    this.vitalCampusService.pomodoroSegundosRestantes = this.minutosPersonalizadosInput * 60;
    this.vitalCampusService.pomodoroSegundosTranscurridosTotal = 0;

    this.iniciarEnfoque();
  }

  eliminarCategoria(ids: any[]): void {
    if (confirm('¿Deseas eliminar este tiempo acumulado?')) {
      ids.forEach(id => {
        this.vitalCampusService.deleteSesionEstudio(id).subscribe();
      });
      this.procesarAgrupacionPorCategorias();
    }
  }

  formatearTiempo(): string {
    const segTotales = this.segundosRestantes;
    const min = Math.floor(segTotales / 60);
    const seg = segTotales % 60;
    return `${min < 10 ? '0' : ''}${min}:${seg < 10 ? '0' : ''}${seg}`;
  }

  guardarSesionManual(): void {
    if (this.manualHoras <= 0) {
      alert('Ingresa una cantidad de horas válida.');
      return;
    }

    const payload = {
      asignatura: this.manualAsignatura || 'General',
      objetivo: this.manualObjetivo || 'Taller / Guía',
      duracionMinutos: this.manualHoras * 60,
      fecha: this.manualFecha
    };

    this.vitalCampusService.createSesionEstudio(payload).subscribe(() => {
      this.exitoMsg = `🎉 Se agregaron ${this.manualHoras}h de estudio en "${payload.objetivo}" para ${payload.asignatura}.`;
      this.mostrarFormularioManual = false;
      this.procesarAgrupacionPorCategorias();
      setTimeout(() => this.exitoMsg = '', 5000);
    });
  }
}