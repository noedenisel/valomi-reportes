const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const formas: Record<string, React.ReactNode> = {
  // Tipos de hecho (aprobados para el mapa y la ficha)
  calle: <path d="M5 9h14l-1.2 11H6.2z M9 9V7a3 3 0 0 1 6 0v2" />,
  motochorros: (<><circle cx="5.5" cy="16.5" r="3.5" /><circle cx="18.5" cy="16.5" r="3.5" /><path d="M5.5 16.5 9.5 11h5.5l3.5 5.5 M14 6.5h2.5l2 10 M7.5 11h4" /></>),
  vivienda: <path d="M4 11.5 12 5l8 6.5V20H4z M10 20v-5h4v5" />,
  vehiculo: (<><path d="M3 16v-3l2.5-5h13l2.5 5v3z M3 13h18" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>),
  agresion: <path d="M13.5 3 5 13.5h6.5L10.5 21 19 10.5h-6.5z" />,
  disparos: <path d="M12 3l1.9 5.1L19 6.2l-2.1 5 5.1 1.8-5.1 1.8 2.1 5-5.1-1.9L12 21l-1.9-5.1L5 17.8l2.1-5L2 11l5.1-1.8L5 4.2l5.1 1.9z" />,
  sospechosa: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
  otro: <path d="M6.5 12h.01M12 12h.01M17.5 12h.01" strokeWidth={3.4} />,
  // Interfaz
  inicio: <path d="M4 11.5 12 5l8 6.5V20H4z M10 20v-5h4v5" />,
  mapa: <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z M9 4v13.5 M15 6.5V20" />,
  mas: <path d="M5 6.5h14M5 12h14M5 17.5h14" />,
  reportar: <path d="M12 6v12M6 12h12" />,
  mira: (<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>),
  foto: (<><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>),
  video: (<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10.5 5-3v9l-5-3" /></>),
  copiar: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth={2.6} />,
  centrar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  lista: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  instalar: <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14" />,
};

export function Icono({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...trazo}>
      {formas[nombre] ?? formas.otro}
    </svg>
  );
}

/** Triángulo de alerta de la marca. */
export function Triangulo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 42" className={className} aria-hidden="true">
      <polygon points="24,4 45,38.5 3,38.5" fill="#c8102e" stroke="#c8102e" strokeWidth="6" strokeLinejoin="round" />
      <rect x="21.6" y="14" width="4.8" height="14" rx="2.4" fill="#fff" />
      <circle cx="24" cy="32.6" r="2.7" fill="#fff" />
    </svg>
  );
}
