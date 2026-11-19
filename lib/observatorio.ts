// Observatorio Vecinal: informe mensual de «Reportes ciudadanos recibidos por VaLoMi».
// Reglas aprobadas el 31/10/2026:
// - Se cuentan todos los reportes recibidos, separados por estado; los «Sin verificar» se incluyen, diferenciados.
// - Los retirados y rechazados se excluyen por completo (en el almacén ya no existen: se borran al retirarlos).
// - Nunca se presentan como delitos ni como estadísticas oficiales; sin conclusiones automáticas ni comparaciones entre meses.
// Criterios de implementación (especificación V2, capítulo 9): mes calendario en hora de Argentina según la fecha del hecho;
// los retenidos cuentan recién cuando Gabriel los publica; mapa de calor por celdas de 200 m, sin los reportes con zona suprimida.
import { PLAZO_REVISION_H, TIPOS } from './reglas.ts';
import type { Base, DatosMes, InformeMensual, PorEstado } from './tipos.ts';

const AR = -3 * 3600_000; // Argentina, UTC−3 todo el año
export const LEYENDA =
  'Reportes ciudadanos recibidos por VaLoMi. No son estadísticas oficiales ni registros de delitos. Los reportes sin verificar todavía no fueron revisados; los revisados cumplen las reglas de publicación sin confirmar el hecho; los corroborados tienen una confirmación.';
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 2026-09 → «septiembre de 2026». */
export function nombreMes(periodo: string) {
  const [a, m] = periodo.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** Período AAAA-MM de un momento, en hora de Argentina. */
export function periodoDe(ms: number) {
  const d = new Date(ms + AR);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Inicio y fin (exclusivo) del mes en milisegundos UTC. */
export function limitesMes(periodo: string) {
  const [a, m] = periodo.split('-').map(Number);
  return { desde: Date.UTC(a, m - 1, 1) - AR, hasta: Date.UTC(a, m, 1) - AR };
}

/** El informe se genera recién cuando terminó el mes y venció el plazo de revisión de su último reporte. */
export function mesCerrado(periodo: string, ahora: number) {
  return ahora >= limitesMes(periodo).hasta + PLAZO_REVISION_H * 3600_000;
}

const vacio = (): PorEstado => ({ 'sin-verificar': 0, revisado: 0, corroborado: 0 });

export function calcularMes(b: Base, periodo: string): DatosMes {
  const { desde, hasta } = limitesMes(periodo);
  const delMes = b.reportes.filter((r) => r.momento >= desde && r.momento < hasta && r.estado !== 'retenido');
  const porEstado = vacio();
  const porCategoria: Record<string, PorEstado> = Object.fromEntries(TIPOS.map((t) => [t.id, vacio()]));
  const celdas = new Map<string, { id: string; lon: number; lat: number; cantidad: number }>();
  let sinZona = 0;
  for (const r of delMes) {
    porEstado[r.estadoPublico] += 1;
    (porCategoria[r.tipo] ??= vacio())[r.estadoPublico] += 1;
    if (r.zonaSuprimida) {
      sinZona += 1;
      continue;
    }
    const c = celdas.get(r.celda.id) ?? { ...r.celda, cantidad: 0 };
    c.cantidad += 1;
    celdas.set(r.celda.id, c);
  }
  return {
    periodo,
    total: delMes.length,
    porEstado,
    porCategoria,
    celdas: [...celdas.values()].sort((a, c) => c.cantidad - a.cantidad || a.id.localeCompare(c.id)),
    sinZona,
  };
}

/** Meses con reportes, del más reciente al más antiguo. */
export function mesesConReportes(b: Base) {
  return [...new Set(b.reportes.filter((r) => r.estado !== 'retenido').map((r) => periodoDe(r.momento)))].sort().reverse();
}

/** Genera (o vuelve a generar) el borrador del mes. Un informe aprobado no se pisa: se corrige retirándolo. */
export function generarInforme(b: Base, periodo: string, ahora: number): string | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return 'Elegí un mes.';
  if (!mesCerrado(periodo, ahora)) return 'El mes todavía no cerró o no venció el plazo de revisión de sus últimos reportes.';
  b.informes ??= [];
  if (b.informes.some((i) => i.periodo === periodo && i.estado === 'aprobado')) {
    return 'Ese mes ya tiene un informe aprobado. Para corregirlo, primero hay que retirarlo.';
  }
  b.informes = b.informes.filter((i) => !(i.periodo === periodo && i.estado === 'borrador'));
  const informe: InformeMensual = {
    id: crypto.randomUUID(),
    periodo,
    generado: ahora,
    datos: calcularMes(b, periodo),
    estado: 'borrador',
    aprobado: null,
    demo: b.reportes.some((r) => r.demo && periodoDe(r.momento) === periodo) || undefined,
  };
  b.informes.push(informe);
  b.registro.push({ fecha: ahora, accion: 'Informe mensual generado (borrador)', detalle: periodo });
  return null;
}

export function aprobarInforme(b: Base, id: string, ahora: number): string | null {
  const i = b.informes?.find((x) => x.id === id);
  if (!i) return 'No se encontró el informe.';
  if (i.estado !== 'borrador') return 'Solo se puede aprobar un borrador.';
  i.estado = 'aprobado';
  i.aprobado = { por: 'Gabriel Lombardo', fecha: ahora };
  b.registro.push({ fecha: ahora, accion: 'Informe mensual aprobado', detalle: i.periodo });
  return null;
}

export function retirarInforme(b: Base, id: string, ahora: number): string | null {
  const i = b.informes?.find((x) => x.id === id);
  if (!i) return 'No se encontró el informe.';
  if (i.estado !== 'aprobado') return 'Solo se puede retirar un informe aprobado; un borrador se vuelve a generar.';
  i.estado = 'retirado';
  b.registro.push({ fecha: ahora, accion: 'Informe mensual retirado', detalle: i.periodo });
  return null;
}

/** Archivo de datos para cargar el informe en la web institucional (sección Observatorio Vecinal). */
export function exportarDatos(i: InformeMensual, limite: [number, number][]) {
  return {
    formato: 'valomi-observatorio-1',
    titulo: `Reportes ciudadanos recibidos por VaLoMi · ${nombreMes(i.periodo)}`,
    leyenda: LEYENDA,
    categorias: TIPOS.map((t) => ({ id: t.id, nombre: t.nombre })),
    aprobado: i.aprobado,
    generado: i.generado,
    demo: Boolean(i.demo),
    limite,
    ...i.datos,
  };
}
