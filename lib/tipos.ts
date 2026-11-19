// Tipos compartidos por el servidor y por el modo demostración en el navegador.

export type EstadoInterno = 'publicado-sin-revisar' | 'retenido' | 'publicado-revisado';
export type EstadoPublico = 'sin-verificar' | 'revisado' | 'corroborado';
export type MetodoConfirmacion = 'fuente-oficial' | 'prensa' | 'prueba' | 'visita' | 'contacto';

export type Adjunto = {
  id: string;
  clase: 'foto' | 'video';
  mime: string;
  bytes: number;
  /** Archivo original, privado: solo lo ve la moderación. Se borra a los 30 días del hecho. */
  original: string | null;
  /** Copia difuminada y sin metadatos que se publica. */
  publico: string | null;
  estado: 'en-revision' | 'publicado' | 'no-publicar';
};

export type Reporte = {
  id: string;
  numero: string;
  codigoHash: string;
  tipo: string;
  descripcion: string;
  editado: boolean;
  /** Punto exacto: solo moderación. Se borra a los 30 días del hecho. */
  exacto: { lon: number; lat: number } | null;
  celda: { id: string; lon: number; lat: number };
  zonaSuprimida: boolean;
  riesgo: 'no' | 'si' | 'nose';
  momento: number;
  creado: number;
  estado: EstadoInterno;
  estadoPublico: EstadoPublico;
  avisoDatos: string[];
  adjuntos: Adjunto[];
  confirmacion: { metodo: MetodoConfirmacion; fuente: string | null } | null;
  demo?: boolean;
};

export type Solicitud = {
  id: string;
  numero: string;
  relacion: 'autor' | 'afectado' | 'otra';
  referencia: string;
  reporteId: string | null;
  motivo: string;
  correo: string | null;
  prioridad: boolean;
  creada: number;
  estado: 'pendiente' | 'borrado' | 'rechazada';
  resuelta: number | null;
};

export type LineaRegistro = { fecha: number; accion: string; numero?: string; detalle?: string };

/** Cantidades de un mes, por estado público. */
export type PorEstado = { 'sin-verificar': number; revisado: number; corroborado: number };

/** Informe mensual del Observatorio Vecinal: solo datos agregados, sin textos, fotos, números ni puntos exactos. */
export type DatosMes = {
  periodo: string; // AAAA-MM, hora de Argentina
  total: number;
  porEstado: PorEstado;
  porCategoria: Record<string, PorEstado>;
  celdas: { id: string; lon: number; lat: number; cantidad: number }[];
  sinZona: number;
};

export type InformeMensual = {
  id: string;
  periodo: string;
  generado: number;
  datos: DatosMes;
  estado: 'borrador' | 'aprobado' | 'retirado';
  aprobado: { por: string; fecha: number } | null;
  demo?: boolean;
};

export type Base = {
  reportes: Reporte[];
  solicitudes: Solicitud[];
  registro: LineaRegistro[];
  contador: number;
  informes?: InformeMensual[];
};
