-- VaLoMi · PWA de reportes · esquema para Supabase (región San Pablo).
-- Se corre una vez en el editor SQL del proyecto.
--
-- Diseño de la V1: los datos de la app viven en un único documento JSON con control de versión.
-- Las reglas (lib/operaciones.ts) trabajan sobre ese documento igual que con el archivo local, y la escritura
-- solo se acepta si nadie lo modificó en el medio (bloqueo optimista). Para el volumen de un barrio alcanza;
-- si crece, se pasa a tablas por entidad sin cambiar las reglas.
--
-- Privacidad: el público nunca lee estas tablas. Solo el servidor de la PWA, con la clave de servicio.

create table if not exists public.valomi_base (
  id smallint primary key default 1 check (id = 1),
  version bigint not null default 0,
  datos jsonb not null default '{"reportes":[],"solicitudes":[],"registro":[],"contador":0,"informes":[]}'::jsonb,
  actualizado timestamptz not null default now()
);
insert into public.valomi_base (id) values (1) on conflict do nothing;

-- Límite aprobado de 3 reportes por hora: solo una huella cifrada de la conexión, sin IP. Se borra a la hora.
create table if not exists public.valomi_envios (
  clave text not null,
  momento timestamptz not null default now()
);
create index if not exists valomi_envios_clave on public.valomi_envios (clave, momento);

-- Nadie con la clave pública (anon) ni sesiones de usuarios puede leer ni escribir: solo la clave de servicio.
alter table public.valomi_base enable row level security;
alter table public.valomi_envios enable row level security;
revoke all on public.valomi_base, public.valomi_envios from anon, authenticated;
grant select, insert, update, delete on public.valomi_base, public.valomi_envios to service_role;

-- Archivos (fotos y videos originales y copias difuminadas): almacenamiento privado.
-- Sin políticas para anon: el teléfono solo puede subir con un enlace firmado que da el servidor, a la carpeta temporal.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos', 'adjuntos', false, 52428800,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do nothing;

-- Entrada de Gabriel al panel (enlace por correo): se configura en Authentication → Providers → Email,
-- con registro de cuentas desactivado. La PWA además solo acepta el correo de VALOMI_CORREO_MODERACION.
