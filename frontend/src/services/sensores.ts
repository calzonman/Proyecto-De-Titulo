const API = import.meta.env.VITE_API_URL;

export type UnassociatedTag = {
  uid_etiqueta: string;
  lastTimestamp: string | null;
  count: number;
};

export async function fetchUnassociatedTags(): Promise<UnassociatedTag[]> {
  const r = await fetch(`${API}/etiquetas/sin-asociar`);
  if (!r.ok) throw new Error("No se pudo cargar etiquetas sin asociar");
  return r.json();
}

export async function associateUidToProduct(productoId: string, uid: string) {
  const url = `${API}/productos/${encodeURIComponent(productoId)}/asociar-etiqueta?uid_etiqueta=${encodeURIComponent(uid)}`;
  const r = await fetch(url, { method: "PUT" }); // sin body
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || "No se pudo asociar la etiqueta");
  }
  return r.json();
}

