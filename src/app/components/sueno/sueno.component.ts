import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-sueno',
  templateUrl: './sueno.component.html',
  styleUrls: ['./sueno.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class SuenoComponent implements OnInit {
  fechaMinima: string = '';
  fechaMaxima: string = '';
  fechaRegistro: string = '';
  
  horaDormir: string = '23:00';
  horaDespertar: string = '07:00';
  calidadSeleccionada: string = 'Bueno';
  observaciones: string = '';

  horasCalculadas: number = 8;
  historialSueno: any[] = [];
  mapaDiaSemana: { [dia: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };
  
  // NUEVA PROPIEDAD: HISTORIAL DE PROMEDIOS SEMANALES
  promediosSemanales: any[] = [];

  errorMsg: string = '';

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.establecerRangoSemanaActual();
    this.calcularHoras();
    this.suscripcionHistorial();
  }

  // CALCULA EL LUNES DE LA SEMANA ACTUAL Y LA FECHA MÁXIMA (HOY)
  establecerRangoSemanaActual(): void {
    const hoy = new Date();
    const formatoFecha = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    this.fechaMaxima = formatoFecha(hoy);
    this.fechaRegistro = this.fechaMaxima;

    const diaSemana = hoy.getDay();
    const diffLunes = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const lunesActual = new Date(hoy.getFullYear(), hoy.getMonth(), diffLunes);

    this.fechaMinima = formatoFecha(lunesActual);
  }

  calcularHoras(): void {
    if (!this.horaDormir || !this.horaDespertar) {
      this.horasCalculadas = 0;
      return;
    }

    const [h1, m1] = this.horaDormir.split(':').map(Number);
    const [h2, m2] = this.horaDespertar.split(':').map(Number);

    let min1 = h1 * 60 + m1;
    let min2 = h2 * 60 + m2;

    if (min2 <= min1) {
      min2 += 24 * 60;
    }

    const diffMin = min2 - min1;
    this.horasCalculadas = Math.round((diffMin / 60) * 10) / 10;
  }

  seleccionarCalidad(calidad: string): void {
    this.calidadSeleccionada = calidad;
  }

  suscripcionHistorial(): void {
    this.vitalCampusService.suenos$.subscribe(registros => {
      this.historialSueno = registros || [];
      this.procesarDiagramaSemanal(this.historialSueno);
      this.calcularPromediosSemanalesPasados(this.historialSueno);
    });
  }

  // FILTRA Y GRAFICA ÚNICAMENTE LA SEMANA EN CURSO
  procesarDiagramaSemanal(registros: any[]): void {
    const mapa: { [dia: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };
    const diasClave = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diffLunes = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    
    const inicioLunes = new Date(hoy.getFullYear(), hoy.getMonth(), diffLunes, 0, 0, 0);
    const finDomingo = new Date(inicioLunes.getFullYear(), inicioLunes.getMonth(), inicioLunes.getDate() + 6, 23, 59, 59);

    const registrosSemanaActual = registros.filter(s => {
      if (!s.fecha) return false;
      const partes = s.fecha.split('-').map(Number);
      const fObj = new Date(partes[0], partes[1] - 1, partes[2]);
      return fObj >= inicioLunes && fObj <= finDomingo;
    });

    const mapaFechasUnicas: { [fecha: string]: any } = {};
    registrosSemanaActual.forEach(s => {
      if (s.fecha) {
        mapaFechasUnicas[s.fecha] = s;
      }
    });

    Object.values(mapaFechasUnicas).forEach((s: any) => {
      if (s.fecha) {
        const partes = s.fecha.split('-').map(Number);
        const dateObj = new Date(partes[0], partes[1] - 1, partes[2]);
        
        let dayIdx = dateObj.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;

        const clave = diasClave[dayIdx];
        const h = Number(s.horasCalculadas || s.duracion || 0);
        
        if (clave && !isNaN(h)) {
          mapa[clave] = Math.round(h * 10) / 10;
        }
      }
    });

    this.mapaDiaSemana = mapa;
  }

  // NUEVA FUNCIÓN: AGRUPA Y CALCULA PROMEDIOS DE SEMANAS ANTERIORES
  calcularPromediosSemanalesPasados(registros: any[]): void {
    if (!registros || registros.length === 0) {
      this.promediosSemanales = [];
      return;
    }

    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diffLunes = hoy.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const inicioLunesActual = new Date(hoy.getFullYear(), hoy.getMonth(), diffLunes, 0, 0, 0);

    // Agrupar por rango de semana (Año-Semana)
    const gruposSemanas: { [rango: string]: { suma: number; diasCount: number; inicio: string; fin: string } } = {};

    registros.forEach(s => {
      if (!s.fecha) return;
      const partes = s.fecha.split('-').map(Number);
      const fObj = new Date(partes[0], partes[1] - 1, partes[2]);

      // Solo procesar semanas pasadas (anteriores al Lunes actual)
      if (fObj < inicioLunesActual) {
        const dSem = fObj.getDay();
        const dLunes = fObj.getDate() - dSem + (dSem === 0 ? -6 : 1);
        const lunesSemana = new Date(fObj.getFullYear(), fObj.getMonth(), dLunes);
        const domingoSemana = new Date(lunesSemana.getFullYear(), lunesSemana.getMonth(), lunesSemana.getDate() + 6);

        const formato = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const claveRango = `${formato(lunesSemana)} al ${formato(domingoSemana)}`;

        const horasNum = Number(s.horasCalculadas || s.duracion || 0);

        if (!gruposSemanas[claveRango]) {
          gruposSemanas[claveRango] = {
            suma: 0,
            diasCount: 0,
            inicio: formato(lunesSemana),
            fin: formato(domingoSemana)
          };
        }

        gruposSemanas[claveRango].suma += horasNum;
        gruposSemanas[claveRango].diasCount += 1;
      }
    });

    const resultado: any[] = [];
    Object.keys(gruposSemanas).forEach(rango => {
      const item = gruposSemanas[rango];
      const promedio = Math.round((item.suma / item.diasCount) * 10) / 10;
      resultado.push({
        rangoFecha: rango,
        promedio: promedio,
        totalDias: item.diasCount,
        cumpleMeta: promedio >= 6
      });
    });

    // Ordenar de la más reciente a la más antigua
    this.promediosSemanales = resultado.sort((a, b) => b.rangoFecha.localeCompare(a.rangoFecha));
  }

  calcularAlturaBarra(horas: number): number {
    if (!horas || horas <= 0) return 0;
    const porcentaje = (horas / 10) * 100;
    return Math.min(porcentaje, 100);
  }

  registrarSueno(): void {
    this.errorMsg = '';

    if (this.fechaRegistro > this.fechaMaxima) {
      this.errorMsg = '⚠️ No puedes registrar horas de sueño para fechas futuras.';
      this.vitalCampusService.mostrarToastGlobal('Fecha Inválida', this.errorMsg, 'ADVERTENCIA', false);
      setTimeout(() => this.errorMsg = '', 4000);
      return;
    }

    if (this.fechaRegistro < this.fechaMinima) {
      this.errorMsg = '⚠️ Solo puedes registrar o ajustar fechas pertenecientes a la semana en curso.';
      this.vitalCampusService.mostrarToastGlobal('Fecha Inválida', this.errorMsg, 'ADVERTENCIA', false);
      setTimeout(() => this.errorMsg = '', 4000);
      return;
    }

    if (this.horasCalculadas <= 0) return;

    const nuevoRegistro = {
      id: Date.now(),
      fecha: this.fechaRegistro,
      horaDormir: this.horaDormir,
      horaDespertar: this.horaDespertar,
      horasCalculadas: Number(this.horasCalculadas),
      duracion: Number(this.horasCalculadas),
      calidad: this.calidadSeleccionada,
      observaciones: this.observaciones
    };

    const actuales = this.vitalCampusService.suenos$.getValue() || [];
    const existentesEnMismaFecha = actuales.filter(s => s.fecha === this.fechaRegistro);
    existentesEnMismaFecha.forEach(e => {
      this.vitalCampusService.deleteSueno(e.id).subscribe();
    });

    this.vitalCampusService.createSueno(nuevoRegistro).subscribe(() => {
      this.observaciones = '';
      this.vitalCampusService.mostrarToastGlobal(
        '🌙 Sueño Registrado',
        `Se han actualizado tus ${this.horasCalculadas} hrs de descanso para la fecha ${this.fechaRegistro}.`,
        'INFO',
        false
      );
    });
  }

  eliminarRegistro(id: any): void {
    this.vitalCampusService.deleteSueno(id).subscribe();
  }
}