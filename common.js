/* =====================================================================
 * Ruta: common.js
 * CercApp — Núcleo compartido del frontend (lo cargan todas las páginas)
 * ---------------------------------------------------------------------
 *  1. Configuración y catálogos (categorías, barrios de Neiva, estados)
 *  2. Datos semilla (espejo exacto de database/schema.sql)
 *  3. Store: persistencia en localStorage (con respaldo en memoria)
 *  4. Capa API con FALLBACK automático:
 *       fetch → http://localhost:8080/api/...  ──(falla la red)──► localStorage
 *  5. Sesión por rol
 *  6. Validaciones de formularios (números, teléfono de 10 dígitos, obligatorios)
 *  7. Utilidades de interfaz (iconos, avatares, avisos, confirmaciones, modales)
 * ===================================================================== */
'use strict';

/* ===================== 1. CONFIGURACIÓN Y CATÁLOGOS ===================== */

const CONFIG = {
  API_BASE: 'http://localhost:8080/api',
  TIEMPO_ESPERA_MS: 3500,   // si la API no responde en este tiempo se usa el modo local
  REINTENTO_MS: 15000,      // tras una caída, se usa localStorage directo durante 15 s antes de volver a probar la API
  VERSION_DATOS: '1.0.0',   // cambiarla fuerza a recargar los datos semilla en localStorage
};

const CATEGORIAS = {
  PLOMERIA:     { nombre: 'Plomería',     icono: 'droplet' },
  ELECTRICIDAD: { nombre: 'Electricidad', icono: 'zap' },
  CERRAJERIA:   { nombre: 'Cerrajería',   icono: 'key' },
  ASEO:         { nombre: 'Aseo',         icono: 'sparkles' },
  CARPINTERIA:  { nombre: 'Carpintería',  icono: 'hammer' },
  REPARACIONES: { nombre: 'Reparaciones', icono: 'wrench' },
  PINTURA:      { nombre: 'Pintura',      icono: 'brush' },
  TECNOLOGIA:   { nombre: 'Tecnología',   icono: 'monitor' },
};

const UNIDADES_TARIFA = { VISITA: 'por visita', HORA: 'por hora', JORNADA: 'por jornada' };

const ESTADOS_SERVICIO = {
  PENDIENTE: { texto: 'En revisión', clase: 'badge-naranja' },
  PUBLICADO: { texto: 'Publicado',   clase: 'badge-verde' },
  PAUSADO:   { texto: 'Pausado',     clase: 'badge-gris' },
  RECHAZADO: { texto: 'Rechazado',   clase: 'badge-rojo' },
};

/** Orden del flujo de una solicitud (CANCELADA queda fuera del flujo). */
const FLUJO_SOLICITUD = ['PENDIENTE', 'ACEPTADA', 'EN_CAMINO', 'EN_EJECUCION', 'COMPLETADA'];
const ESTADOS_SOLICITUD = {
  PENDIENTE:    { paso: 'Solicitud enviada',      corto: 'Pendiente',  clase: 'badge-naranja' },
  ACEPTADA:     { paso: 'Aceptada por el profesional', corto: 'Aceptada', clase: 'badge-azul' },
  EN_CAMINO:    { paso: 'Profesional en camino',  corto: 'En camino',  clase: 'badge-azul' },
  EN_EJECUCION: { paso: 'Servicio en ejecución',  corto: 'En proceso', clase: 'badge-azul' },
  COMPLETADA:   { paso: 'Finalización y calificación', corto: 'Completada', clase: 'badge-verde' },
  CANCELADA:    { paso: 'Cancelada',              corto: 'Cancelada',  clase: 'badge-rojo' },
};

const BARRIOS_NEIVA = [
  'Altico', 'Calixto', 'Cándido Leguízamo', 'Centro', 'Ipanema',
  'Las Granjas', 'Los Mártires', 'Prado Alto', 'Quirinal', 'Santa Inés',
];

const FRANJAS_HORARIAS = [
  '7:00 a.m. – 10:00 a.m.', '8:00 a.m. – 12:00 m.', '12:00 m. – 3:00 p.m.',
  '2:00 p.m. – 6:00 p.m.', '6:00 p.m. – 8:00 p.m.',
];

const DISPONIBILIDADES_SUGERIDAS = [
  'Lunes a viernes · 8:00 a.m. – 6:00 p.m.',
  'Lunes a sábado · 7:00 a.m. – 7:00 p.m.',
  'Todos los días · 24 horas',
  'Sábados y domingos · 8:00 a.m. – 4:00 p.m.',
  'Con cita previa',
];

/* ===================== 2. DATOS SEMILLA ===================== */
/* Los mismos registros que inserta database/schema.sql, para que el
 * modo local se comporte igual que el backend recién instalado. */

