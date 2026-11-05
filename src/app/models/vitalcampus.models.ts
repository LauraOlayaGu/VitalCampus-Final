export interface Usuario {
  id: number;
  nombreCompleto: string;
  correo: string;
  rol: string;
}

export interface RegistroSueno {
  id: number;
  usuarioId: number;
  fecha: string;
  horaDormir: string;
  horaDespertar: string;
  horasSueno: number;
  calidadSueno: number;
  observacion?: string | null;
  createdAt?: string;
}

export interface RegistroSuenoInput {
  fecha: string;
  horaDormir: string;
  horaDespertar: string;
  calidadSueno: number;
  observacion?: string;
  nivelEstres?: number;
}

export interface ResumenSuenoSemanal {
  promedioHorasSemanal: number;
  promedioCalidadSemanal: number;
  totalRegistros: number;
  cumpleMetaMinima: boolean;
}

export interface Asignatura {
  id: number;
  usuarioId: number;
  nombre: string;
  codigo?: string | null;
  creditos?: number | null;
  color?: string | null;
  activa: boolean;
  createdAt?: string;
  _count?: {
    entregas: number;
    registrosEstudio: number;
  };
}

export interface AsignaturaInput {
  nombre: string;
  codigo?: string;
  creditos?: number;
  color?: string;
  activa?: boolean;
}

export interface EntregaAcademica {
  id: number;
  asignaturaId: number;
  titulo: string;
  tipo: 'TAREA' | 'ENTREGA' | 'PARCIAL' | 'QUIZ' | 'PROYECTO' | string;
  fechaLimite: string;
  porcentajePeso?: number | null;
  estado: 'PENDIENTE' | 'EN_PROGRESO' | 'COMPLETADA' | string;
  createdAt?: string;
  asignatura?: {
    id: number;
    nombre: string;
    color?: string | null;
  };
}

export interface EntregaAcademicaInput {
  asignaturaId: number;
  titulo: string;
  tipo: string;
  fechaLimite: string;
  porcentajePeso?: number;
  estado?: string;
}

export interface RegistroEstudio {
  id: number;
  asignaturaId: number;
  fecha: string;
  horasEstudio: number;
  observacion?: string | null;
  createdAt?: string;
  asignatura?: {
    id: number;
    nombre: string;
    color?: string | null;
  };
}

export interface RegistroEstudioInput {
  asignaturaId: number;
  fecha: string;
  horasEstudio: number;
  observacion?: string;
}

export interface Alerta {
  id: number;
  usuarioId: number;
  tipo: 'CARGA_ACADEMICA' | 'SUENO' | 'ESTRES' | 'RECOMENDACION' | string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | string;
  mensaje: string;
  leida: boolean;
  fechaGeneracion: string;
}

export interface CargaSemanalInfo {
  totalHorasEstudioUltimos7Dias: number;
  cargaSemanalPorcentaje: number;
  umbralMaximoRecomendadoPorcentaje: number;
  superaUmbralCarga: boolean;
  promedioSuenoUltimos7Dias: number;
  nivelEstresActual: number;
  calculoFormula?: string;
}

export interface ResumenEstudioAsignatura {
  asignaturaId: number;
  nombreAsignatura: string;
  color?: string | null;
  horasEstudio: number;
}

export interface DashboardResumen {
  usuario: Usuario;
  indicadores: {
    cargaSemanalPorcentaje: number;
    totalHorasEstudio7Dias: number;
    promedioSueno7Dias: number;
    nivelEstresActual: number;
    entregasPendientesCount: number;
    alertasNoLeidasCount: number;
  };
  alertas: Alerta[];
  proximasEntregas: EntregaAcademica[];
  resumenSueno: {
    promedioHoras: number;
    registros: RegistroSueno[];
  };
  resumenEstudio: ResumenEstudioAsignatura[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  resumen?: ResumenSuenoSemanal;
  registros?: RegistroSueno[];
  error?: string;
  message?: string;
}
