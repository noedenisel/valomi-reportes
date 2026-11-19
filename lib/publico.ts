// Lo único que sale del servidor hacia el mapa público. Nunca incluye el punto exacto ni los archivos originales.
import type { Reporte } from './tipos.ts';
import { esMomentoVisible } from './reglas.ts';

export type ReportePublico = {
  numero: string;
  tipo: string;
  descripcion: string;
  editado: boolean;
  estado: Reporte['estadoPublico'];
  revisado: boolean;
  momento: number;
  zona: { lon: number; lat: number } | null;
  celda: string | null;
  fotos: string[];
  adjuntosEnRevision: boolean;
  demo: boolean;
};

export function esVisible(r: Reporte, ahora = Date.now()) {
  return r.estado !== 'retenido' && esMomentoVisible(r.momento, ahora);
}

export function aPublico(r: Reporte): ReportePublico {
  return {
    numero: r.numero,
    tipo: r.tipo,
    descripcion: r.descripcion,
    editado: r.editado,
    estado: r.estadoPublico,
    revisado: r.estado === 'publicado-revisado',
    momento: r.momento,
    zona: r.zonaSuprimida ? null : { lon: r.celda.lon, lat: r.celda.lat },
    celda: r.zonaSuprimida ? null : r.celda.id,
    fotos: r.adjuntos.filter((a) => a.estado === 'publicado' && a.publico).map((a) => `/api/adjuntos/${a.id}`),
    adjuntosEnRevision: r.adjuntos.some((a) => a.estado === 'en-revision'),
    demo: Boolean(r.demo),
  };
}
