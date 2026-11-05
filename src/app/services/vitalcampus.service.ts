import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VitalCampusService {
  public usuarioActualSubject$ = new BehaviorSubject<any | null>(null);

  public alertasSubject$ = new BehaviorSubject<any[]>([]);
  public asignaturas$ = new BehaviorSubject<any[]>([]);
  public entregas$ = new BehaviorSubject<any[]>([]);
  public sesionesEstudio$ = new BehaviorSubject<any[]>([]);
  public suenos$ = new BehaviorSubject<any[]>([]);

  // NOTIFICADOR DE AUTO-GUARDADO DE SESIÓN COMPLETADA
  public sesionCompletadaAuto$ = new Subject<boolean>();

  // RIESGO DINÁMICO REACTIVO
  public porcentajeRiesgoActual$ = new BehaviorSubject<number>(0);

  // ESTADO DE PAUSA ACTIVA Y TIEMPO RESTANTE EN SEGUNDOS
  public pausaEnCurso$ = new BehaviorSubject<boolean>(false);
  public segundosRestantesPausa$ = new BehaviorSubject<number>(0);

  public toastNotificacion$ = new BehaviorSubject<any | null>(null);

  // ESTADO GLOBAL DEL CRONÓMETRO DE ESTUDIO
  public pomodoroActivo: boolean = false;
  public pomodoroSegundosRestantes: number = 25 * 60;
  public pomodoroMinutosConfig: number = 25;
  public pomodoroSegundosTranscurridosTotal: number = 0;
  public pomodoroAsignatura: string = '';
  public pomodoroObjetivo: string = 'Taller / Guía';
  public pomodoroModoInvestigacionLibre: boolean = true;
  
  public distraccionesConteo: number = 0;
  private timerInterval: any = null;
  private timerPausaInterval: any = null;

  constructor() {
    this.cargarSesionUsuario();
  }

  private cargarSesionUsuario(): void {
    const rawUser = localStorage.getItem('vc_usuario_actual');
    if (rawUser) {
      try {
        const usuario = JSON.parse(rawUser);
        this.usuarioActualSubject$.next(usuario);
        this.cargarDatosDelUsuario(usuario.email);
      } catch (e) {
        this.cerrarSesionApp();
      }
    }
  }

  private obtenerUsuariosRegistrados(): any[] {
    const raw = localStorage.getItem('vc_usuarios_registrados');
    return raw ? JSON.parse(raw) : [];
  }

  private cargarDatosDelUsuario(email: string): void {
    if (!email) return;
    const emailKey = email.trim().toLowerCase();
    const key = (prefix: string) => `vc_${emailKey}_${prefix}`;

    const rawAlertas = localStorage.getItem(key('alertas'));
    const alertasCargadas: any[] = rawAlertas ? JSON.parse(rawAlertas) : [];

    const alertasDepuradas = alertasCargadas.filter(a => {
      const titulo = (a.titulo || '').toLowerCase();
      return !titulo.includes('tiempo insuficiente') && 
             !titulo.includes('sesión') && 
             !titulo.includes('registrada') && 
             !titulo.includes('creada');
    });

    this.alertasSubject$.next(alertasDepuradas);
    this.guardarEnStorage('alertas', alertasDepuradas);

    const rawAsignaturas = localStorage.getItem(key('asignaturas'));
    this.asignaturas$.next(rawAsignaturas ? JSON.parse(rawAsignaturas) : []);

    const rawEntregas = localStorage.getItem(key('entregas'));
    this.entregas$.next(rawEntregas ? JSON.parse(rawEntregas) : []);

    const rawSuenos = localStorage.getItem(key('suenos'));
    this.suenos$.next(rawSuenos ? JSON.parse(rawSuenos) : []);

    const rawSesiones = localStorage.getItem(key('sesiones'));
    this.sesionesEstudio$.next(rawSesiones ? JSON.parse(rawSesiones) : []);

    this.actualizarRiesgoBasePorEntregas(false);
    this.verificarEntregasCercanas();
    this.verificarCalidadSueno();
  }

  private guardarEnStorage(prefix: string, data: any[]): void {
    const usuario = this.usuarioActualSubject$.getValue();
    if (usuario && usuario.email) {
      const emailKey = usuario.email.trim().toLowerCase();
      const key = `vc_${emailKey}_${prefix}`;
      localStorage.setItem(key, JSON.stringify(data));
    }
  }

  public actualizarRiesgoBasePorEntregas(mostrarToastSiLiberado: boolean = true): void {
    const estresCalc = this.obtenerNivelEstresCalculado();

    this.porcentajeRiesgoActual$.next(estresCalc.porcentaje);

    if (mostrarToastSiLiberado && estresCalc.urgentes === 0) {
      if (this.timerPausaInterval) {
        clearInterval(this.timerPausaInterval);
        this.timerPausaInterval = null;
      }
      this.pausaEnCurso$.next(false);
      this.segundosRestantesPausa$.next(0);

      this.mostrarToastGlobal(
        '✅ Carga Académica Liberada',
        'Se han eliminado o completado las entregas. El nivel de riesgo ha vuelto al 0%.',
        'INFO',
        false
      );
    }
  }

  public iniciarSesion(correo: string, password: string): Observable<any> {
    const usuarios = this.obtenerUsuariosRegistrados();
    const correoLwr = (correo || '').trim().toLowerCase();

    if (!correoLwr.endsWith('@fet.edu.co')) {
      return throwError(() => new Error('Debes usar un correo institucional válido terminado en @fet.edu.co'));
    }

    const usuarioEncontrado = usuarios.find((u: any) => u.email.toLowerCase() === correoLwr);

    if (!usuarioEncontrado) {
      return throwError(() => new Error('El correo electrónico no se encuentra registrado.'));
    }

    if (usuarioEncontrado.password !== password) {
      return throwError(() => new Error('Contraseña incorrecta. Por favor verifica tus datos.'));
    }

    localStorage.setItem('vc_usuario_actual', JSON.stringify(usuarioEncontrado));
    this.usuarioActualSubject$.next(usuarioEncontrado);
    this.cargarDatosDelUsuario(usuarioEncontrado.email);

    return of(usuarioEncontrado);
  }

  public registrarUsuario(datos: any): Observable<any> {
    const usuarios = this.obtenerUsuariosRegistrados();
    const correoLwr = (datos.email || '').trim().toLowerCase();
    const nombreLimpio = (datos.nombre || '').trim();
    const pass = (datos.password || '').trim();

    if (!correoLwr.endsWith('@fet.edu.co')) {
      return throwError(() => new Error('Debes usar un correo institucional válido terminado en @fet.edu.co'));
    }

    if (nombreLimpio.length < 7 || !nombreLimpio.includes(' ')) {
      return throwError(() => new Error('Ingresa un nombre completo válido (ej. Laura Olaya) con al menos nombre y apellido.'));
    }

    const prohibidas = ['123', '1234', '12345', '123456', '12345678', 'password', 'qwerty', 'contrasena'];
    if (pass.length < 6 || prohibidas.includes(pass.toLowerCase()) || !/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) {
      return throwError(() => new Error('La contraseña no cumple con las reglas de seguridad requeridas.'));
    }

    const existe = usuarios.some((u: any) => u.email.toLowerCase() === correoLwr);
    if (existe) {
      return throwError(() => new Error('El correo electrónico ya se encuentra registrado.'));
    }

    const nuevoUsuario = {
      nombre: nombreLimpio,
      email: correoLwr,
      carrera: datos.carrera || 'Ingeniería de Software',
      password: pass
    };

    usuarios.push(nuevoUsuario);
    localStorage.setItem('vc_usuarios_registrados', JSON.stringify(usuarios));

    const key = (prefix: string) => `vc_${correoLwr}_${prefix}`;
    localStorage.setItem(key('alertas'), JSON.stringify([]));
    localStorage.setItem(key('asignaturas'), JSON.stringify([]));
    localStorage.setItem(key('entregas'), JSON.stringify([]));
    localStorage.setItem(key('suenos'), JSON.stringify([]));
    localStorage.setItem(key('sesiones'), JSON.stringify([]));

    localStorage.setItem('vc_usuario_actual', JSON.stringify(nuevoUsuario));
    this.usuarioActualSubject$.next(nuevoUsuario);

    this.alertasSubject$.next([]);
    this.asignaturas$.next([]);
    this.entregas$.next([]);
    this.suenos$.next([]);
    this.sesionesEstudio$.next([]);
    this.porcentajeRiesgoActual$.next(0);

    return of({ exito: true, usuario: nuevoUsuario });
  }

  public cerrarSesionApp(): void {
    this.pausarPomodoro();
    localStorage.removeItem('vc_usuario_actual');
    this.usuarioActualSubject$.next(null);
    this.alertasSubject$.next([]);
    this.asignaturas$.next([]);
    this.entregas$.next([]);
    this.suenos$.next([]);
    this.sesionesEstudio$.next([]);
    this.porcentajeRiesgoActual$.next(0);
  }

  public mostrarToastGlobal(
    titulo: string, 
    mensaje: string, 
    tipo: 'CRITICA' | 'ADVERTENCIA' | 'INFO' = 'INFO',
    guardarEnCampana: boolean = false,
    idUnicoAlert?: string,
    icono?: string
  ): void {
    const idNotificacion = idUnicoAlert || `alert-${Date.now()}`;

    this.toastNotificacion$.next({
      id: idNotificacion,
      titulo,
      mensaje,
      tipo
    });

    setTimeout(() => {
      this.toastNotificacion$.next(null);
    }, 5000);

    const esTiempoInsuficiente = titulo.toLowerCase().includes('tiempo insuficiente');

    if (guardarEnCampana && (tipo === 'CRITICA' || tipo === 'ADVERTENCIA') && !esTiempoInsuficiente) {
      const actuales = this.alertasSubject$.getValue() || [];
      const yaExiste = actuales.some(a => String(a.id) === String(idNotificacion));

      if (!yaExiste) {
        const nuevaAlerta = {
          id: idNotificacion,
          titulo,
          mensaje,
          tipo,
          icono: icono || (tipo === 'CRITICA' ? '⏰' : '⚠️'),
          leida: false,
          fecha: new Date().toISOString().substring(0, 10)
        };

        const actualizadas = [nuevaAlerta, ...actuales];
        this.alertasSubject$.next(actualizadas);
        this.guardarEnStorage('alertas', actualizadas);
      }
    }
  }

  public cerrarToastGlobal(): void {
    this.toastNotificacion$.next(null);
  }

  public reproducirAlarmaAcustica(frecuencia: number = 880, tipoBip: number = 2): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      for (let i = 0; i < tipoBip; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frecuencia, ctx.currentTime + i * 0.3);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + i * 0.3 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.3);
        osc.stop(ctx.currentTime + i * 0.3 + 0.25);
      }
    } catch (e) {
      console.warn('Audio no soportado o bloqueado por interacción del usuario');
    }
  }

  public incrementarRiesgoPorEstudio(incrementoPorcentaje: number = 1): void {}

  public iniciarPausaActiva15Min(): void {
    const riesgoInicial = this.porcentajeRiesgoActual$.getValue();

    if (riesgoInicial < 10) {
      this.mostrarToastGlobal(
        'ℹ️ Pausa No Necesaria',
        'Tu nivel de riesgo académico es mínimo (inferior al 10%). ¡No presentas fatiga mental en este momento!',
        'INFO',
        false
      );
      return;
    }

    if (this.pomodoroActivo) {
      this.pausarPomodoro();
    }

    if (this.timerPausaInterval) clearInterval(this.timerPausaInterval);

    let segundosTotales = 15 * 60;

    let riesgoMetaFinal = 10;
    if (riesgoInicial >= 60) {
      riesgoMetaFinal = 30;
    } else {
      riesgoMetaFinal = Math.max(5, riesgoInicial - 10);
    }

    const cantidadAReducir = Math.max(0, riesgoInicial - riesgoMetaFinal);
    const reduccionPorSegundo = cantidadAReducir > 0 ? cantidadAReducir / segundosTotales : 0;

    this.pausaEnCurso$.next(true);
    this.segundosRestantesPausa$.next(segundosTotales);

    this.mostrarToastGlobal(
      '🛋️ ¡Pausa Activa en Curso!', 
      `Tómate 15 minutos. Tu indicador se despresurizará progresivamente de ${riesgoInicial}% a ${riesgoMetaFinal}%.`, 
      'INFO', 
      false
    );

    this.timerPausaInterval = setInterval(() => {
      segundosTotales--;
      this.segundosRestantesPausa$.next(segundosTotales);

      const actual = this.porcentajeRiesgoActual$.getValue();
      
      if (actual > riesgoMetaFinal) {
        const nuevoRiesgo = Math.max(riesgoMetaFinal, Math.round((actual - reduccionPorSegundo) * 100) / 100);
        this.porcentajeRiesgoActual$.next(nuevoRiesgo);
      }

      if (segundosTotales === 300) {
        this.reproducirAlarmaAcustica(660, 2);
        this.mostrarToastGlobal(
          '⏰ Quedan 5 Minutos',
          'Faltan solo 5 minutos para finalizar tu descanso de 15 min.',
          'ADVERTENCIA',
          false
        );
      }

      if (segundosTotales <= 0) {
        clearInterval(this.timerPausaInterval);
        this.timerPausaInterval = null;
        this.pausaEnCurso$.next(false);
        this.segundosRestantesPausa$.next(0);

        this.reproducirAlarmaAcustica(988, 3);
        this.mostrarToastGlobal(
          '🎉 ¡Pausa Finalizada!',
          'Tus 15 minutos han concluido. Has recuperado un estado de carga estable.',
          'INFO',
          false
        );
      }
    }, 1000);
  }

  public getAsignaturas(): Observable<any[]> {
    return of(this.asignaturas$.getValue());
  }

  public createAsignatura(payload: any): Observable<any> {
    const actuales = this.asignaturas$.getValue();
    const nueva = { id: Date.now(), ...payload };
    const actualizadas = [nueva, ...actuales];
    this.asignaturas$.next(actualizadas);
    this.guardarEnStorage('asignaturas', actualizadas);
    return of(nueva);
  }

  public updateAsignatura(id: any, payload: any): Observable<any> {
    const actuales = this.asignaturas$.getValue();
    const actualizadas = actuales.map(a => a.id === id ? { ...a, ...payload } : a);
    this.asignaturas$.next(actualizadas);
    this.guardarEnStorage('asignaturas', actualizadas);
    return of(payload);
  }

  // ELIMINACIÓN DE ASIGNATURA CON LIMPIEZA EN CASCADA (ENTREGAS Y SESIONES DE ESTUDIO)
  public deleteAsignatura(id: any): Observable<any> {
    const asignaturasActuales = this.asignaturas$.getValue();
    const materiaEncontrada = asignaturasActuales.find(a => String(a.id) === String(id));
    const nombreMateria = materiaEncontrada ? materiaEncontrada.nombre : '';

    // 1. Eliminar la asignatura de la lista
    const asignaturasFiltradas = asignaturasActuales.filter(a => String(a.id) !== String(id));
    this.asignaturas$.next(asignaturasFiltradas);
    this.guardarEnStorage('asignaturas', asignaturasFiltradas);

    if (nombreMateria) {
      const nombreNorm = nombreMateria.trim().toLowerCase();

      // 2. Eliminar entregas asociadas a la asignatura eliminada
      const entregasActuales = this.entregas$.getValue() || [];
      const entregasFiltradas = entregasActuales.filter(e => 
        (e.asignatura || '').trim().toLowerCase() !== nombreNorm
      );

      // Si se eliminaron entregas, limpiar también sus alertas asociadas
      const entregasEliminadas = entregasActuales.filter(e => 
        (e.asignatura || '').trim().toLowerCase() === nombreNorm
      );
      entregasEliminadas.forEach(e => {
        this.eliminarAlertaPorId(`entrega-cercana-${e.id}`);
      });

      this.entregas$.next(entregasFiltradas);
      this.guardarEnStorage('entregas', entregasFiltradas);

      // 3. Eliminar sesiones/horas de estudio registradas asociadas a la asignatura eliminada
      const sesionesActuales = this.sesionesEstudio$.getValue() || [];
      const sesionesFiltradas = sesionesActuales.filter(s => 
        (s.asignatura || '').trim().toLowerCase() !== nombreNorm
      );
      this.sesionesEstudio$.next(sesionesFiltradas);
      this.guardarEnStorage('sesiones', sesionesFiltradas);

      // 4. Recalcular el riesgo reactivo tras el borrado
      this.actualizarRiesgoBasePorEntregas(true);
    }

    return of(true);
  }

  public verificarEntregasCercanas(): void {
    const entregas = this.entregas$.getValue() || [];
    const ahora = new Date().getTime();

    entregas.forEach(e => {
      if (e.estado !== 'COMPLETADA' && e.fechaLimite) {
        const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
        const diffHoras = (limite - ahora) / (1000 * 60 * 60);

        if (diffHoras <= 36) {
          const idAlertaUnica = `entrega-cercana-${e.id}`;
          const yaAlertado = this.alertasSubject$.getValue().some(a => String(a.id) === String(idAlertaUnica));

          if (!yaAlertado) {
            this.mostrarToastGlobal(
              'Entrega Próxima',
              `El trabajo "${e.titulo}" de ${e.asignatura || 'materia'} vence pronto.`,
              'CRITICA',
              true,
              idAlertaUnica,
              '⏰'
            );
          }
        }
      }
    });

    this.actualizarRiesgoBasePorEntregas(false);
  }

  public verificarCalidadSueno(): void {
    const suenos = this.suenos$.getValue() || [];
    const alertasSinSueno = this.alertasSubject$.getValue().filter(a => !String(a.id).startsWith('sueno-bajo-'));
    
    if (suenos.length > 0) {
      const mapaFechas: { [fecha: string]: number } = {};
      suenos.forEach(s => {
        const fecha = s.fecha || new Date().toISOString().substring(0, 10);
        const horasNum = Number(s.horasCalculadas || s.duracion || 0);
        mapaFechas[fecha] = (mapaFechas[fecha] || 0) + horasNum;
      });

      const fechasOrdenadas = Object.keys(mapaFechas).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (fechasOrdenadas.length > 0) {
        const ultimaFecha = fechasOrdenadas[0];
        const totalHorasDia = Math.round(mapaFechas[ultimaFecha] * 10) / 10;

        if (totalHorasDia < 6) {
          const idAlertaSueno = `sueno-bajo-${ultimaFecha}`;
          const nuevaAlerta = {
            id: idAlertaSueno,
            titulo: 'Descanso Insuficiente',
            mensaje: `Registraste ${totalHorasDia}h de sueño el ${ultimaFecha}. Te recomendamos descansar adecuadamente.`,
            tipo: 'ADVERTENCIA',
            icono: '🌙',
            leida: false,
            fecha: ultimaFecha
          };

          const actualizadas = [nuevaAlerta, ...alertasSinSueno];
          this.alertasSubject$.next(actualizadas);
          this.guardarEnStorage('alertas', actualizadas);
          return;
        }
      }
    }

    this.alertasSubject$.next(alertasSinSueno);
    this.guardarEnStorage('alertas', alertasSinSueno);
  }

  public createEntrega(payload: any): Observable<any> {
    const actuales = this.entregas$.getValue();
    const nueva = { id: Date.now(), estado: 'PENDIENTE', ...payload };
    const actualizadas = [nueva, ...actuales];
    this.entregas$.next(actualizadas);
    this.guardarEnStorage('entregas', actualizadas);
    
    this.verificarEntregasCercanas();
    return of(nueva);
  }

  public cambiarEstadoEntrega(id: any, nuevoEstado: string): Observable<any> {
    const actuales = this.entregas$.getValue();
    const actualizadas = actuales.map(e => e.id === id ? { ...e, estado: nuevoEstado } : e);
    this.entregas$.next(actualizadas);
    this.guardarEnStorage('entregas', actualizadas);

    if (nuevoEstado === 'COMPLETADA') {
      const idAlerta = `entrega-cercana-${id}`;
      this.eliminarAlertaPorId(idAlerta);
    }

    this.actualizarRiesgoBasePorEntregas(true);
    return of(true);
  }

  public deleteEntrega(id: any): Observable<any> {
    const actuales = this.entregas$.getValue().filter(e => e.id !== id);
    this.entregas$.next(actuales);
    this.guardarEnStorage('entregas', actuales);

    const idAlerta = `entrega-cercana-${id}`;
    this.eliminarAlertaPorId(idAlerta);

    this.actualizarRiesgoBasePorEntregas(true);
    return of(true);
  }

  public eliminarAlertaPorId(id: any): void {
    const actuales = this.alertasSubject$.getValue().filter(a => String(a.id) !== String(id));
    this.alertasSubject$.next(actuales);
    this.guardarEnStorage('alertas', actuales);
  }

  public createSueno(payload: any): Observable<any> {
    const actuales = this.suenos$.getValue();
    const horasNum = Number(payload.horasCalculadas || payload.duracion || 0);
    const registroCorregido = {
      ...payload,
      id: Date.now(),
      horasCalculadas: horasNum,
      duracion: horasNum
    };

    const actualizadas = [registroCorregido, ...actuales];
    this.suenos$.next(actualizadas);
    this.guardarEnStorage('suenos', actualizadas);

    this.verificarCalidadSueno();
    return of(registroCorregido);
  }

  public deleteSueno(id: any): Observable<any> {
    const actuales = this.suenos$.getValue().filter(s => s.id !== id);
    this.suenos$.next(actuales);
    this.guardarEnStorage('suenos', actuales);
    this.verificarCalidadSueno();
    return of(true);
  }

  public iniciarPomodoro(minutos: number): void {
    if (this.pausaEnCurso$.getValue()) return;

    this.pomodoroMinutosConfig = minutos;
    this.pomodoroActivo = true;

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.pomodoroSegundosRestantes > 0) {
        this.pomodoroSegundosRestantes--;
        this.pomodoroSegundosTranscurridosTotal++;
      } else {
        this.pausarPomodoro();
        this.reproducirAlarmaAcustica(880, 3);
        this.sesionCompletadaAuto$.next(true);
      }
    }, 1000);
  }

  public pausarPomodoro(): void {
    this.pomodoroActivo = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  public registrarDistraccion(): void {
    this.distraccionesConteo++;
    this.pomodoroSegundosRestantes += 120;

    this.mostrarToastGlobal(
      '⚠️ Distracción Detectada (+2 min)',
      'Cambiaste de pestaña en Modo Estricto. Se agregaron +2 minutos al temporizador.',
      'ADVERTENCIA',
      true,
      `distraccion-${Date.now()}`,
      '⚠️'
    );
  }

  public createSesionEstudio(payload: any): Observable<any> {
    const actuales = this.sesionesEstudio$.getValue() || [];
    const nueva = { id: Date.now(), ...payload };
    const actualizadas = [nueva, ...actuales];
    
    this.sesionesEstudio$.next(actualizadas);
    this.guardarEnStorage('sesiones', actualizadas);

    return of(nueva);
  }

  public deleteSesionEstudio(id: any): Observable<any> {
    const actuales = this.sesionesEstudio$.getValue().filter(s => s.id !== id);
    this.sesionesEstudio$.next(actuales);
    this.guardarEnStorage('sesiones', actuales);
    return of(true);
  }

  public obtenerNivelEstresCalculado(): { porcentaje: number; sobrecargado: boolean; urgentes: number; nivelMaximo: number } {
    const entregas = this.entregas$.getValue() || [];
    const entregasPendientes = entregas.filter(e => e.estado !== 'COMPLETADA');

    if (entregasPendientes.length === 0) {
      return { porcentaje: 0, sobrecargado: false, urgentes: 0, nivelMaximo: 0 };
    }

    const ahora = new Date().getTime();
    let riesgoAcumulado = 0;
    let maxEstresPonderado = 0;

    entregasPendientes.forEach(e => {
      const estresBase = Number(e.estresPercibido || e.estresBase || 3);
      let aporteBaseUrgencia = 5;

      if (e.fechaLimite) {
        const limite = new Date(`${e.fechaLimite}T${e.horaLimite || '23:59'}:00`).getTime();
        const diffHoras = (limite - ahora) / (1000 * 60 * 60);

        if (diffHoras <= 36) {
          aporteBaseUrgencia = 15;
        } else if (diffHoras <= 120) {
          aporteBaseUrgencia = 10;
        } else {
          aporteBaseUrgencia = 5;
        }
      }

      const porcentajeTarea = aporteBaseUrgencia * (estresBase / 5);
      riesgoAcumulado += porcentajeTarea;

      if (estresBase > maxEstresPonderado) {
        maxEstresPonderado = estresBase;
      }
    });

    const porcentajeFinal = Math.min(100, Math.round(riesgoAcumulado));
    const nivelMaximoFinal = Math.max(1, Math.round((porcentajeFinal / 100) * 5));

    return { 
      porcentaje: porcentajeFinal, 
      sobrecargado: porcentajeFinal >= 60, 
      urgentes: entregasPendientes.length,
      nivelMaximo: nivelMaximoFinal 
    };
  }

  public limpiarTodasLasAlertas(): void {
    this.alertasSubject$.next([]);
    this.guardarEnStorage('alertas', []);
  }

  // CÁLCULO DEL PROMEDIO DECIMAL REAL DE ESTRÉS DE LAS ENTREGAS PENDIENTES
  public getDashboardResumen(): Observable<any> {
    const asigs = this.asignaturas$.getValue() || [];
    const suenos = this.suenos$.getValue() || [];
    const entregas = this.entregas$.getValue() || [];
    const pendientes = entregas.filter(e => e.estado !== 'COMPLETADA');

    const cargaPorcentaje = Math.min(100, asigs.length * 25);
    let nivelCargaTexto = 'Sin Asignaturas';
    if (asigs.length >= 4) nivelCargaTexto = 'Alta';
    else if (asigs.length >= 2) nivelCargaTexto = 'Equilibrada';
    else if (asigs.length === 1) nivelCargaTexto = 'Baja';

    let suenoAnocheTexto = '0h';
    let tituloSuenoLabel = '🌙 Sueño de Anoche';
    let promedioSuenoTexto = '0h';

    const hoyObj = new Date();
    const diaSemana = hoyObj.getDay();
    const diffLunes = hoyObj.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);

    const inicioLunes = new Date(hoyObj.getFullYear(), hoyObj.getMonth(), diffLunes, 0, 0, 0);
    const finDomingo = new Date(inicioLunes.getFullYear(), inicioLunes.getMonth(), inicioLunes.getDate() + 6, 23, 59, 59);

    if (suenos.length > 0) {
      const mapaFechasSemanaActual: { [fecha: string]: number } = {};
      const mapaFechasGlobales: { [fecha: string]: number } = {};

      suenos.forEach(s => {
        if (!s.fecha) return;
        const partes = s.fecha.split('-').map(Number);
        const fObj = new Date(partes[0], partes[1] - 1, partes[2]);
        const horasNum = Number(s.horasCalculadas || s.duracion || 0);

        if (horasNum > 0) {
          mapaFechasGlobales[s.fecha] = horasNum;

          if (fObj >= inicioLunes && fObj <= finDomingo) {
            mapaFechasSemanaActual[s.fecha] = horasNum;
          }
        }
      });

      const fechasGlobalesOrdenadas = Object.keys(mapaFechasGlobales).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      
      if (fechasGlobalesOrdenadas.length > 0) {
        const fechaMasReciente = fechasGlobalesOrdenadas[0];
        const totalReciente = Math.round(mapaFechasGlobales[fechaMasReciente] * 10) / 10;
        
        const year = hoyObj.getFullYear();
        const month = String(hoyObj.getMonth() + 1).padStart(2, '0');
        const day = String(hoyObj.getDate()).padStart(2, '0');
        const fechaHoyStr = `${year}-${month}-${day}`;

        if (fechaMasReciente === fechaHoyStr) {
          suenoAnocheTexto = `${totalReciente}h`;
          tituloSuenoLabel = '🌙 Sueño de Anoche';
        } else {
          suenoAnocheTexto = `${totalReciente}h`;
          tituloSuenoLabel = `🌙 Último Registro (${fechaMasReciente})`;
        }
      }

      const fechasSemanaActual = Object.keys(mapaFechasSemanaActual);
      if (fechasSemanaActual.length > 0) {
        const sumaHorasSemana = Object.values(mapaFechasSemanaActual).reduce((acc, h) => acc + h, 0);
        const promedio = Math.round((sumaHorasSemana / fechasSemanaActual.length) * 10) / 10;
        promedioSuenoTexto = `${promedio}h`;
      }
    }

    // PROMEDIO DECIMAL EXACTO DE ESTRÉS PERCIBIDO
    let estresNivel = '0/5';
    let nivelEstres = 'Sin Riesgo';

    if (pendientes.length > 0) {
      const sumaEstres = pendientes.reduce((acc, e) => acc + Number(e.estresPercibido || e.estresBase || 3), 0);
      const promedioEstres = Math.round((sumaEstres / pendientes.length) * 10) / 10;
      
      estresNivel = `${promedioEstres}/5`;

      if (promedioEstres >= 4.5) nivelEstres = 'Crítico';
      else if (promedioEstres >= 3.5) nivelEstres = 'Alto';
      else if (promedioEstres >= 2.5) nivelEstres = 'Moderado';
      else nivelEstres = 'Bajo';
    }

    return of({
      suenoAnoche: suenoAnocheTexto,
      tituloSueno: tituloSuenoLabel,
      promedioSueno: promedioSuenoTexto,
      cargaAcademica: `${cargaPorcentaje}%`,
      nivelCarga: nivelCargaTexto,
      nivelEstres: nivelEstres,
      estresNivel: estresNivel,
      recomendacion: asigs.length === 0 
        ? 'Aún no has registrado asignaturas. Agrega tus materias para llevar el control de tu carga.' 
        : 'Mantén el ritmo. Recuerda realizar pausas cortas durante tus sesiones de estudio.'
    });
  }
}