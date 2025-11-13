// src/App.tsx
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, Thermometer, Radio, Package, Plus, Link, TrendingUp, AlertTriangle } from 'lucide-react';

import { fetchLecturasRecientes, fetchLecturasPorEPC, Lectura } from "./services/lecturas";
import { fetchProductoByUID, fetchProductosWithLastReading, createProducto } from "./services/productos";
import { fetchUnassociatedTags, associateUidToProduct } from "./services/sensores";

// ---- Types primero (ChartPoint antes de usarlo) ----
type ChartPoint = { time: string; temp: number };

type RegisteredProduct = {
  id: string;                 // usamos el _id del backend
  name: string;
  tempRange: string;          // "2–8 °C"
  lastRegistration: string;   // hora exacta formateada
  registeredAt: string;       // "hace 3 min"
  sensorUID: string;          // uid_etiqueta
  status: 'normal' | 'warning';
  temperatureData?: ChartPoint[];
};

type UnassociatedSensor = { 
  id: string; 
  uid: string; 
  type?: string; 
  lastSeen?: string; 
  battery?: number 
};

// ---- Defaults seguros (evitan ReferenceError en el render) ----
const userData = { name: "Usuario", avatar: "" };

// Utilidad "hace cuánto"
function fromNow(dateISO: string) {
  const d = new Date(dateISO);
  const diffMs = Date.now() - d.getTime();
  const rtf = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(sec / 60);
  const hr  = Math.round(min / 60);
  const day = Math.round(hr / 24);
  if (Math.abs(day) >= 1) return rtf.format(-day, 'day');
  if (Math.abs(hr) >= 1)  return rtf.format(-hr, 'hour');
  if (Math.abs(min) >= 1) return rtf.format(-min, 'minute');
  return rtf.format(-sec, 'second');
}

