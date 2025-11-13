// src/services/lecturas.ts
export type Lectura = {
  _id: string;
  uid_etiqueta: string;
  temperatura: number | null;
  timestamp: string;     // ISO desde tu backend
  estado: "OK" | "ALERTA" | string; // por si hay otros estados
};

const API = import.meta.env.VITE_API_URL;

// trae lecturas más recientes (tu backend ya las ordena desc y limita 100)
export async function fetchLecturasRecientes(): Promise<Lectura[]> {
  const r = await fetch(`${API}/lecturas/`);
  if (!r.ok) throw new Error("No se pudo cargar /lecturas/");
  return r.json();
}

export async function fetchLecturasPorEPC(epc: string): Promise<Lectura[]> {
  const r = await fetch(`${API}/lecturas/${encodeURIComponent(epc)}`);
  if (!r.ok) throw new Error("No se pudo cargar /lecturas/{epc}");
  return r.json();
}
