// Quita metadatos de las fotos antes de guardarlas (ubicación GPS, modelo del teléfono, fecha).
// El formulario ya vuelve a codificar cada foto en el teléfono, lo que descarta los metadatos;
// esto es la segunda barrera, en el servidor, para JPEG y PNG.

export function sinMetadatos(buf: Buffer, mime: string): Buffer {
  if (mime === 'image/jpeg') return jpegSinMetadatos(buf);
  if (mime === 'image/png') return pngSinMetadatos(buf);
  if (mime === 'video/mp4' || mime === 'video/quicktime') return videoSinMetadatos(buf);
  return buf;
}

/** Controla por los primeros bytes que el archivo sea lo que dice ser (el tipo declarado lo puede falsear cualquiera). */
export function tipoReal(buf: Buffer, mime: string) {
  const marca = buf.toString('latin1', 4, 8);
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47;
  if (mime === 'image/webp') return buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP';
  if (mime === 'image/heic' || mime === 'image/heif') return marca === 'ftyp';
  if (mime === 'video/mp4') return marca === 'ftyp';
  if (mime === 'video/quicktime') return ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip'].includes(marca);
  return false;
}

// MP4/MOV: la ubicación y el modelo del teléfono viven en las cajas udta y meta. Se vacían en el lugar y pasan a ser
// cajas «free»: el archivo mantiene su tamaño y sus posiciones, así que el video se sigue reproduciendo igual.
function videoSinMetadatos(original: Buffer): Buffer {
  const buf = Buffer.from(original);
  const vaciar = (i: number, cabecera: number, largo: number) => {
    buf.write('free', i + 4, 'latin1');
    buf.fill(0, i + cabecera, i + largo);
  };
  const recorrer = (inicio: number, fin: number, visitar: (tipo: string, i: number, cabecera: number, largo: number) => void) => {
    let i = inicio;
    while (i + 8 <= fin) {
      let largo = buf.readUInt32BE(i);
      const tipo = buf.toString('latin1', i + 4, i + 8);
      let cabecera = 8;
      if (largo === 1) {
        if (i + 16 > fin) return;
        largo = Number(buf.readBigUInt64BE(i + 8));
        cabecera = 16;
      } else if (largo === 0) largo = fin - i;
      if (largo < cabecera || i + largo > fin) return;
      visitar(tipo, i, cabecera, largo);
      i += largo;
    }
  };
  recorrer(0, buf.length, (tipo, i, cabecera, largo) => {
    if (tipo === 'udta' || tipo === 'meta' || tipo === 'uuid') vaciar(i, cabecera, largo);
    if (tipo !== 'moov') return;
    recorrer(i + cabecera, i + largo, (t2, i2, c2, l2) => {
      if (t2 === 'udta' || t2 === 'meta') vaciar(i2, c2, l2);
      if (t2 !== 'trak') return;
      recorrer(i2 + c2, i2 + l2, (t3, i3, c3, l3) => {
        if (t3 === 'udta' || t3 === 'meta') vaciar(i3, c3, l3);
      });
    });
  });
  return buf;
}

// JPEG: se descartan los segmentos APP1–APP15 (EXIF, XMP, etc.) y los comentarios; se conserva APP0 (JFIF).
function jpegSinMetadatos(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const partes: Buffer[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marca = buf[i + 1];
    if (marca === 0xda) break; // empieza la imagen: el resto se copia tal cual
    const largo = buf.readUInt16BE(i + 2);
    const descartar = (marca >= 0xe1 && marca <= 0xef) || marca === 0xfe;
    if (!descartar) partes.push(buf.subarray(i, i + 2 + largo));
    i += 2 + largo;
  }
  partes.push(buf.subarray(i));
  return Buffer.concat(partes);
}

// PNG: se descartan los bloques de texto y de datos EXIF (tEXt, zTXt, iTXt, eXIf, tIME).
function pngSinMetadatos(buf: Buffer): Buffer {
  const FIRMA = 8;
  if (buf.length < FIRMA || buf.readUInt32BE(0) !== 0x89504e47) return buf;
  const partes: Buffer[] = [buf.subarray(0, FIRMA)];
  let i = FIRMA;
  while (i + 12 <= buf.length) {
    const largo = buf.readUInt32BE(i);
    const tipo = buf.toString('latin1', i + 4, i + 8);
    const fin = i + 12 + largo;
    if (!['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].includes(tipo)) partes.push(buf.subarray(i, fin));
    i = fin;
  }
  return Buffer.concat(partes);
}