const SEMILLA = {
  usuarios: [
    { id: 1,  nombre: 'Administrador CercApp',  email: 'admin@cercapp.co',           telefono: '3001112233', password: 'admin123',      rol: 'ADMIN',      ciudad: 'Neiva', barrio: 'Centro',            direccion: 'Carrera 5 # 8-20',   especialidad: null, aniosExperiencia: null, verificado: true,  estado: 'ACTIVO',     fechaRegistro: '2026-01-10T08:00:00' },
    { id: 2,  nombre: 'Carlos Méndez',          email: 'carlos.mendez@cercapp.co',   telefono: '3104567890', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Quirinal',          direccion: 'Calle 21 # 6-14',    especialidad: 'Plomería e instalaciones hidráulicas',       aniosExperiencia: 9,  verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-02-03T09:15:00' },
    { id: 3,  nombre: 'Andrea Dussán',          email: 'andrea.dussan@cercapp.co',   telefono: '3157894561', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Las Granjas',       direccion: 'Carrera 30 # 45-10', especialidad: 'Aseo y desinfección de vivienda',            aniosExperiencia: 6,  verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-02-11T10:30:00' },
    { id: 4,  nombre: 'Jorge Trujillo',         email: 'jorge.trujillo@cercapp.co',  telefono: '3112345678', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Altico',            direccion: 'Calle 7 # 12-33',    especialidad: 'Reparación de electrodomésticos y equipos',  aniosExperiencia: 12, verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-02-20T14:00:00' },
    { id: 5,  nombre: 'Diego Fernando Rivera',  email: 'diego.rivera@cercapp.co',    telefono: '3168765432', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Prado Alto',        direccion: 'Carrera 9 # 15-60',  especialidad: 'Plomería y redes hidráulicas',               aniosExperiencia: 7,  verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-03-02T11:45:00' },
    { id: 6,  nombre: 'Luisa Fernanda Perdomo', email: 'luisa.perdomo@cercapp.co',   telefono: '3209876543', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Ipanema',           direccion: 'Calle 34 # 18-05',   especialidad: 'Electricista residencial certificada RETIE', aniosExperiencia: 8,  verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-03-15T16:20:00' },
    { id: 7,  nombre: 'Hernán Cabrera',         email: 'hernan.cabrera@cercapp.co',  telefono: '3173334455', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Centro',            direccion: 'Carrera 4 # 10-48',  especialidad: 'Cerrajería residencial',                     aniosExperiencia: 15, verificado: false, estado: 'ACTIVO', fechaRegistro: '2026-04-01T08:40:00' },
    { id: 8,  nombre: 'Yesid Polanía',          email: 'yesid.polania@cercapp.co',   telefono: '3185556677', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Cándido Leguízamo', direccion: 'Calle 64 # 2-30',    especialidad: 'Carpintería y ebanistería',                  aniosExperiencia: 10, verificado: true,  estado: 'ACTIVO', fechaRegistro: '2026-04-18T13:10:00' },
    { id: 9,  nombre: 'Martha Liliana Charry',  email: 'martha.charry@cercapp.co',   telefono: '3137778899', password: 'trabajador123', rol: 'TRABAJADOR', ciudad: 'Neiva', barrio: 'Santa Inés',        direccion: 'Carrera 22 # 26-11', especialidad: 'Pintura y acabados de interiores',           aniosExperiencia: 5,  verificado: false, estado: 'ACTIVO', fechaRegistro: '2026-10-28T17:05:00' },
    { id: 10, nombre: 'Sebastián Rojas',        email: 'sebastian.rojas@correo.com', telefono: '3201234567', password: 'cliente123',    rol: 'CLIENTE',    ciudad: 'Neiva', barrio: 'Ipanema',           direccion: 'Calle 14 # 22-45',   especialidad: null, aniosExperiencia: null, verificado: false, estado: 'ACTIVO',     fechaRegistro: '2026-05-06T19:00:00' },
    { id: 11, nombre: 'María Fernanda Ramírez', email: 'mafe.ramirez@correo.com',    telefono: '3189876543', password: 'cliente123',    rol: 'CLIENTE',    ciudad: 'Neiva', barrio: 'Quirinal',          direccion: 'Carrera 6 # 19-27',  especialidad: null, aniosExperiencia: null, verificado: false, estado: 'ACTIVO',     fechaRegistro: '2026-06-14T12:25:00' },
    { id: 12, nombre: 'Julián Andrés Vargas',   email: 'julian.vargas@correo.com',   telefono: '3145550011', password: 'cliente123',    rol: 'CLIENTE',    ciudad: 'Neiva', barrio: 'Las Granjas',       direccion: 'Calle 50 # 31-08',   especialidad: null, aniosExperiencia: null, verificado: false, estado: 'SUSPENDIDO', fechaRegistro: '2026-07-21T15:50:00' },
  ],
  servicios: [
    { id: 1,  trabajador: { id: 2 }, titulo: 'Destape de cañerías y sifones', categoria: 'PLOMERIA', descripcion: 'Destape de lavaplatos, lavamanos, duchas y sifones de patio con sonda eléctrica y manual, sin romper baldosas. Incluye prueba de flujo al terminar.', tarifa: 45000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 7:00 a.m. – 7:00 p.m.', zonaCobertura: 'Quirinal, Ipanema, Prado Alto, Altico, Las Granjas', estado: 'PUBLICADO', calificacion: 4.9, numResenas: 134, fechaCreacion: '2026-02-05T08:00:00' },
    { id: 2,  trabajador: { id: 2 }, titulo: 'Reparación de fugas de agua', categoria: 'PLOMERIA', descripcion: 'Detección y reparación de fugas en tuberías, llaves de paso y registros. Impermeabilización puntual de muros afectados por humedad.', tarifa: 60000, unidadTarifa: 'VISITA', disponibilidad: 'Todos los días · urgencias 24 horas', zonaCobertura: 'Quirinal, Ipanema, Prado Alto, Altico, Las Granjas', estado: 'PUBLICADO', calificacion: 4.9, numResenas: 98, fechaCreacion: '2026-02-05T08:10:00' },
    { id: 3,  trabajador: { id: 2 }, titulo: 'Grifería y sanitarios: montaje y cambio', categoria: 'PLOMERIA', descripcion: 'Instalación y cambio de grifería, sanitarios, herrajes de tanque y llaves de lavamanos. Garantía escrita de 30 días en mano de obra.', tarifa: 75000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 7:00 a.m. – 7:00 p.m.', zonaCobertura: 'Quirinal, Ipanema, Prado Alto', estado: 'PUBLICADO', calificacion: 4.8, numResenas: 41, fechaCreacion: '2026-02-06T09:00:00' },
    { id: 4,  trabajador: { id: 3 }, titulo: 'Aseo profundo y desinfección de vivienda', categoria: 'ASEO', descripcion: 'Limpieza profunda de cocina, baños, pisos y ventanas con productos desinfectantes. Ideal para entrega de apartamento o después de una obra.', tarifa: 60000, unidadTarifa: 'JORNADA', disponibilidad: 'Martes a sábado · 8:00 a.m. – 5:00 p.m.', zonaCobertura: 'Las Granjas, Santa Inés, Calixto, Centro', estado: 'PUBLICADO', calificacion: 4.8, numResenas: 98, fechaCreacion: '2026-02-12T10:00:00' },
    { id: 5,  trabajador: { id: 4 }, titulo: 'Reparación de neveras y lavadoras', categoria: 'REPARACIONES', descripcion: 'Diagnóstico a domicilio y reparación de neveras, lavadoras y secadoras de todas las marcas. Repuestos originales con factura.', tarifa: 50000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a viernes · 8:00 a.m. – 6:00 p.m.', zonaCobertura: 'Altico, Centro, Los Mártires, Quirinal', estado: 'PUBLICADO', calificacion: 5.0, numResenas: 82, fechaCreacion: '2026-02-21T08:30:00' },
    { id: 6,  trabajador: { id: 4 }, titulo: 'Mantenimiento de aire acondicionado', categoria: 'REPARACIONES', descripcion: 'Limpieza profunda de unidades tipo mini split, revisión de presiones y recarga de gas refrigerante para equipos inverter y convencionales.', tarifa: 85000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 8:00 a.m. – 5:00 p.m.', zonaCobertura: 'Altico, Centro, Los Mártires, Quirinal, Ipanema', estado: 'PUBLICADO', calificacion: 4.9, numResenas: 37, fechaCreacion: '2026-03-01T09:30:00' },
    { id: 7,  trabajador: { id: 5 }, titulo: 'Instalación de calentadores a gas', categoria: 'PLOMERIA', descripcion: 'Instalación y mantenimiento de calentadores de paso a gas, filtros de agua ozonizada y reemplazo de tuberías PVC y CPVC.', tarifa: 50000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 2:00 p.m. – 7:00 p.m.', zonaCobertura: 'Prado Alto, Centro, Quirinal', estado: 'PUBLICADO', calificacion: 4.7, numResenas: 76, fechaCreacion: '2026-03-03T15:00:00' },
    { id: 8,  trabajador: { id: 6 }, titulo: 'Revisión y arreglo de cortos eléctricos', categoria: 'ELECTRICIDAD', descripcion: 'Localización de cortocircuitos, cambio de breakers y revisión del tablero eléctrico de la vivienda cumpliendo la norma RETIE.', tarifa: 55000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 7:00 a.m. – 6:00 p.m.', zonaCobertura: 'Ipanema, Quirinal, Altico, Cándido Leguízamo', estado: 'PUBLICADO', calificacion: 4.9, numResenas: 112, fechaCreacion: '2026-03-16T08:00:00' },
    { id: 9,  trabajador: { id: 6 }, titulo: 'Instalación de lámparas, tomas e interruptores', categoria: 'ELECTRICIDAD', descripcion: 'Instalación de lámparas LED, ventiladores de techo, tomas dobles e interruptores, con revisión de polo a tierra incluida.', tarifa: 35000, unidadTarifa: 'HORA', disponibilidad: 'Lunes a sábado · 7:00 a.m. – 6:00 p.m.', zonaCobertura: 'Ipanema, Quirinal, Altico', estado: 'PUBLICADO', calificacion: 4.8, numResenas: 64, fechaCreacion: '2026-03-16T08:20:00' },
    { id: 10, trabajador: { id: 7 }, titulo: 'Apertura de puertas y cambio de guardas', categoria: 'CERRAJERIA', descripcion: 'Apertura de puertas sin daños, cambio de guardas y chapas de seguridad, duplicado de llaves e instalación de cerrojos.', tarifa: 40000, unidadTarifa: 'VISITA', disponibilidad: 'Todos los días · 24 horas', zonaCobertura: 'Centro, Los Mártires, Santa Inés, Calixto, Altico', estado: 'PUBLICADO', calificacion: 4.6, numResenas: 58, fechaCreacion: '2026-04-02T09:00:00' },
    { id: 11, trabajador: { id: 8 }, titulo: 'Reparación de puertas, clósets y muebles', categoria: 'CARPINTERIA', descripcion: 'Ajuste de bisagras, cambio de rieles de cajones, reparación de clósets y puertas de madera, lacado y restauración de muebles.', tarifa: 70000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a viernes · 7:00 a.m. – 5:00 p.m.', zonaCobertura: 'Cándido Leguízamo, Las Granjas, Ipanema', estado: 'PUBLICADO', calificacion: 4.7, numResenas: 29, fechaCreacion: '2026-04-19T10:00:00' },
    { id: 12, trabajador: { id: 9 }, titulo: 'Pintura de interiores por habitación', categoria: 'PINTURA', descripcion: 'Resane de grietas, lijado y aplicación de dos manos de pintura tipo 1 en paredes y techos. Materiales cotizados aparte.', tarifa: 180000, unidadTarifa: 'JORNADA', disponibilidad: 'Lunes a sábado · 7:00 a.m. – 4:00 p.m.', zonaCobertura: 'Santa Inés, Calixto, Centro', estado: 'PENDIENTE', calificacion: 0, numResenas: 0, fechaCreacion: '2026-10-29T08:00:00' },
    { id: 13, trabajador: { id: 4 }, titulo: 'Instalación de TV, soportes y red WiFi del hogar', categoria: 'TECNOLOGIA', descripcion: 'Instalación de televisores en pared con soporte, organización de cableado y configuración de router y repetidores WiFi en casa.', tarifa: 65000, unidadTarifa: 'VISITA', disponibilidad: 'Lunes a sábado · 9:00 a.m. – 6:00 p.m.', zonaCobertura: 'Altico, Centro, Quirinal, Ipanema', estado: 'PUBLICADO', calificacion: 4.8, numResenas: 15, fechaCreacion: '2026-05-10T11:00:00' },
    { id: 14, trabajador: { id: 3 }, titulo: 'Lavado de muebles y colchones', categoria: 'ASEO', descripcion: 'Lavado en seco e inyección-succión de salas, sillas, colchones y tapetes. Secado rápido y eliminación de ácaros y olores.', tarifa: 90000, unidadTarifa: 'VISITA', disponibilidad: 'Sábados y domingos · 8:00 a.m. – 4:00 p.m.', zonaCobertura: 'Las Granjas, Santa Inés, Calixto', estado: 'PAUSADO', calificacion: 4.7, numResenas: 22, fechaCreacion: '2026-05-22T09:00:00' },
  ],
  favoritos: { 10: [1, 8], 11: [4] },
  solicitudes: [
    { id: 1, cliente: { id: 10 }, servicio: { id: 2 }, descripcion: 'Tengo una fuga continua debajo del lavaplatos de la cocina que gotea hacia el mueble y ya empezó a hinchar la madera.', direccion: 'Calle 14 # 22-45', barrio: 'Ipanema', fechaPreferida: '2026-11-20', franjaHoraria: '8:00 a.m. – 12:00 m.', estado: 'EN_EJECUCION', calificacion: null, comentario: null, fechaCreacion: '2026-11-18T08:30:00' },
    { id: 2, cliente: { id: 10 }, servicio: { id: 6 }, descripcion: 'Limpieza profunda y recarga de gas del aire acondicionado de la habitación principal, enfría muy poco desde hace un mes.', direccion: 'Calle 14 # 22-45', barrio: 'Ipanema', fechaPreferida: '2026-11-16', franjaHoraria: '2:00 p.m. – 6:00 p.m.', estado: 'COMPLETADA', calificacion: null, comentario: null, fechaCreacion: '2026-11-14T15:00:00' },
    { id: 3, cliente: { id: 11 }, servicio: { id: 4 }, descripcion: 'Necesito aseo profundo del apartamento antes de entregarlo al arrendador: cocina, dos baños y ventanas.', direccion: 'Carrera 6 # 19-27', barrio: 'Quirinal', fechaPreferida: '2026-11-24', franjaHoraria: '8:00 a.m. – 12:00 m.', estado: 'PENDIENTE', calificacion: null, comentario: null, fechaCreacion: '2026-11-19T09:10:00' },
    { id: 4, cliente: { id: 11 }, servicio: { id: 1 }, descripcion: 'El lavamanos del baño social está totalmente tapado y el agua no baja, ya intenté con destapador sin resultado.', direccion: 'Carrera 6 # 19-27', barrio: 'Quirinal', fechaPreferida: '2026-11-05', franjaHoraria: '8:00 a.m. – 12:00 m.', estado: 'COMPLETADA', calificacion: 5, comentario: 'Llegó puntual y solucionó todo rápido. Muy honesto con el precio.', fechaCreacion: '2026-11-04T18:40:00' },
  ],
};

/* ===================== 3. STORE (localStorage) ===================== */

const Store = (() => {
  const PREFIJO = 'cercapp_';
  const memoria = {};        // respaldo si localStorage está bloqueado (modo incógnito estricto)
  let disponible = true;
  try {
    localStorage.setItem('__cercapp_prueba', '1');
    localStorage.removeItem('__cercapp_prueba');
  } catch (e) {
    disponible = false;
  }

  /** Lee y parsea una colección; devuelve `defecto` si no existe o está corrupta. */
  function leer(nombre, defecto) {
    try {
      const crudo = disponible ? localStorage.getItem(PREFIJO + nombre) : memoria[nombre];
      return crudo == null ? defecto : JSON.parse(crudo);
    } catch (e) {
      return defecto;
    }
  }

  function guardar(nombre, valor) {
    const texto = JSON.stringify(valor);
    if (disponible) {
      try { localStorage.setItem(PREFIJO + nombre, texto); return; } catch (e) { /* cuota llena: usa memoria */ }
    }
    memoria[nombre] = texto;
  }

  function eliminar(nombre) {
    if (disponible) localStorage.removeItem(PREFIJO + nombre);
    delete memoria[nombre];
  }

  /** Id autoincremental local (máximo actual + 1). */
  function siguienteId(lista) {
    return lista.reduce((max, x) => Math.max(max, Number(x.id) || 0), 0) + 1;
  }

  /** Inserta o fusiona un registro por id (conserva campos que la API no devuelve, como la contraseña). */
  function upsert(nombre, item) {
    if (!item || item.id == null) return item;
    const lista = leer(nombre, []);
    const i = lista.findIndex(x => x.id === item.id);
    if (i >= 0) lista[i] = { ...lista[i], ...item }; else lista.push(item);
    guardar(nombre, lista);
    return item;
  }

  function upsertVarios(nombre, items) {
    const lista = leer(nombre, []);
    const indice = new Map(lista.map((x, i) => [x.id, i]));
    (items || []).forEach(item => {
      if (!item || item.id == null) return;
      if (indice.has(item.id)) lista[indice.get(item.id)] = { ...lista[indice.get(item.id)], ...item };
      else { indice.set(item.id, lista.length); lista.push(item); }
    });
    guardar(nombre, lista);
  }

  /** Reemplaza la colección por la de la API (lista completa), fusionando campos locales extra. */
  function sincronizar(nombre, items) {
    const previos = new Map(leer(nombre, []).map(x => [x.id, x]));
    guardar(nombre, (items || []).map(x => ({ ...(previos.get(x.id) || {}), ...x })));
  }

  /** Carga los datos semilla la primera vez (o si `forzar` es true). */
  function inicializar(forzar = false) {
    if (!forzar && leer('version', null) === CONFIG.VERSION_DATOS) return;
    guardar('usuarios', SEMILLA.usuarios);
    guardar('servicios', SEMILLA.servicios);
    guardar('favoritos', SEMILLA.favoritos);
    guardar('solicitudes', SEMILLA.solicitudes);
    guardar('version', CONFIG.VERSION_DATOS);
  }

  return { leer, guardar, eliminar, siguienteId, upsert, upsertVarios, sincronizar, inicializar, disponible };
})();

/* ===================== 4. CAPA API CON FALLBACK ===================== */

/** Error uniforme para la interfaz. `esRed` = no se pudo contactar al servidor. */
class ApiError extends Error {
  constructor(mensaje, { estado = 0, errores = null, esRed = false } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.errores = errores;
    this.esRed = esRed;
  }
}

/** Estado de la conexión con el backend; las páginas se suscriben para pintar el indicador. */
const Conexion = {
  modo: 'desconocido',   // 'online' | 'offline' | 'desconocido'
  ultimoFallo: 0,
  oyentes: [],
  marcar(modo) {
    if (modo === 'offline') this.ultimoFallo = Date.now();
    if (modo !== this.modo) {
      this.modo = modo;
      this.oyentes.forEach(fn => fn(modo));
    }
  },
  /** Tras una caída reciente se evita esperar el timeout en cada petición. */
  debeSaltarApi() {
    return this.modo === 'offline' && Date.now() - this.ultimoFallo < CONFIG.REINTENTO_MS;
  },
  reintentar() { this.ultimoFallo = 0; },
  alCambiar(fn) { this.oyentes.push(fn); fn(this.modo); },
};

/**
 * Petición HTTP a la API REST con tiempo de espera.
 * - Error de red / timeout  → ApiError con esRed = true  (activa el fallback)
 * - Respuesta 4xx / 5xx     → ApiError con el mensaje del servidor (NO activa el fallback)
 */
async function peticionApi(ruta, { metodo = 'GET', cuerpo } = {}) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), CONFIG.TIEMPO_ESPERA_MS);
  let respuesta;
  try {
    respuesta = await fetch(CONFIG.API_BASE + ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: control.signal,
    });
  } catch (e) {
    throw new ApiError('El servidor no está disponible.', { esRed: true });
  } finally {
    clearTimeout(temporizador);
  }
  if (respuesta.status === 204) return null;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ApiError((datos && datos.mensaje) || `Error ${respuesta.status} del servidor.`, {
      estado: respuesta.status,
      errores: datos && datos.errores,
    });
  }
  return datos;
}

/**
 * Núcleo del FALLBACK: intenta la operación remota y, solo si falla la RED,
 * ejecuta la operación equivalente sobre localStorage. Los errores de validación
 * del servidor (400, 409...) se propagan para mostrarlos en el formulario.
 */
async function conFallback(operacionRemota, operacionLocal) {
  if (Conexion.debeSaltarApi()) return operacionLocal();
  try {
    const resultado = await operacionRemota();
    Conexion.marcar('online');
    return resultado;
  } catch (error) {
    if (error.esRed) {
      Conexion.marcar('offline');
      return operacionLocal();
    }
    throw error;
  }
}

/** Construye "?a=1&b=2" omitiendo valores vacíos. */
function qs(parametros = {}) {
  const pares = Object.entries(parametros).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return pares.length ? '?' + pares.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
}

const hoyISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const ahoraISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 19);
};

/* ---------- Implementación LOCAL (misma lógica de negocio que el backend) ---------- */
const Local = {
  /** Copia del usuario sin contraseña (igual que el JSON de la API). */
  publico(u) {
    if (!u) return null;
    const { password, ...resto } = u;
    return resto;
  },

  usuarios: {
    listar(rol) {
      const lista = Store.leer('usuarios', []);
      return (rol ? lista.filter(u => u.rol === rol) : lista).map(Local.publico).sort((a, b) => a.id - b.id);
    },
    obtener(id) {
      const u = Store.leer('usuarios', []).find(x => x.id === Number(id));
      if (!u) throw new ApiError('Usuario no encontrado.', { estado: 404 });
      return Local.publico(u);
    },
    crear(datos) {
      const lista = Store.leer('usuarios', []);
      const email = String(datos.email || '').trim().toLowerCase();
      if (lista.some(u => u.email.toLowerCase() === email)) {
        throw new ApiError('Ya existe un usuario registrado con ese correo.', { estado: 409, errores: { email: 'Este correo ya está registrado.' } });
      }
      if (!datos.password) throw new ApiError('La contraseña es obligatoria (mínimo 6 caracteres).', { estado: 400, errores: { password: 'Obligatoria.' } });
      const nuevo = {
        ciudad: 'Neiva', verificado: false, estado: 'ACTIVO', especialidad: null, aniosExperiencia: null,
        ...datos,
        id: Store.siguienteId(lista),
        email,
        nombre: String(datos.nombre).trim(),
        fechaRegistro: ahoraISO(),
      };
      if (nuevo.rol !== 'TRABAJADOR') { nuevo.especialidad = null; nuevo.aniosExperiencia = null; }
      lista.push(nuevo);
      Store.guardar('usuarios', lista);
      return Local.publico(nuevo);
    },
    actualizar(id, datos) {
      const lista = Store.leer('usuarios', []);
      const i = lista.findIndex(u => u.id === Number(id));
      if (i < 0) throw new ApiError('Usuario no encontrado.', { estado: 404 });
      const email = String(datos.email || lista[i].email).trim().toLowerCase();
      if (lista.some(u => u.id !== Number(id) && u.email.toLowerCase() === email)) {
        throw new ApiError('Ya existe otro usuario con ese correo.', { estado: 409, errores: { email: 'Este correo ya está en uso.' } });
      }
      const { password, ...resto } = datos;
      lista[i] = { ...lista[i], ...resto, id: lista[i].id, email, ...(password ? { password } : {}) };
      if (lista[i].rol !== 'TRABAJADOR') { lista[i].especialidad = null; lista[i].aniosExperiencia = null; }
      Store.guardar('usuarios', lista);
      return Local.publico(lista[i]);
    },
    /** Elimina en cascada: servicios del trabajador, favoritos y solicitudes (igual que ON DELETE CASCADE). */
    eliminar(id, { silencioso = false } = {}) {
      id = Number(id);
      const lista = Store.leer('usuarios', []);
      if (!lista.some(u => u.id === id)) {
        if (silencioso) return null;
        throw new ApiError('Usuario no encontrado.', { estado: 404 });
      }
      Store.guardar('usuarios', lista.filter(u => u.id !== id));
      const servicios = Store.leer('servicios', []);
      const idsServicios = servicios.filter(s => s.trabajador && s.trabajador.id === id).map(s => s.id);
      idsServicios.forEach(sid => Local.servicios.eliminar(sid, { silencioso: true }));
      const favoritos = Store.leer('favoritos', {});
      delete favoritos[id];
      Store.guardar('favoritos', favoritos);
      Store.guardar('solicitudes', Store.leer('solicitudes', []).filter(s => s.cliente.id !== id));
      return null;
    },
    login(email, password) {
      const u = Store.leer('usuarios', []).find(x => x.email.toLowerCase() === String(email).trim().toLowerCase());
      if (!u || u.password !== password) throw new ApiError('Correo o contraseña incorrectos.', { estado: 401 });
      if (u.estado === 'SUSPENDIDO') throw new ApiError('Tu cuenta está suspendida. Contacta al administrador.', { estado: 403 });
      return Local.publico(u);
    },
  },

  servicios: {
    /** Une el servicio con los datos actuales de su trabajador. */
    hidratar(s, usuarios) {
      const t = usuarios.find(u => u.id === (s.trabajador && s.trabajador.id));
      return { ...s, trabajador: t ? Local.publico(t) : s.trabajador };
    },
    listar(filtros = {}) {
      const usuarios = Store.leer('usuarios', []);
      const patron = filtros.q ? UI.normalizarTexto(filtros.q) : null;
      return Store.leer('servicios', [])
        .filter(s => !filtros.categoria || s.categoria === filtros.categoria)
        .filter(s => !filtros.estado || s.estado === filtros.estado)
        .filter(s => !filtros.trabajadorId || s.trabajador.id === Number(filtros.trabajadorId))
        .filter(s => !patron || UI.normalizarTexto(`${s.titulo} ${s.descripcion} ${s.zonaCobertura}`).includes(patron))
        .sort((a, b) => (b.calificacion - a.calificacion) || (a.id - b.id))
        .map(s => Local.servicios.hidratar(s, usuarios));
    },
    obtener(id) {
      const s = Store.leer('servicios', []).find(x => x.id === Number(id));
      if (!s) throw new ApiError('Servicio no encontrado.', { estado: 404 });
      return Local.servicios.hidratar(s, Store.leer('usuarios', []));
    },
    validarTrabajador(trabajadorId) {
      const t = Store.leer('usuarios', []).find(u => u.id === Number(trabajadorId));
      if (!t) throw new ApiError('El trabajador indicado no existe.', { estado: 400 });
      if (t.rol !== 'TRABAJADOR') throw new ApiError('El usuario indicado no tiene rol TRABAJADOR.', { estado: 400 });
      if (t.estado === 'SUSPENDIDO') throw new ApiError('El trabajador está suspendido y no puede publicar servicios.', { estado: 403 });
      return t;
    },
    crear(datos) {
      const t = Local.servicios.validarTrabajador(datos.trabajador && datos.trabajador.id);
      const lista = Store.leer('servicios', []);
      const nuevo = {
        ...datos,
        id: Store.siguienteId(lista),
        trabajador: { id: t.id },
        tarifa: Number(datos.tarifa),
        unidadTarifa: datos.unidadTarifa || 'VISITA',
        estado: datos.estado || 'PENDIENTE',
        calificacion: 0,
        numResenas: 0,
        fechaCreacion: ahoraISO(),
      };
      lista.push(nuevo);
      Store.guardar('servicios', lista);
      return Local.servicios.hidratar(nuevo, Store.leer('usuarios', []));
    },
    actualizar(id, datos) {
      const lista = Store.leer('servicios', []);
      const i = lista.findIndex(s => s.id === Number(id));
      if (i < 0) throw new ApiError('Servicio no encontrado.', { estado: 404 });
      const actual = lista[i];
      const nuevoTrabajadorId = Number((datos.trabajador && datos.trabajador.id) || actual.trabajador.id);
      if (nuevoTrabajadorId !== actual.trabajador.id) Local.servicios.validarTrabajador(nuevoTrabajadorId);
      lista[i] = {
        ...actual, ...datos,
        id: actual.id,
        tarifa: Number(datos.tarifa != null ? datos.tarifa : actual.tarifa),
        trabajador: { id: nuevoTrabajadorId },
        calificacion: actual.calificacion,      // la reputación no se edita
        numResenas: actual.numResenas,
        fechaCreacion: actual.fechaCreacion,
      };
      Store.guardar('servicios', lista);
      return Local.servicios.hidratar(lista[i], Store.leer('usuarios', []));
    },
    eliminar(id, { silencioso = false } = {}) {
      id = Number(id);
      const lista = Store.leer('servicios', []);
      if (!lista.some(s => s.id === id)) {
        if (silencioso) return null;
        throw new ApiError('Servicio no encontrado.', { estado: 404 });
      }
      Store.guardar('servicios', lista.filter(s => s.id !== id));
      const favoritos = Store.leer('favoritos', {});
      Object.keys(favoritos).forEach(k => { favoritos[k] = favoritos[k].filter(sid => sid !== id); });
      Store.guardar('favoritos', favoritos);
      Store.guardar('solicitudes', Store.leer('solicitudes', []).filter(s => s.servicio.id !== id));
      return null;
    },
  },

  favoritos: {
    listar(clienteId) {
      const ids = Store.leer('favoritos', {})[clienteId] || [];
      return Local.servicios.listar().filter(s => ids.includes(s.id)).sort((a, b) => a.id - b.id);
    },
    reemplazar(clienteId, ids) {
      const mapa = Store.leer('favoritos', {});
      mapa[clienteId] = ids;
      Store.guardar('favoritos', mapa);
    },
    agregar(clienteId, servicioId) {
      const cliente = Store.leer('usuarios', []).find(u => u.id === Number(clienteId));
      if (!cliente || cliente.rol !== 'CLIENTE') throw new ApiError('Solo los clientes pueden guardar favoritos.', { estado: 400 });
      Local.servicios.obtener(servicioId);
      const mapa = Store.leer('favoritos', {});
      const ids = new Set(mapa[clienteId] || []);
      ids.add(Number(servicioId));
      mapa[clienteId] = [...ids];
      Store.guardar('favoritos', mapa);
      return Local.favoritos.listar(clienteId);
    },
    quitar(clienteId, servicioId) {
      const mapa = Store.leer('favoritos', {});
      mapa[clienteId] = (mapa[clienteId] || []).filter(id => id !== Number(servicioId));
      Store.guardar('favoritos', mapa);
      return Local.favoritos.listar(clienteId);
    },
  },

  solicitudes: {
    hidratar(s, usuarios, servicios) {
      const c = usuarios.find(u => u.id === s.cliente.id);
      const sv = servicios.find(x => x.id === s.servicio.id);
      return {
        ...s,
        cliente: c ? Local.publico(c) : s.cliente,
        servicio: sv ? Local.servicios.hidratar(sv, usuarios) : s.servicio,
      };
    },
    listar({ clienteId, trabajadorId } = {}) {
      const usuarios = Store.leer('usuarios', []);
      const servicios = Store.leer('servicios', []);
      return Store.leer('solicitudes', [])
        .map(s => Local.solicitudes.hidratar(s, usuarios, servicios))
        .filter(s => !clienteId || s.cliente.id === Number(clienteId))
        .filter(s => !trabajadorId || (s.servicio.trabajador && s.servicio.trabajador.id === Number(trabajadorId)))
        .sort((a, b) => String(b.fechaCreacion).localeCompare(String(a.fechaCreacion)));
    },
    obtener(id) {
      const s = Store.leer('solicitudes', []).find(x => x.id === Number(id));
      if (!s) throw new ApiError('Solicitud no encontrada.', { estado: 404 });
      return Local.solicitudes.hidratar(s, Store.leer('usuarios', []), Store.leer('servicios', []));
    },
    crear(datos) {
      const cliente = Store.leer('usuarios', []).find(u => u.id === Number(datos.cliente && datos.cliente.id));
      if (!cliente || cliente.rol !== 'CLIENTE') throw new ApiError('Solo los clientes pueden solicitar servicios.', { estado: 400 });
      const servicio = Store.leer('servicios', []).find(s => s.id === Number(datos.servicio && datos.servicio.id));
      if (!servicio) throw new ApiError('El servicio indicado no existe.', { estado: 400 });
      if (servicio.estado !== 'PUBLICADO') throw new ApiError('El servicio no está disponible en este momento.', { estado: 400 });
      if (datos.fechaPreferida < hoyISO()) throw new ApiError('La fecha preferida no puede estar en el pasado.', { estado: 400, errores: { fechaPreferida: 'Elige hoy o una fecha futura.' } });
      const lista = Store.leer('solicitudes', []);
      const nueva = {
        ...datos,
        id: Store.siguienteId(lista),
        cliente: { id: cliente.id },
        servicio: { id: servicio.id },
        estado: 'PENDIENTE',
        calificacion: null,
        comentario: null,
        fechaCreacion: ahoraISO(),
      };
      lista.push(nueva);
      Store.guardar('solicitudes', lista);
      return Local.solicitudes.obtener(nueva.id);
    },
    /** Cambia estado o califica; la primera calificación recalcula el promedio del servicio. */
    actualizar(id, datos) {
      const lista = Store.leer('solicitudes', []);
      const i = lista.findIndex(s => s.id === Number(id));
      if (i < 0) throw new ApiError('Solicitud no encontrada.', { estado: 404 });
      const actual = lista[i];
      const estado = datos.estado || actual.estado;
      const cambio = {
        descripcion: datos.descripcion ?? actual.descripcion,
        direccion: datos.direccion ?? actual.direccion,
        barrio: datos.barrio ?? actual.barrio,
        fechaPreferida: datos.fechaPreferida ?? actual.fechaPreferida,
        franjaHoraria: datos.franjaHoraria ?? actual.franjaHoraria,
        estado,
      };
      if (datos.calificacion && actual.calificacion == null) {
        if (estado !== 'COMPLETADA') throw new ApiError('Solo se pueden calificar servicios completados.', { estado: 400 });
        cambio.calificacion = Number(datos.calificacion);
        cambio.comentario = datos.comentario || null;
        const servicios = Store.leer('servicios', []);
        const s = servicios.find(x => x.id === actual.servicio.id);
        if (s) {
          const n = Number(s.numResenas) || 0;
          s.calificacion = Math.round(((Number(s.calificacion) || 0) * n + cambio.calificacion) / (n + 1) * 10) / 10;
          s.numResenas = n + 1;
          Store.guardar('servicios', servicios);
        }
      }
      lista[i] = { ...actual, ...cambio };
      Store.guardar('solicitudes', lista);
      return Local.solicitudes.obtener(id);
    },
    eliminar(id, { silencioso = false } = {}) {
      const lista = Store.leer('solicitudes', []);
      if (!lista.some(s => s.id === Number(id))) {
        if (silencioso) return null;
        throw new ApiError('Solicitud no encontrada.', { estado: 404 });
      }
      Store.guardar('solicitudes', lista.filter(s => s.id !== Number(id)));
      return null;
    },
  },
};

/* ---------- API pública que usan las páginas (remoto con fallback local) ---------- */
const CercAPI = {
  usuarios: {
    listar: (rol) => conFallback(
      async () => {
        const datos = await peticionApi('/usuarios' + qs({ rol }));
        rol ? Store.upsertVarios('usuarios', datos) : Store.sincronizar('usuarios', datos);
        return datos;
      },
      () => Local.usuarios.listar(rol)),

    obtener: (id) => conFallback(
      async () => Store.upsert('usuarios', await peticionApi(`/usuarios/${id}`)),
      () => Local.usuarios.obtener(id)),

    crear: (datos) => conFallback(
      async () => {
        const u = await peticionApi('/usuarios', { metodo: 'POST', cuerpo: datos });
        Store.upsert('usuarios', { ...u, password: datos.password });   // permite el login offline después
        return u;
      },
      () => Local.usuarios.crear(datos)),

    actualizar: (id, datos) => conFallback(
      async () => {
        const u = await peticionApi(`/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos });
        Store.upsert('usuarios', datos.password ? { ...u, password: datos.password } : u);
        return u;
      },
      () => Local.usuarios.actualizar(id, datos)),

    eliminar: (id) => conFallback(
      async () => { await peticionApi(`/usuarios/${id}`, { metodo: 'DELETE' }); Local.usuarios.eliminar(id, { silencioso: true }); return null; },
      () => Local.usuarios.eliminar(id)),

    login: (email, password) => conFallback(
      async () => {
        const u = await peticionApi('/usuarios/login', { metodo: 'POST', cuerpo: { email, password } });
        Store.upsert('usuarios', { ...u, password });
        return u;
      },
      () => Local.usuarios.login(email, password)),
  },

  servicios: {
    listar: (filtros = {}) => conFallback(
      async () => {
        const datos = await peticionApi('/servicios' + qs(filtros));
        const sinFiltros = !Object.values(filtros).some(v => v !== undefined && v !== null && v !== '');
        sinFiltros ? Store.sincronizar('servicios', datos) : Store.upsertVarios('servicios', datos);
        Store.upsertVarios('usuarios', datos.map(s => s.trabajador).filter(Boolean));
        return datos;
      },
      () => Local.servicios.listar(filtros)),

    obtener: (id) => conFallback(
      async () => Store.upsert('servicios', await peticionApi(`/servicios/${id}`)),
      () => Local.servicios.obtener(id)),

    crear: (datos) => conFallback(
      async () => Store.upsert('servicios', await peticionApi('/servicios', { metodo: 'POST', cuerpo: datos })),
      () => Local.servicios.crear(datos)),

    actualizar: (id, datos) => conFallback(
      async () => Store.upsert('servicios', await peticionApi(`/servicios/${id}`, { metodo: 'PUT', cuerpo: datos })),
      () => Local.servicios.actualizar(id, datos)),

    eliminar: (id) => conFallback(
      async () => { await peticionApi(`/servicios/${id}`, { metodo: 'DELETE' }); Local.servicios.eliminar(id, { silencioso: true }); return null; },
      () => Local.servicios.eliminar(id)),
  },

  favoritos: {
    listar: (clienteId) => conFallback(
      async () => {
        const datos = await peticionApi(`/usuarios/${clienteId}/favoritos`);
        Store.upsertVarios('servicios', datos);
        Local.favoritos.reemplazar(clienteId, datos.map(s => s.id));
        return datos;
      },
      () => Local.favoritos.listar(clienteId)),

    agregar: (clienteId, servicioId) => conFallback(
      async () => {
        const datos = await peticionApi(`/usuarios/${clienteId}/favoritos/${servicioId}`, { metodo: 'POST' });
        Local.favoritos.reemplazar(clienteId, datos.map(s => s.id));
        return datos;
      },
      () => Local.favoritos.agregar(clienteId, servicioId)),

    quitar: (clienteId, servicioId) => conFallback(
      async () => {
        const datos = await peticionApi(`/usuarios/${clienteId}/favoritos/${servicioId}`, { metodo: 'DELETE' });
        Local.favoritos.reemplazar(clienteId, datos.map(s => s.id));
        return datos;
      },
      () => Local.favoritos.quitar(clienteId, servicioId)),
  },

  solicitudes: {
    listar: (filtros = {}) => conFallback(
      async () => {
        const datos = await peticionApi('/solicitudes' + qs(filtros));
        const sinFiltros = !filtros.clienteId && !filtros.trabajadorId;
        sinFiltros ? Store.sincronizar('solicitudes', datos) : Store.upsertVarios('solicitudes', datos);
        return datos;
      },
      () => Local.solicitudes.listar(filtros)),

    crear: (datos) => conFallback(
      async () => Store.upsert('solicitudes', await peticionApi('/solicitudes', { metodo: 'POST', cuerpo: datos })),
      () => Local.solicitudes.crear(datos)),

    actualizar: (id, datos) => conFallback(
      async () => Store.upsert('solicitudes', await peticionApi(`/solicitudes/${id}`, { metodo: 'PUT', cuerpo: datos })),
      () => Local.solicitudes.actualizar(id, datos)),

    eliminar: (id) => conFallback(
      async () => { await peticionApi(`/solicitudes/${id}`, { metodo: 'DELETE' }); Local.solicitudes.eliminar(id, { silencioso: true }); return null; },
      () => Local.solicitudes.eliminar(id)),
  },
};

/** Cuerpo completo que espera PUT /api/solicitudes/{id} a partir de una solicitud cargada. */
function cuerpoSolicitud(s, cambios = {}) {
  return {
    cliente: { id: s.cliente.id },
    servicio: { id: s.servicio.id },
    descripcion: s.descripcion,
    direccion: s.direccion,
    barrio: s.barrio,
    fechaPreferida: s.fechaPreferida,
    franjaHoraria: s.franjaHoraria,
    estado: s.estado,
    calificacion: s.calificacion,
    comentario: s.comentario,
    ...cambios,
  };
}

/** Cuerpo completo que espera PUT /api/servicios/{id}. */
function cuerpoServicio(s, cambios = {}) {
  return {
    titulo: s.titulo,
    categoria: s.categoria,
    descripcion: s.descripcion,
    tarifa: Number(s.tarifa),
    unidadTarifa: s.unidadTarifa,
    disponibilidad: s.disponibilidad,
    zonaCobertura: s.zonaCobertura,
    estado: s.estado,
    trabajador: { id: s.trabajador.id },
    ...cambios,
  };
}

/** Cuerpo completo que espera PUT /api/usuarios/{id} (sin contraseña: se conserva la actual). */
function cuerpoUsuario(u, cambios = {}) {
  return {
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    rol: u.rol,
    ciudad: u.ciudad || 'Neiva',
    barrio: u.barrio || null,
    direccion: u.direccion || null,
    especialidad: u.especialidad || null,
    aniosExperiencia: u.aniosExperiencia ?? null,
    verificado: !!u.verificado,
    estado: u.estado || 'ACTIVO',
    ...cambios,
  };
}

/* ===================== 5. SESIÓN ===================== */

const Sesion = {
  obtener() { return Store.leer('sesion', null); },
  iniciar(usuario) { Store.guardar('sesion', Local.publico(usuario)); },
  cerrar() { Store.eliminar('sesion'); window.location.href = 'index.html'; },
  rutaPorRol(rol) {
    return { ADMIN: 'admin_dashboard.html', TRABAJADOR: 'trabajador_panel.html', CLIENTE: 'cliente_portal.html' }[rol] || 'index.html';
  },
  /** Protege cada panel: si no hay sesión del rol indicado, vuelve al inicio con el acceso abierto. */
  exigirRol(rol) {
    const s = this.obtener();
    if (!s || s.rol !== rol) {
      window.location.replace(`index.html?acceso=${rol.toLowerCase()}`);
      return null;
    }
    return s;
  },
};

/* ===================== 6. VALIDACIONES ===================== */

const Validar = {
  // Cada validador recibe el valor (texto ya recortado) y devuelve un mensaje de error o null.
  requerido: (v) => (String(v ?? '').trim() ? null : 'Este campo es obligatorio.'),

  telefono: (v) => (/^\d{10}$/.test(v) ? null : 'El teléfono debe tener exactamente 10 dígitos numéricos.'),

  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Ingresa un correo válido (ej. nombre@correo.com).'),

  /** Solo dígitos (sin letras, signos, puntos ni notación científica) y dentro del rango. */
  entero: (min, max, etiqueta = 'El valor') => (v) => {
    if (!/^\d+$/.test(String(v))) return `${etiqueta} solo admite números enteros (sin letras ni símbolos).`;
    const n = Number(v);
    if (n < min || n > max) return `${etiqueta} debe estar entre ${min.toLocaleString('es-CO')} y ${max.toLocaleString('es-CO')}.`;
    return null;
  },

  minLargo: (n) => (v) => (String(v).trim().length >= n ? null : `Debe tener al menos ${n} caracteres.`),
  maxLargo: (n) => (v) => (String(v).trim().length <= n ? null : `No puede superar ${n} caracteres.`),
  soloLetras: (v) => (/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(v) ? null : 'Solo se permiten letras y espacios.'),
  fechaNoPasada: (v) => (v >= hoyISO() ? null : 'La fecha no puede estar en el pasado.'),
  enLista: (lista, mensaje = 'Selecciona una opción válida.') => (v) => (lista.includes(v) ? null : mensaje),

  /** Aplica las reglas solo si el campo tiene contenido. */
  opcional: (...validadores) => (v) => {
    if (!String(v ?? '').trim()) return null;
    for (const fn of validadores) { const m = fn(v); if (m) return m; }
    return null;
  },

  /**
   * Valida un formulario completo.
   * @param {HTMLFormElement} form
   * @param {Object<string, Function[]>} reglas  { nombreCampo: [validador, ...] }
   * @returns {Object|null} datos limpios si todo es válido; null si hay errores (ya pintados en pantalla).
   */
  formulario(form, reglas) {
    this.limpiar(form);
    const datos = {};
    let primerError = null;
    for (const [campo, validadores] of Object.entries(reglas)) {
      const el = form.elements[campo];
      if (!el) continue;
      let valor; let foco;
      if (typeof RadioNodeList !== 'undefined' && el instanceof RadioNodeList) {
        // Grupo de casillas (ej. barrios de cobertura): se unen los marcados con coma
        valor = [...el].filter(i => i.checked).map(i => i.value).join(', ');
        foco = el[0];
      } else {
        valor = String(el.value ?? '').trim();
        foco = el;
      }
      datos[campo] = valor;
      for (const validador of validadores) {
        const mensaje = validador(valor);
        if (mensaje) {
          this.marcarError(foco, mensaje);
          primerError = primerError || foco;
          break;
        }
      }
    }
    if (primerError) {
      primerError.focus({ preventScroll: true });
      primerError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return datos;
  },

  marcarError(el, mensaje) {
    const campo = el.closest('.field');
    if (el.classList) el.classList.add('is-invalid');
    if (el.setAttribute) el.setAttribute('aria-invalid', 'true');
    if (campo) {
      campo.classList.add('is-invalid');
      const span = campo.querySelector('.field-error');
      if (span) span.textContent = mensaje;
    }
  },

  limpiar(form) {
    form.querySelectorAll('.is-invalid').forEach(e => e.classList.remove('is-invalid'));
    form.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach(e => { e.textContent = ''; });
    const alerta = form.querySelector('.form-alert');
    if (alerta) alerta.textContent = '';
  },

  /** Pinta en el formulario los errores por campo que devuelve el backend ({ errores: { campo: msg } }). */
  mostrarErroresServidor(form, error) {
    let pintado = false;
    if (error && error.errores) {
      Object.entries(error.errores).forEach(([campo, mensaje]) => {
        const el = form.elements[campo];
        if (el) { Validar.marcarError(el.length && !el.tagName ? el[0] : el, mensaje); pintado = true; }
      });
    }
    const alerta = form.querySelector('.form-alert');
    if (alerta) alerta.textContent = (error && error.message) || 'No se pudo completar la operación.';
    else if (!pintado) UI.toast((error && error.message) || 'No se pudo completar la operación.', 'error');
  },

  /**
   * Filtro en vivo para campos marcados con data-solo-numeros:
   * bloquea letras al escribir/pegar y respeta maxlength (ej. teléfono = 10).
   */
  activarFiltros(raiz = document) {
    raiz.querySelectorAll('[data-solo-numeros]').forEach(input => {
      if (input.dataset.filtroActivo) return;
      input.dataset.filtroActivo = '1';
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', input.getAttribute('autocomplete') || 'off');
      input.addEventListener('beforeinput', e => {
        if (e.data && /\D/.test(e.data) && e.inputType && e.inputType.startsWith('insert')) {
          e.preventDefault();
          Validar.avisoNumerico(input);
        }
      });
      input.addEventListener('input', () => {
        let limpio = input.value.replace(/\D/g, '');
        if (input.maxLength > 0) limpio = limpio.slice(0, input.maxLength);
        if (limpio !== input.value) { input.value = limpio; Validar.avisoNumerico(input); }
      });
    });
  },

  avisoNumerico(input) {
    const campo = input.closest('.field');
    const span = campo && campo.querySelector('.field-error');
    if (!span) return;
    span.textContent = 'Solo se permiten números.';
    clearTimeout(input._avisoT);
    input._avisoT = setTimeout(() => { if (span.textContent === 'Solo se permiten números.') span.textContent = ''; }, 1800);
  },

  /** Contador de caracteres para textareas con data-contador="idDelSpan". */
  activarContadores(raiz = document) {
    raiz.querySelectorAll('textarea[data-contador]').forEach(t => {
      const span = document.getElementById(t.dataset.contador);
      if (!span || t.dataset.contadorActivo) return;
      t.dataset.contadorActivo = '1';
      const pintar = () => { span.textContent = `${t.value.trim().length} / ${t.maxLength > 0 ? t.maxLength : '∞'}`; };
      t.addEventListener('input', pintar);
      pintar();
    });
  },
};

/* ===================== 7. UTILIDADES DE INTERFAZ ===================== */

/* Iconos de trazo (24×24) usados en toda la app */
const ICONOS = {
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.3-4.3"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  star: '<path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.5l-5.8 3.1 1.1-6.4-4.7-4.6 6.5-.9z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  user: '<circle cx="12" cy="8" r="4.5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5.5 12 3c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7z"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  sparkles: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="M19 3v4M17 5h4"/>',
  hammer: '<path d="m15 12-8.5 8.5a2.1 2.1 0 1 1-3-3L12 9"/><path d="M17.6 15 22 10.6M20.9 11.7l-1.3-1.3c-.6-.6-.9-1.4-.9-2.2v-.9L16 4.6A5.6 5.6 0 0 0 12.1 3H9l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h2.5l2.3 1.9"/>',
  brush: '<path d="m9.1 11.9 8-8.1a2.9 2.9 0 1 1 4 4l-8 8.1"/><path d="M7.1 14.9c-1.7 0-3 1.4-3 3 0 1.4-2.5 1.6-2 2 1.1 1.1 2.5 2 4 2 2.2 0 4-1.8 4-4a3 3 0 0 0-3-3z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  truck: '<path d="M10 17h4V5H2v12h3M20 17h2v-3.3a1 1 0 0 0-.2-.6l-3.5-4.3a1 1 0 0 0-.8-.4H14v8.6"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

const UI = {
  icono(nombre, clase = '') {
    return `<svg class="icon ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
  },

  /** Reemplaza <i data-icono="nombre"></i> por su SVG. */
  hidratarIconos(raiz = document) {
    raiz.querySelectorAll('[data-icono]').forEach(el => {
      el.outerHTML = UI.icono(el.dataset.icono, el.className || '');
    });
  },

  /** Escapa texto antes de insertarlo como HTML (evita inyección de código). */
  esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  normalizarTexto(t) {
    return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  },

  moneda(valor) {
    return '$' + Math.round(Number(valor) || 0).toLocaleString('es-CO');
  },

  fecha(iso, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!iso) return '—';
    const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso);
    return isNaN(d) ? '—' : d.toLocaleDateString('es-CO', opciones);
  },

  fechaHora(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  },

  iniciales(nombre) {
    return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  },

  primerNombre(nombre) {
    return String(nombre || '').trim().split(/\s+/)[0] || '';
  },

  avatar(usuario, tamano = 'md', { redondo = false, tick = true } = {}) {
    const paleta = ['#1b4f8e', '#0f766e', '#b45309', '#7c3aed', '#be123c', '#0369a1', '#4d7c0f', '#9d174d'];
    const color = paleta[(Number(usuario && usuario.id) || 0) % paleta.length];
    const marca = tick && usuario && usuario.verificado && usuario.rol === 'TRABAJADOR'
      ? `<span class="avatar__tick" title="Verificado">${UI.icono('check')}</span>` : '';
    return `<span class="avatar avatar--${tamano}${redondo ? ' avatar--round' : ''}" style="--avatar-bg:${color}" aria-hidden="true">${UI.esc(UI.iniciales(usuario && usuario.nombre))}${marca}</span>`;
  },

  calificacion(valor, resenas) {
    const v = Number(valor) || 0;
    if (!resenas) return '<span class="rating"><small>Sin reseñas aún</small></span>';
    return `<span class="rating">${UI.icono('star')} ${v.toFixed(1)} <small>(${resenas} reseñas)</small></span>`;
  },

  badgeVerificado(usuario) {
    return usuario && usuario.verificado
      ? `<span class="badge badge-azul">${UI.icono('shield')} Verificado</span>`
      : '<span class="badge badge-gris">Sin verificar</span>';
  },

  /** Casillas tipo chip para seleccionar varios barrios. */
  chipsCheckbox(nombre, opciones, seleccion = []) {
    const elegidos = new Set(seleccion.map(s => s.trim()));
    return opciones.map(o => `
      <label class="chip-check"><input type="checkbox" name="${UI.esc(nombre)}" value="${UI.esc(o)}" ${elegidos.has(o) ? 'checked' : ''}><span>${UI.esc(o)}</span></label>`).join('');
  },

  opciones(lista, seleccionado, { vacio } = {}) {
    const items = Array.isArray(lista) ? lista.map(v => [v, v]) : Object.entries(lista);
    return (vacio ? `<option value="">${UI.esc(vacio)}</option>` : '') +
      items.map(([valor, texto]) => `<option value="${UI.esc(valor)}" ${String(valor) === String(seleccionado) ? 'selected' : ''}>${UI.esc(typeof texto === 'object' ? texto.nombre : texto)}</option>`).join('');
  },

  toast(mensaje, tipo = 'info') {
    let zona = document.querySelector('.toast-zone');
    if (!zona) {
      zona = document.createElement('div');
      zona.className = 'toast-zone';
      zona.setAttribute('role', 'status');
      zona.setAttribute('aria-live', 'polite');
      document.body.appendChild(zona);
    }
    const t = document.createElement('div');
    t.className = `toast toast--${tipo}`;
    t.innerHTML = `${UI.icono(tipo === 'error' ? 'alert' : tipo === 'exito' ? 'check' : 'info')}<span>${UI.esc(mensaje)}</span>`;
    zona.appendChild(t);
    setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 300); }, 3600);
  },

  /** Confirmación accesible con <dialog>. Devuelve una promesa con true / false. */
  confirmar(mensaje, { titulo = '¿Estás seguro?', aceptar = 'Confirmar', peligro = false } = {}) {
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal modal--confirm';
      dlg.innerHTML = `
        <div class="modal__body">
          <h2 class="modal__title">${UI.esc(titulo)}</h2>
          <p class="muted">${UI.esc(mensaje)}</p>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn-ghost" value="no">Cancelar</button>
          <button type="button" class="btn ${peligro ? 'btn-danger' : 'btn-primary'}" value="si">${UI.esc(aceptar)}</button>
        </div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', e => {
        const b = e.target.closest('button[value]');
        if (b) dlg.close(b.value);
        else if (e.target === dlg) dlg.close('no');
      });
      dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'si'); dlg.remove(); });
      dlg.showModal();
      dlg.querySelector('button[value="si"]').focus();
    });
  },

  abrirModal(id) {
    const dlg = document.getElementById(id);
    if (dlg && !dlg.open) dlg.showModal();
    return dlg;
  },

  cerrarModal(id) {
    const dlg = typeof id === 'string' ? document.getElementById(id) : id;
    if (dlg && dlg.open) dlg.close();
  },

  /** Muestra un spinner en el botón mientras dura la operación. */
  cargando(boton, activo) {
    if (!boton) return;
    boton.disabled = activo;
    boton.classList.toggle('is-loading', activo);
  },

  /** Indicador "API conectada / Modo local". Al pulsarlo se reintenta la conexión. */
  montarIndicadorConexion() {
    const badges = document.querySelectorAll('[data-conexion]');
    if (!badges.length) return;
    const textos = { online: 'API conectada', offline: 'Modo local', desconocido: 'Conectando…' };
    const titulos = {
      online: 'Datos servidos por el backend Spring Boot (localhost:8080).',
      offline: 'Backend no disponible: los datos se guardan en este navegador (localStorage). Pulsa para reintentar.',
      desconocido: 'Comprobando el backend…',
    };
    Conexion.alCambiar(modo => {
      badges.forEach(b => {
        b.textContent = textos[modo];
        b.title = titulos[modo];
        b.classList.toggle('is-online', modo === 'online');
        b.classList.toggle('is-offline', modo === 'offline');
      });
    });
    badges.forEach(b => {
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      const reintentar = () => {
        Conexion.reintentar();
        UI.toast('Reintentando conexión con el servidor…');
        document.dispatchEvent(new CustomEvent('cercapp:recargar'));
      };
      b.addEventListener('click', reintentar);
      b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reintentar(); } });
    });
  },
};

/* ===================== ARRANQUE COMÚN ===================== */
Store.inicializar();

document.addEventListener('DOMContentLoaded', () => {
  UI.hidratarIconos();
  UI.montarIndicadorConexion();
  Validar.activarFiltros();
  Validar.activarContadores();

  // Botones [data-cerrar-modal] cierran su <dialog>; clic en el fondo también cierra.
  document.addEventListener('click', e => {
    const boton = e.target.closest('[data-cerrar-modal]');
    if (boton) { const dlg = boton.closest('dialog'); if (dlg) dlg.close(); return; }
    if (e.target.tagName === 'DIALOG' && e.target.classList.contains('modal') && !e.target.classList.contains('modal--confirm')) {
      e.target.close();
    }
  });

  // Botones [data-salir] cierran la sesión
  document.querySelectorAll('[data-salir]').forEach(b => b.addEventListener('click', () => Sesion.cerrar()));
});