function formatDateTime(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

export default function App() {
  // === Sección 1: Último registro ===
  const [latest, setLatest] = useState<Lectura | null>(null);
  const [latestSeries, setLatestSeries] = useState<ChartPoint[]>([]);
  const [latestProductName, setLatestProductName] = useState<string>('');
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [errorLatest, setErrorLatest] = useState<string | null>(null);

  // === Productos Registrados ===
  const [products, setProducts] = useState<RegisteredProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isProductsDialogOpen, setIsProductsDialogOpen] = useState(false);

  async function loadProducts() {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const raw = await fetchProductosWithLastReading();
      const mapped: RegisteredProduct[] = raw.map((p) => {
        const min = p.rango_temp?.min;
        const max = p.rango_temp?.max;
        const tempRange = (min != null && max != null) ? `${min}–${max} °C` : "—";
        const last = p.lastReadingTimestamp || null;
        const estado = (p.lastEstado === "OK") ? "normal" : "warning";
        return {
          id: p._id,
          name: p.nombre,
          tempRange,
          lastRegistration: last
            ? new Date(last).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
            : "—",
          registeredAt: last ? fromNow(last) : "sin lecturas",
          sensorUID: p.uid_etiqueta || "—",
          status: estado,
        };
      });
      setProducts(mapped);
    } catch (e: any) {
      setProductsError(e?.message || "No se pudieron cargar los productos");
      // Importante: NO vaciamos la lista si falla
    } finally {
      setProductsLoading(false);
    }
  }

  useEffect(() => {
    // Carga estable al montar
    loadProducts();
  }, []);

  function handleProductsDialogOpenChange(v: boolean) {
    setIsProductsDialogOpen(v);
    if (v) loadProducts(); // refresca al abrir
  }

  // === Sensores sin asociar ===
  const [unassociatedSensors, setUnassociatedSensors] = useState<UnassociatedSensor[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const tags = await fetchUnassociatedTags();
        const mapped: UnassociatedSensor[] = tags.map(t => ({
          id: t.uid_etiqueta,
          uid: t.uid_etiqueta,
          lastSeen: t.lastTimestamp
            ? new Date(t.lastTimestamp).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
            : "—",
        }));
        setUnassociatedSensors(mapped);
      } catch (e) {
        console.error(e);
        setUnassociatedSensors([]);
      }
    })();
  }, []);

  // === Último registro: carga datos y serie ===
  useEffect(() => {
    async function load() {
      setLoadingLatest(true);
      setErrorLatest(null);
      try {
        // 1) última lectura
        const lecturas = await fetchLecturasRecientes();
        if (!lecturas.length) {
          setLatest(null);
          setLatestSeries([]);
          setLatestProductName('');
          return;
        }
        const ultima = lecturas[0];
        setLatest(ultima);

        // 2) nombre del producto por EPC
        try {
          const prod = await fetchProductoByUID(ultima.uid_etiqueta);
          setLatestProductName(prod.nombre);
        } catch {
          setLatestProductName(ultima.uid_etiqueta); // fallback
        }

        // 3) últimas 4 lecturas → serie
        const porEpc = await fetchLecturasPorEPC(ultima.uid_etiqueta);
        const top4 = porEpc
          .filter(l => l.temperatura != null)
          .slice(0, 4)     // backend ya ordena desc
          .reverse();      // cronológico asc para el gráfico

        setLatestSeries(
          top4.map(l => ({
            time: new Date(l.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
            temp: Number(l.temperatura),
          }))
        );
      } catch (e: any) {
        setErrorLatest(e?.message || 'Error cargando último registro');
        setLatest(null);
        setLatestSeries([]);
      } finally {
        setLoadingLatest(false);
      }
    }
    load(); 
  }, []);

  // =========================
  // Estados/handlers existentes (asociaciones y productos)
  // =========================
  const [isAssociateDialogOpen, setIsAssociateDialogOpen] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<UnassociatedSensor | null>(null);
  const [associationType, setAssociationType] = useState<"existing" | "new">("existing");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [newProductName, setNewProductName] = useState<string>("");
  const [tempRange, setTempRange] = useState<{ min: string; max: string }>({ min: "", max: "" });

  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [isProductChartDialogOpen, setIsProductChartDialogOpen] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [selectedProductForChart, setSelectedProductForChart] = useState<RegisteredProduct | null>(null);
  const [newProductFormData, setNewProductFormData] = useState({
    name: "",
    minTemp: "",
    maxTemp: "",
    sensorUID: ""
  });
  const [associateLoading, setAssociateLoading] = useState(false);
  const [associateError, setAssociateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function handleAssociateSensor(sensor: UnassociatedSensor) {
    setSelectedSensor(sensor);
    setIsAssociateDialogOpen(true);
  }

  async function handleConfirmAssociation() {
    if (!selectedSensor) return;
    setAssociateError(null);
    setAssociateLoading(true);

    try {
      if (associationType === "existing") {
        if (!selectedProduct) throw new Error("Selecciona un producto");
        await associateUidToProduct(String(selectedProduct), selectedSensor.uid);
      } else {
        // Crear producto nuevo CON esa etiqueta
        const nombre = newProductName.trim();
        const min = Number(tempRange.min);
        const max = Number(tempRange.max);
        if (!nombre) throw new Error("Ingresa un nombre");
        if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error("Rango inválido");
        if (min > max) throw new Error("La mínima no puede ser mayor que la máxima");

        await createProducto({
          nombre,
          rango_temp: { min, max },
          uid_etiqueta: selectedSensor.uid,
        });
      }

      // 1) refresca lista de productos
      await loadProducts();

      // 2) refresca etiquetas sin asociar
      const tags = await fetchUnassociatedTags();
      const mappedSensors: UnassociatedSensor[] = tags.map(t => ({
        id: t.uid_etiqueta,
        uid: t.uid_etiqueta,
        lastSeen: t.lastTimestamp
          ? new Date(t.lastTimestamp).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
          : "—",
      }));
      setUnassociatedSensors(mappedSensors);

      // cierra y limpia
      setIsAssociateDialogOpen(false);
      setSelectedSensor(null);
      setAssociationType("existing");
      setSelectedProduct("");
      setNewProductName("");
      setTempRange({ min: "", max: "" });
    } catch (e: any) {
      setAssociateError(e?.message || "No se pudo completar la asociación");
    } finally {
      setAssociateLoading(false);
    }
  }

  async function handleViewProductChart(product: RegisteredProduct) {
    setChartError(null);
    setChartLoading(true);

    try {
      // si no hay EPC asociado, abre vacío
      if (!product.sensorUID || product.sensorUID === "—") {
        setSelectedProductForChart({ ...product, temperatureData: [] });
        setIsProductChartDialogOpen(true);
        return;
      }

      const lecturas = await fetchLecturasPorEPC(product.sensorUID);
      const series: ChartPoint[] = lecturas
        .filter(l => l.temperatura != null)
        .slice(0, 50)
        .reverse()
        .map(l => ({
          time: new Date(l.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          temp: Number(l.temperatura),
        }));

      setSelectedProductForChart({ ...product, temperatureData: series });
      setIsProductChartDialogOpen(true);
    } catch (e: any) {
      setChartError(e?.message || "Error al cargar lecturas");
      setSelectedProductForChart({ ...product, temperatureData: [] });
      setIsProductChartDialogOpen(true);
    } finally {
      setChartLoading(false);
    }
  }

  async function handleCreateNewProduct() {
    setCreateError(null);
    setCreating(true);
    try {
      const nombre = newProductFormData.name.trim();
      const min = Number(newProductFormData.minTemp);
      const max = Number(newProductFormData.maxTemp);
      const uid = newProductFormData.sensorUID.trim();

      if (!nombre) throw new Error("Ingresa un nombre");
      if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error("Rango inválido");
      if (min > max) throw new Error("La mínima no puede ser mayor que la máxima");

      await createProducto({
        nombre,
        rango_temp: { min, max },
        uid_etiqueta: uid ? uid : undefined, // si está vacío, no se asocia sensor
      });

      // refrescar listado de productos del panel
      await loadProducts();

      // cerrar y limpiar
      setIsNewProductDialogOpen(false);
      setNewProductFormData({ name: "", minTemp: "", maxTemp: "", sensorUID: "" });
    } catch (e: any) {
      setCreateError(e?.message || "No se pudo crear el producto");
    } finally {
      setCreating(false);
    }
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header con perfil */}
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={userData.avatar} alt={userData.name} />
            <AvatarFallback>{userData.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-medium">Bienvenido, {userData.name}</h1>
            <p className="text-muted-foreground">Dashboard de Control de Temperatura</p>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest Registration Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Último Registro
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                {loadingLatest ? (
                  <p className="text-sm text-muted-foreground">Cargando último registro…</p>
                ) : errorLatest ? (
                  <p className="text-sm text-destructive">{errorLatest}</p>
                ) : !latest ? (
                  <p className="text-sm text-muted-foreground">Aún no hay lecturas.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">
                          {latestProductName || latest.uid_etiqueta}
                        </h3>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(latest.timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Thermometer className="h-4 w-4" />
                            {latest.temperatura != null ? `${latest.temperatura}°C` : '—'}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{fromNow(latest.timestamp)}</Badge>
                    </div>

                    <Separator />

                    {/* Temperature Chart */}
                    <div className="space-y-2">
                      <h4 className="font-medium">Temperatura vs Tiempo</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={latestSeries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" />
                            <YAxis
                              domain={['dataMin - 0.3', 'dataMax + 0.3']}
                              label={{ value: 'Temperatura (°C)', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip
                              formatter={(value: any) => [`${value}°C`, 'Temperatura']}
                              labelFormatter={(value) => `Hora: ${value}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="temp"
                              stroke="hsl(var(--chart-1))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Products List (resumen con estados) */}
          <Dialog open={isProductsDialogOpen} onOpenChange={handleProductsDialogOpenChange}>
            <DialogTrigger asChild>
              <div className="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent/50 transition-colors">
                <div className="flex flex-col space-y-1.5 p-6">
                  <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Productos Registrados
                  </h3>
                </div>
                <div className="p-6 pt-0">
                  {productsLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando…</p>
                  ) : productsError ? (
                    <p className="text-sm text-destructive">Error: {productsError}</p>
                  ) : products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay productos.</p>
                  ) : (
                    <div className="space-y-3">
                      {products.slice(0, 3).map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div className="space-y-1">
                            <h4 className="font-medium">{product.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Thermometer className="h-4 w-4" />
                              Rango: {product.tempRange}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <Badge 
                              variant={product.status === 'normal' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {product.status === 'normal' ? 'Normal' : 'Alerta'}
                            </Badge>
                            <p className="text-xs text-muted-foreground">{product.registeredAt}</p>
                          </div>
                        </div>
                      ))}
                      {products.length > 3 && (
                        <div className="text-center text-sm text-muted-foreground pt-2">
                          +{products.length - 3} más...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </DialogTrigger>

            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Productos Registrados ({products.length})
                  </DialogTitle>
                  <Button
                    onClick={() => setIsNewProductDialogOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nuevo Producto
                  </Button>
                </div>
              </DialogHeader>

              {productsLoading ? (
                <p className="text-sm text-muted-foreground px-4">Cargando productos…</p>
              ) : productsError ? (
                <p className="text-sm text-destructive px-4">{productsError}</p>
              ) : products.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4">No hay productos registrados.</p>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <Card key={product.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium">{product.name}</h4>
                            <Badge 
                              variant={product.status === 'normal' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {product.status === 'normal' ? 'Normal' : 'Alerta'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Thermometer className="h-4 w-4" />
                              <span>Rango: {product.tempRange}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>Último: {product.lastRegistration}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Radio className="h-4 w-4" />
                              <span className="font-mono text-xs">{product.sensorUID}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {product.status === 'normal' ? (
                                <TrendingUp className="h-4 w-4 text-green-600" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                              )}
                              <span>{product.registeredAt}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="outline"
                          onClick={() => handleViewProductChart(product)}
                          className="flex items-center gap-2 ml-4"
                        >
                          <TrendingUp className="h-4 w-4" />
                          Ver Gráfico
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Unassociated Sensors */}
            <Dialog>
              <DialogTrigger asChild>
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm cursor-pointer hover:bg-accent/50 transition-colors">
                  <div className="flex flex-col space-y-1.5 p-6">
                    <h3 className="font-semibold leading-none tracking-tight flex items-center gap-2">
                      <Radio className="h-5 w-5" />
                      Etiquetas sin Asociar
                    </h3>
                  </div>
                  <div className="p-6 pt-0">
                    <div className="text-center space-y-2">
                      <div className="text-4xl font-bold text-primary">{unassociatedSensors.length}</div>
                      <p className="text-sm text-muted-foreground">
                        Sensores disponibles para asociar
                      </p>
                      <Badge variant="outline" className="mt-2">
                        Requiere atención
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogTrigger>

              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Etiquetas sin Asociar ({unassociatedSensors.length})
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {unassociatedSensors.map((sensor) => (
                    <Card key={sensor.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Radio className="h-4 w-4 text-primary" />
                            <span className="font-mono font-medium">{sensor.uid}</span>
                            <Badge variant="secondary">{sensor.type}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>•</span>
                            <span>{sensor.lastSeen}</span>
                          </div>
                        </div>

                        <Button 
                          onClick={() => handleAssociateSensor(sensor)}
                          className="flex items-center gap-2"
                        >
                          <Link className="h-4 w-4" />
                          Asociar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Association Dialog */}
            <Dialog open={isAssociateDialogOpen} onOpenChange={setIsAssociateDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Asociar Sensor {selectedSensor?.uid}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                  {/* Tipo de Asociación */}
                  <div className="space-y-3">
                    <Label>Tipo de Asociación</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={associationType === "existing" ? "default" : "outline"}
                        onClick={() => setAssociationType("existing")}
                        className="flex items-center gap-2"
                      >
                        <Package className="h-4 w-4" />
                        Producto Existente
                      </Button>
                      <Button
                        variant={associationType === "new" ? "default" : "outline"}
                        onClick={() => setAssociationType("new")}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Nuevo Producto
                      </Button>
                    </div>
                  </div>

                  {/* Producto existente */}
                  {associationType === "existing" && (
                    <div className="space-y-2">
                      <Label htmlFor="product-select">Seleccionar Producto</Label>
                      <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                        <SelectTrigger id="product-select">
                          <SelectValue placeholder="Elegir producto existente" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Nuevo producto */}
                  {associationType === "new" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="product-name">Nombre del Producto</Label>
                        <Input
                          id="product-name"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Ej: Vacuna Hepatitis A"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rango de Temperatura</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label htmlFor="temp-min" className="text-xs">Mínima (°C)</Label>
                            <Input
                              id="temp-min"
                              type="number"
                              value={tempRange.min}
                              onChange={(e) => setTempRange(prev => ({ ...prev, min: e.target.value }))}
                              placeholder="2"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="temp-max" className="text-xs">Máxima (°C)</Label>
                            <Input
                              id="temp-max"
                              type="number"
                              value={tempRange.max}
                              onChange={(e) => setTempRange(prev => ({ ...prev, max: e.target.value }))}
                              placeholder="8"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botones */}
                  {associateError && (
                    <p className="text-sm text-destructive">{associateError}</p>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setIsAssociateDialogOpen(false)}
                      className="flex-1"
                      disabled={associateLoading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleConfirmAssociation}
                      disabled={
                        associateLoading ||
                        (associationType === "existing" && !selectedProduct) ||
                        (associationType === "new" && (!newProductName || !tempRange.min || !tempRange.max))
                      }
                      className="flex-1"
                    >
                      {associateLoading ? "Guardando…" : "Confirmar Asociación"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Productos</span>
                  <span className="font-medium">{products.length}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">En Rango Normal</span>
                  <span className="font-medium text-green-600">
                    {products.filter(p => p.status === 'normal').length}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Con Alerta</span>
                  <span className="font-medium text-red-600">
                    {products.filter(p => p.status === 'warning').length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* New Product Registration Dialog */}
        <Dialog open={isNewProductDialogOpen} onOpenChange={setIsNewProductDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Registrar Nuevo Producto
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-product-name">Nombre del Producto</Label>
                <Input
                  id="new-product-name"
                  value={newProductFormData.name}
                  onChange={(e) => setNewProductFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Vacuna Meningococo"
                />
              </div>

              <div className="space-y-2">
                <Label>Rango de Temperatura</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="new-temp-min" className="text-xs">Mínima (°C)</Label>
                    <Input
                      id="new-temp-min"
                      type="number"
                      value={newProductFormData.minTemp}
                      onChange={(e) => setNewProductFormData(prev => ({ ...prev, minTemp: e.target.value }))}
                      placeholder="2"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-temp-max" className="text-xs">Máxima (°C)</Label>
                    <Input
                      id="new-temp-max"
                      type="number"
                      value={newProductFormData.maxTemp}
                      onChange={(e) => setNewProductFormData(prev => ({ ...prev, maxTemp: e.target.value }))}
                      placeholder="8"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sensor-uid">Sensor a Asociar</Label>
                <Select 
                  value={newProductFormData.sensorUID} 
                  onValueChange={(value: any) => setNewProductFormData(prev => ({ ...prev, sensorUID: value }))}
                >
                  <SelectTrigger id="sensor-uid">
                    <SelectValue placeholder="Seleccionar sensor disponible (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassociatedSensors.map((sensor) => (
                      <SelectItem key={sensor.id} value={sensor.uid}>
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4" />
                          <span className="font-mono">{sensor.uid}</span>
                          <Badge variant="outline" className="text-xs">
                            {sensor.battery ?? "—"}%
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {createError && (
                <p className="text-sm text-destructive">{createError}</p>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsNewProductDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateNewProduct}
                  disabled={creating || !newProductFormData.name || !newProductFormData.minTemp || !newProductFormData.maxTemp}
                  className="flex-1"
                >
                  {creating ? "Creando…" : "Registrar Producto"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Chart Dialog */}
        <Dialog open={isProductChartDialogOpen} onOpenChange={setIsProductChartDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Gráfico de Temperatura - {selectedProductForChart?.name}
              </DialogTitle>
            </DialogHeader>

            {selectedProductForChart && (
              <div className="space-y-6">
                {/* Info del producto */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Rango Objetivo</p>
                    <p className="font-medium">{selectedProductForChart.tempRange}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Último Registro</p>
                    <p className="font-medium">{selectedProductForChart.lastRegistration}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Sensor</p>
                    <p className="font-mono text-sm">{selectedProductForChart.sensorUID}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estado</p>
                    <Badge 
                      variant={selectedProductForChart.status === 'normal' ? 'secondary' : 'destructive'}
                    >
                      {selectedProductForChart.status === 'normal' ? 'Normal' : 'Alerta'}
                    </Badge>
                  </div>
                </div>

                {/* Gráfico */}
                <div className="space-y-4">
                  <h4 className="font-medium">Historial de Temperatura vs Tiempo</h4>

                  {chartLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando gráfico…</p>
                  ) : chartError ? (
                    <p className="text-sm text-destructive">{chartError}</p>
                  ) : !selectedProductForChart?.temperatureData?.length ? (
                    <p className="text-sm text-muted-foreground">No hay lecturas disponibles para este producto.</p>
                  ) : (
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedProductForChart.temperatureData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis
                            domain={['dataMin - 0.3', 'dataMax + 0.3']}
                            label={{ value: 'Temperatura (°C)', angle: -90, position: 'insideLeft' }}
                          />
                          <Tooltip
                            formatter={(value: any) => [`${value}°C`, 'Temperatura']}
                            labelFormatter={(value) => `Hora: ${value}`}
                          />
                          <Line
                            type="monotone"
                            dataKey="temp"
                            stroke={selectedProductForChart.status === 'normal' ? "hsl(var(--chart-1))" : "hsl(var(--destructive))"}
                            strokeWidth={3}
                            dot={{
                              fill: selectedProductForChart.status === 'normal' ? "hsl(var(--chart-1))" : "hsl(var(--destructive))",
                              strokeWidth: 2,
                              r: 5
                            }}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Alerta si corresponde */}
                {selectedProductForChart.status === 'warning' && (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      <h5 className="font-medium">Alerta de Temperatura</h5>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      La temperatura del producto está fuera del rango objetivo. Revise las condiciones de almacenamiento.
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
