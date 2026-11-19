export type Anillo = [number, number][];
export const TOLERANCIA_M: number;
export const LADO_CELDA_M: number;
export function puntoEnPoligono(lon: number, lat: number, anillo: Anillo): boolean;
export function distanciaAlBorde(lon: number, lat: number, anillo: Anillo): number;
export function dentroDelTerritorio(lon: number, lat: number, anillo: Anillo, tolerancia?: number): boolean;
export function celda(lon: number, lat: number): { id: string; lon: number; lat: number };
