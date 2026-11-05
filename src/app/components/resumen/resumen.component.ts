import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VitalCampusService } from '../../services/vitalcampus.service';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.component.html',
  styleUrls: ['./resumen.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class ResumenComponent implements OnInit {
  dashboardData: any = null;
  alertas: any[] = [];
  mostrarPanelAlertas: boolean = false;
  porcentajeRiesgo: number = 0;

  pausaActivaEnCurso: boolean = false;
  segundosRestantesPausa: number = 0;

  mensajeGalleta: string = 'Haz clic para abrir tu fortuna diaria.';
  galletaAbierta: boolean = false;

  entregasProximas: any[] = [];
  diagramaPicos: { dia: string; x: number; y: number }[] = [];

  pathLineaSvg: string = '';
  pathAreaSvg: string = '';

  private fortunas: string[] = [
    '✨ Un paso a la vez te llevará tan lejos como desees.',
    '🎓 El esfuerzo de hoy es el éxito de mañana.',
    '💡 Recuerda descansar: la mente fresca aprende mejor.',
    '🚀 Organizar tu tiempo es darte paz mental.',
    '🌟 ¡Confía en tus habilidades, vas por excelente camino!'
  ];

  constructor(public vitalCampusService: VitalCampusService) {}

  ngOnInit(): void {
    this.cargarDatosDashboard();
    this.suscripcionesServicio();
  }

  cargarDatosDashboard(): void {
    this.vitalCampusService.getDashboardResumen().subscribe(data => {
      this.dashboardData = data;
    });
  }

  suscripcionesServicio(): void {
    this.vitalCampusService.alertasSubject$.subscribe(a => {
      this.alertas = a || [];
    });

    this.vitalCampusService.porcentajeRiesgoActual$.subscribe(r => {
      this.porcentajeRiesgo = Math.round(r);
    });

    this.vitalCampusService.pausaEnCurso$.subscribe(enPausa => {
      this.pausaActivaEnCurso = enPausa;
    });

    this.vitalCampusService.segundosRestantesPausa$.subscribe(seg => {
      this.segundosRestantesPausa = seg;
    });

    this.vitalCampusService.entregas$.subscribe(entregas => {
      this.procesarEntregasProximas(entregas || []);
    });

    this.vitalCampusService.suenos$.subscribe(suenos => {
      this.procesarDiagramaSueño(suenos || []);
    });
  }

  togglePanelAlertas(): void {
    this.mostrarPanelAlertas = !this.mostrarPanelAlertas;
  }

  aplicarPausa15Min(): void {
    this.vitalCampusService.iniciarPausaActiva15Min();
  }

  // MÉTODO AUXILIAR PARA CÁLCULO DINÁMICO DE LA ETIQUETA DEL BOTÓN
  calcularReduccionPausa(): number {
    if (this.porcentajeRiesgo >= 60) {
      return this.porcentajeRiesgo - 30; // Reduce de zona Crítica (Rojo) a 30% (Verde/Estable)
    }
    const meta = Math.max(5, this.porcentajeRiesgo - 10);
    return this.porcentajeRiesgo - meta;
  }

  formatearTiempoSegundos(segundos: number): string {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${mins}:${segs < 10 ? '0' : ''}${segs}`;
  }

  descartarAlertaIndividual(id: any): void {
    this.vitalCampusService.eliminarAlertaPorId(id);
  }

  abrirGalleta(): void {
    const idx = Math.floor(Math.random() * this.fortunas.length);
    this.mensajeGalleta = this.fortunas[idx];
    this.galletaAbierta = true;
  }

  procesarEntregasProximas(entregas: any[]): void {
    const ahora = new Date().getTime();
    const pendientes = entregas.filter(e => e.estado !== 'COMPLETADA');

    this.entregasProximas = pendientes.map(e => {
      let etiqueta = 'Próximo';
      if (e.fechaLimite) {
        const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
        const diffHoras = (limite - ahora) / (1000 * 60 * 60);

        if (diffHoras <= 24 && diffHoras >= 0) etiqueta = 'Hoy';
        else if (diffHoras <= 48 && diffHoras > 24) etiqueta = 'Mañana';
        else etiqueta = 'Esta semana';
      }
      return { ...e, etiquetaTiempo: etiqueta };
    }).slice(0, 3);
  }

  procesarDiagramaSueño(suenos: any[]): void {
    const dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];
    const mapa: { [d: string]: number } = { LUN: 0, MAR: 0, MIE: 0, JUE: 0, VIE: 0, SAB: 0, DOM: 0 };

    suenos.forEach(s => {
      if (s.fecha) {
        const partes = s.fecha.split('-').map(Number);
        const dateObj = new Date(partes[0], partes[1] - 1, partes[2]);
        let idx = dateObj.getDay() - 1;
        if (idx === -1) idx = 6;
        const clave = dias[idx];
        const h = Number(s.horasCalculadas || s.duracion || 0);
        mapa[clave] = Math.round(((mapa[clave] || 0) + h) * 10) / 10;
      }
    });

    const paddingX = 25;
    const widthDisponible = 380 - (paddingX * 2);
    const stepX = widthDisponible / 6;

    this.diagramaPicos = dias.map((dia, index) => {
      const x = Math.round(paddingX + (index * stepX));
      const horas = mapa[dia] || 0;
      const y = Math.round(105 - Math.min((horas / 10) * 90, 90));
      return { dia, x, y };
    });

    if (this.diagramaPicos.length > 0) {
      const puntos = this.diagramaPicos.map(p => `${p.x},${p.y}`).join(' L ');
      this.pathLineaSvg = `M ${puntos}`;
      const primerX = this.diagramaPicos[0].x;
      const ultimoX = this.diagramaPicos[this.diagramaPicos.length - 1].x;
      this.pathAreaSvg = `M ${primerX},115 L ${puntos} L ${ultimoX},115 Z`;
    }
  }
}