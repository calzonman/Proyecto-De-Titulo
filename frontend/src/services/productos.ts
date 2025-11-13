const API = import.meta.env.VITE_API_URL;

export type Producto = {
  _id: string;
  nombre: string;
  rango_temp: { min: number; max: number };
  uid_etiqueta?: string;
};

export async function fetchProductoByUID(epc: string): Promise<Producto> {
  const r = await fetch(`${API}/productos/by-uid/${encodeURIComponent(epc)}`);
  if (!r.ok) throw new Error("No se pudo cargar el producto");
  return r.json();
}

export type ProductoWithLast = {
  _id: string;
  nombre: string;
  uid_etiqueta?: string;
  rango_temp: { min: number; max: number };
  lastReadingTimestamp?: string | null;
  lastEstado?: "OK" | "ALERTA" | "SIN_RANGO" | "SIN_DATO" | null;
};

export async function fetchProductosWithLastReading(): Promise<ProductoWithLast[]> {
  const r = await fetch(`${API}/productos/with-last-reading`);
  if (!r.ok) throw new Error("No se pudo cargar productos");
  return r.json();
}

export type NuevoProducto = {
  nombre: string;
  rango_temp: { min: number; max: number };
  uid_etiqueta?: string | null; // opcional
};

export async function createProducto(payload: NuevoProducto) {
  const r = await fetch(`${import.meta.env.VITE_API_URL}/productos/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || "No se pudo crear el producto");
  }
  return r.json();
}
