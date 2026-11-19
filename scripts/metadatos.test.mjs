// Prueba: las fotos se guardan sin metadatos (EXIF con GPS, comentarios).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sinMetadatos, tipoReal } from '../lib/metadatos.ts';

const seg = (marca, datos) => Buffer.concat([Buffer.from([0xff, marca]), Buffer.from([0, datos.length + 2]), Buffer.from(datos)]);

test('JPEG: descarta EXIF (APP1) y comentarios, conserva JFIF y la imagen', () => {
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, 'JFIF\0'),
    seg(0xe1, 'Exif\0\0GPS -34.66 -58.53'),
    seg(0xfe, 'comentario'),
    Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9]),
  ]);
  const limpio = sinMetadatos(jpeg, 'image/jpeg');
  assert.ok(!limpio.includes('GPS'));
  assert.ok(!limpio.includes('comentario'));
  assert.ok(limpio.includes('JFIF'));
  assert.deepEqual([...limpio.subarray(-5)], [1, 2, 3, 0xff, 0xd9]);
});

test('PNG: descarta bloques de texto y EXIF', () => {
  const bloque = (tipo, datos) => {
    const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
    return Buffer.concat([largo, Buffer.from(tipo, 'latin1'), Buffer.from(datos), Buffer.alloc(4)]);
  };
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', 'x'.repeat(13)), bloque('tEXt', 'GPS secreto'), bloque('eXIf', 'GPS'), bloque('IEND', ''),
  ]);
  const limpio = sinMetadatos(png, 'image/png');
  assert.ok(!limpio.includes('GPS'));
  assert.ok(limpio.includes('IHDR') && limpio.includes('IEND'));
});

const caja = (tipo, ...hijos) => {
  const cuerpo = Buffer.concat(hijos.map((h) => (typeof h === 'string' ? Buffer.from(h) : h)));
  const cab = Buffer.alloc(8);
  cab.writeUInt32BE(cuerpo.length + 8);
  cab.write(tipo, 4, 'latin1');
  return Buffer.concat([cab, cuerpo]);
};

test('video: vacía la ubicación y el modelo, conserva tamaño, posiciones e imagen', () => {
  const video = Buffer.concat([
    caja('ftyp', 'qt  '),
    caja('moov',
      caja('mvhd', 'duracion'),
      caja('udta', '©xyz+34.66-058.53/'),
      caja('meta', 'com.apple.quicktime.model iPhone'),
      caja('trak', caja('tkhd', 'pista'), caja('udta', 'GPS-pista'))),
    caja('meta', 'GPS-suelto'),
    caja('mdat', 'IMAGEN-DEL-VIDEO'),
  ]);
  const limpio = sinMetadatos(video, 'video/quicktime');
  for (const dato of ['34.66', 'iPhone', 'GPS-pista', 'GPS-suelto']) assert.ok(!limpio.includes(dato), dato);
  for (const dato of ['ftyp', 'mvhd', 'duracion', 'tkhd', 'IMAGEN-DEL-VIDEO']) assert.ok(limpio.includes(dato), dato);
  assert.equal(limpio.length, video.length);
  assert.equal(limpio.indexOf('IMAGEN-DEL-VIDEO'), video.indexOf('IMAGEN-DEL-VIDEO'));
});

test('video: un archivo cortado o raro no rompe y no crece', () => {
  const raro = Buffer.concat([caja('ftyp', 'mp42'), Buffer.from([0, 0, 0, 200]), Buffer.from('moovcortado')]);
  assert.equal(sinMetadatos(raro, 'video/mp4').length, raro.length);
});

test('tipo real: rechaza lo que no es lo que dice ser', () => {
  assert.ok(tipoReal(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg'));
  assert.ok(tipoReal(caja('ftyp', 'isom'), 'video/mp4'));
  assert.equal(tipoReal(Buffer.from('<html><script>alert(1)</script>'), 'image/jpeg'), false);
  assert.equal(tipoReal(Buffer.from('<html><script>alert(1)</script>'), 'video/mp4'), false);
  assert.equal(tipoReal(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'text/html'), false);
});
