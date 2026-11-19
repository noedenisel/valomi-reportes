// Aviso de posibles datos personales en el relato.
// Es una ayuda, no una garantía: puede no detectar todo y puede marcar cosas que no lo son.
// Si la persona envía igual, el reporte queda retenido hasta que Gabriel lo revise.

const PATRONES: { motivo: string; regex: RegExp }[] = [
  { motivo: 'un teléfono', regex: /(\+?54\s?)?(9\s?)?(11|15)?[\s.-]?\d{4}[\s.-]?\d{4}\b/ },
  { motivo: 'un DNI', regex: /\b\d{1,2}\.?\d{3}\.?\d{3}\b/ },
  { motivo: 'un correo', regex: /[^\s@]+@[^\s@]+\.[^\s@]{2,}/ },
  { motivo: 'una patente', regex: /\b([A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]{3}\s?\d{3})\b/i },
  { motivo: 'un número de casa', regex: /\b(al|n[°º]|nro\.?|número|altura|calle\s+\p{L}+(\s\p{L}+)?)\s*\d{2,5}\b/iu },
  { motivo: 'un nombre', regex: /\b(se llama|llamado|llamada|el de|la de|apodado|alias|le dicen)\s+\p{Lu}\p{Ll}+/u },
];

export function posiblesDatosPersonales(texto: string): string[] {
  return PATRONES.filter((p) => p.regex.test(texto)).map((p) => p.motivo);
}
