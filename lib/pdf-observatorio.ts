// PDF del informe mensual del Observatorio Vecinal. Funciona igual en el servidor y en el navegador (demo).
// Contiene solo datos agregados: totales, tabla por categoría, gráfico y mapa de calor por zonas de 200 m.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { LEYENDA, nombreMes } from './observatorio.ts';
import { TIPOS } from './reglas.ts';
import type { InformeMensual } from './tipos.ts';

const ROJO = rgb(0.784, 0.063, 0.18);
const ROJO_SUAVE = rgb(0.984, 0.914, 0.925);
const OSCURO = rgb(0.106, 0.118, 0.133);
const GRIS = rgb(0.341, 0.369, 0.4);
const GRIS_CLARO = rgb(0.894, 0.902, 0.914);
const BLANCO = rgb(1, 1, 1);
const AMARILLO = rgb(1, 0.945, 0.659);
const ESTADOS = [
  { id: 'sin-verificar', nombre: 'Sin verificar' },
  { id: 'revisado', nombre: 'Revisados por VaLoMi' },
  { id: 'corroborado', nombre: 'Corroborados' },
] as const;

const fecha = (ms: number) =>
  new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

function lineas(texto: string, fuente: PDFFont, tam: number, ancho: number) {
  const salida: string[] = [];
  let actual = '';
  for (const palabra of texto.split(' ')) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(prueba, tam) > ancho && actual) {
      salida.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) salida.push(actual);
  return salida;
}

/** Barra apilada por estado, con los mismos códigos visuales que la app: punteado, rojo suave y oscuro. */
function segmento(p: PDFPage, x: number, y: number, w: number, h: number, estado: string) {
  if (w <= 0) return;
  if (estado === 'sin-verificar') p.drawRectangle({ x, y, width: w, height: h, color: BLANCO, borderColor: GRIS, borderWidth: 0.8, borderDashArray: [2, 1.5] });
  if (estado === 'revisado') p.drawRectangle({ x, y, width: w, height: h, color: ROJO_SUAVE, borderColor: ROJO, borderWidth: 0.8 });
  if (estado === 'corroborado') p.drawRectangle({ x, y, width: w, height: h, color: OSCURO });
}

