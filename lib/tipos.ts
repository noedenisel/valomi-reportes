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
  /** Origen editorial: nunca se mezcla con la serie de reportes ciudadanos. */
  origen?: 'relevamiento-valomi';
  relevamientoId?: string;
  demo?: boolean;
};

export type FuenteRelevamiento = {
  nombre: string;
  plataforma: string;
  url: string | null;
  fechaPublicacion: string | null;
};

export type CamposRelevamiento = {
  categoria: string | null;
  resumen: string;
  fechaHecho: string | null;
  horaHecho: string | null;
  localidad: string | null;
  referencia: string | null;
  punto: { lon: number; lat: number } | null;
  riesgo: 'no' | 'si' | 'nose';
  fuentes: FuenteRelevamiento[];
};

export type FichaRelevamiento = CamposRelevamiento & {
  id: string;
  identificador: string;
  origen: 'relevamiento-valomi';
  textoOriginal: string | null;
  importado: number;
  actualizado: number;
  aprobado: number | null;
  estado: 'pendiente' | 'aprobado' | 'vinculado' | 'descartado' | 'retirado';
  destino: 'archivo' | 'mapa' | null;
  vinculadoA: string | null;
  reporteId: string | null;
  fuentesRevisadas: boolean;
  duplicadosRevisados: boolean;
};

export type FichaRelevamientoVista = FichaRelevamiento & {
  faltantes: string[];
  avisoDatos: string[];
  posiblesDuplicados: { id: string; identificador: string }[];
  anclaConservacion: number;
};

export type ResumenRelevamientos = {
  origen: 'Relevamiento VaLoMi';
  total: number;
  mapa: number;
  archivo: number;
  sinFecha: number;
  porFecha: Record<string, number>;
  porMes: Record<string, number>;
  porCategoria: Record<string, number>;
  porZona: Record<string, number>;
};

export type VistaRelevamientos = {
  fichas: FichaRelevamientoVista[];
  resumen: ResumenRelevamientos;
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
  relevamientos?: FichaRelevamiento[];
};