export async function pdfInformeMensual(informe: InformeMensual, limite: [number, number][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Observatorio Vecinal · ${nombreMes(informe.periodo)}`);
  doc.setAuthor('VaLoMi – Vecinos en Alerta de Lomas del Mirador');
  doc.setSubject('Reportes ciudadanos recibidos por VaLoMi');
  const p = doc.addPage([595.28, 841.89]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const ANCHO = 595.28 - 2 * M;
  const d = informe.datos;
  let y = 841.89 - M;

  const texto = (t: string, x: number, yy: number, tam = 10, f = normal, color = OSCURO) => p.drawText(t, { x, y: yy, size: tam, font: f, color });

  if (informe.demo) {
    p.drawRectangle({ x: 0, y: 841.89 - 22, width: 595.28, height: 22, color: AMARILLO });
    texto('DEMO · DATOS FICTICIOS · NO PUBLICAR', M, 841.89 - 15, 9, negrita, rgb(0.3, 0.24, 0));
    y -= 14;
  }

  texto('OBSERVATORIO VECINAL · VaLoMi – Vecinos en Alerta de Lomas del Mirador', M, y, 8.5, negrita, ROJO);
  y -= 26;
  texto('Reportes ciudadanos recibidos por VaLoMi', M, y, 20, negrita);
  y -= 22;
  const mes = nombreMes(informe.periodo);
  texto(mes.charAt(0).toUpperCase() + mes.slice(1), M, y, 14, normal, GRIS);
  y -= 18;

  // Leyenda obligatoria
  const ley = lineas(LEYENDA, normal, 8.5, ANCHO - 20);
  const altoLey = ley.length * 11 + 14;
  p.drawRectangle({ x: M, y: y - altoLey, width: ANCHO, height: altoLey, color: rgb(0.953, 0.957, 0.961) });
  ley.forEach((l, i) => texto(l, M + 10, y - 16 - i * 11, 8.5, normal, rgb(0.24, 0.26, 0.29)));
  y -= altoLey + 22;

  // Totales
  const tarjetas = [{ nombre: 'Total recibidos', valor: d.total }, ...ESTADOS.map((e) => ({ nombre: e.nombre, valor: d.porEstado[e.id] }))];
  const anchoT = (ANCHO - 3 * 8) / 4;
  tarjetas.forEach((t, i) => {
    const x = M + i * (anchoT + 8);
    p.drawRectangle({ x, y: y - 46, width: anchoT, height: 46, borderColor: GRIS_CLARO, borderWidth: 1 });
    texto(t.nombre, x + 8, y - 14, 8, normal, GRIS);
    texto(String(t.valor), x + 8, y - 38, 20, negrita);
  });
  y -= 70;

  // Gráfico por categoría, apilado por estado
  texto('Por categoría y estado', M, y, 11, negrita);
  y -= 8;
  const maximo = Math.max(1, ...TIPOS.map((t) => ESTADOS.reduce((s, e) => s + (d.porCategoria[t.id]?.[e.id] ?? 0), 0)));
  const xBarras = M + 170;
  const anchoBarras = ANCHO - 170 - 30;
  for (const t of TIPOS) {
    y -= 15;
    texto(t.nombre, M, y + 3, 8.5);
    let x = xBarras;
    let total = 0;
    for (const e of ESTADOS) {
      const n = d.porCategoria[t.id]?.[e.id] ?? 0;
      const w = (n / maximo) * anchoBarras;
      segmento(p, x, y, w, 11, e.id);
      x += w;
      total += n;
    }
    texto(String(total), x + 5, y + 2, 8.5, negrita);
  }
  y -= 18;
  let xl = M;
  for (const e of ESTADOS) {
    segmento(p, xl, y, 10, 8, e.id);
    texto(e.nombre, xl + 14, y, 8, normal, GRIS);
    xl += 24 + normal.widthOfTextAtSize(e.nombre, 8) + 10;
  }
  y -= 26;

  // Tabla por categorías
  texto('Tabla por categorías', M, y, 11, negrita);
  y -= 16;
  const cols = [M, M + 210, M + 290, M + 370, M + 450];
  ['Categoría', 'Sin verificar', 'Revisados', 'Corroborados', 'Total'].forEach((c, i) => texto(c, cols[i], y, 8, negrita, GRIS));
  y -= 4;
  p.drawLine({ start: { x: M, y }, end: { x: M + ANCHO, y }, thickness: 0.8, color: GRIS_CLARO });
  for (const t of TIPOS) {
    y -= 12;
    const fila = d.porCategoria[t.id];
    const valores = ESTADOS.map((e) => fila?.[e.id] ?? 0);
    texto(t.nombre, cols[0], y, 8.5);
    valores.forEach((v, i) => texto(String(v), cols[i + 1], y, 8.5));
    texto(String(valores.reduce((a, c) => a + c, 0)), cols[4], y, 8.5, negrita);
  }
  y -= 5;
  p.drawLine({ start: { x: M, y }, end: { x: M + ANCHO, y }, thickness: 0.8, color: GRIS_CLARO });
  y -= 13;
  texto('Total', cols[0], y, 8.5, negrita);
  ESTADOS.forEach((e, i) => texto(String(d.porEstado[e.id]), cols[i + 1], y, 8.5, negrita));
  texto(String(d.total), cols[4], y, 8.5, negrita);
  y -= 28;

  // Mapa de calor por zonas de 200 m
  texto('Mapa de calor por zonas de 200 m', M, y, 11, negrita);
  const lons = limite.map((c) => c[0]);
  const lats = limite.map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const cos = Math.cos((-34.665 * Math.PI) / 180);
  const alto = 150;
  const escala = Math.min((ANCHO * 0.55) / ((x1 - x0) * cos), alto / (y1 - y0));
  const base = { x: M, y: y - 12 - alto };
  const P = (lon: number, lat: number) => ({ x: base.x + (lon - x0) * cos * escala, y: base.y + (lat - y0) * escala });
  p.drawRectangle({ x: base.x - 4, y: base.y - 4, width: (x1 - x0) * cos * escala + 8, height: alto + 8, color: rgb(0.925, 0.933, 0.941) });
  const maxCelda = Math.max(1, ...d.celdas.map((c) => c.cantidad));
  const lado = 0.0018 * escala; // ~200 m
  for (const c of d.celdas) {
    const q = P(c.lon, c.lat);
    p.drawRectangle({ x: q.x - lado / 2, y: q.y - lado / 2, width: lado, height: lado, color: ROJO, opacity: 0.2 + 0.7 * (c.cantidad / maxCelda) });
  }
  for (let i = 0; i < limite.length - 1; i++) {
    p.drawLine({ start: P(...limite[i]), end: P(...limite[i + 1]), thickness: 1.2, color: ROJO, dashArray: [4, 2] });
  }
  const xNota = M + (x1 - x0) * cos * escala + 20;
  const notaMapa = lineas(
    `Cada cuadrado es una zona de unas dos manzanas; cuanto más intenso, más reportes. ${d.sinZona} ${d.sinZona === 1 ? 'reporte no tiene' : 'reportes no tienen'} zona publicada: se cuentan en la tabla, no en el mapa.`,
    normal, 8.5, M + ANCHO - xNota
  );
  notaMapa.forEach((l, i) => texto(l, xNota, y - 26 - i * 11, 8.5, normal, GRIS));
  y -= alto + 34;

  // Nota de método y pie
  const metodo = lineas(
    `Método: se cuentan todos los reportes ciudadanos recibidos por VaLoMi cuyo hecho ocurrió en ${nombreMes(informe.periodo)} (hora de Argentina), según su estado al ${fecha(informe.generado)}. Se excluyen los reportes retirados o rechazados. No incluye textos, fotos, números de reporte ni ubicaciones exactas.`,
    normal, 8, ANCHO
  );
  metodo.forEach((l) => {
    texto(l, M, y, 8, normal, GRIS);
    y -= 10.5;
  });
  y -= 4;
  texto(
    informe.aprobado ? `Aprobado por ${informe.aprobado.por} el ${fecha(informe.aprobado.fecha)}.` : 'BORRADOR · todavía no fue aprobado por Gabriel Lombardo.',
    M, y, 8, negrita, informe.aprobado ? OSCURO : ROJO
  );

  return doc.save();
}
