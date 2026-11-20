/* =====================================================================
 * Ruta: cliente_portal.js
 * CercApp — Portal del CLIENTE
 * ---------------------------------------------------------------------
 *  - Catálogo de servicios del hogar con búsqueda y filtros en tiempo real
 *    (texto, categoría, barrio, tarifa máxima, calificación, verificados, orden)
 *  - Favoritos (agregar / quitar)
 *  - Perfil profesional y solicitud de servicio (CREATE)
 *  - Mis solicitudes: seguimiento, cancelación, calificación y eliminación
 *  - Mi perfil: edición de datos de contacto (UPDATE)
 * Todas las operaciones pasan por CercAPI (common.js), que usa la API REST
 * y cae automáticamente a localStorage si el backend está apagado.
 * ===================================================================== */
'use strict';

const sesion = Sesion.exigirRol('CLIENTE');

const estado = {
  usuario: sesion,
  servicios: [],            // catálogo PUBLICADO
  favoritos: new Set(),     // ids de servicios favoritos
  solicitudes: [],
  filtros: { q: '', categoria: null, barrio: null, precioMax: null, calificacionMin: 0, soloVerificados: false, orden: 'relevancia' },
  filtroSolicitudes: 'TODAS',
  profesionalAbierto: null, // id del trabajador cuyo perfil está abierto
  calificaciones: {},       // estrellas elegidas por solicitud antes de publicar
};

const $ = (sel) => document.querySelector(sel);

/* ===================== ARRANQUE ===================== */
if (sesion) {
  leerParametrosUrl();
  prepararFormularios();
  configurarEventos();
  pintarCabecera();
  cargarTodo();
}

/** ?q=texto&categoria=PLOMERIA (llegan desde la landing). */
function leerParametrosUrl() {
  const p = new URLSearchParams(location.search);
  if (p.get('q')) { estado.filtros.q = p.get('q'); $('#buscador').value = p.get('q'); }
  if (p.get('categoria') && CATEGORIAS[p.get('categoria')]) estado.filtros.categoria = p.get('categoria');
}

function prepararFormularios() {
  $('#perfil-barrio').innerHTML = UI.opciones(BARRIOS_NEIVA, '', { vacio: 'Selecciona tu barrio' });
  $('#sol-barrio').innerHTML = UI.opciones(BARRIOS_NEIVA, '', { vacio: 'Selecciona el barrio' });
  $('#sol-franja').innerHTML = UI.opciones(FRANJAS_HORARIAS, '', { vacio: 'Selecciona una franja' });
}

/** Carga en paralelo: perfil actualizado, catálogo, favoritos y solicitudes. */
async function cargarTodo() {
  try {
    const [usuario, servicios, favoritos, solicitudes] = await Promise.all([
      CercAPI.usuarios.obtener(sesion.id),
      CercAPI.servicios.listar({ estado: 'PUBLICADO' }),
      CercAPI.favoritos.listar(sesion.id),
      CercAPI.solicitudes.listar({ clienteId: sesion.id }),
    ]);
    if (usuario.estado === 'SUSPENDIDO') {
      UI.toast('Tu cuenta fue suspendida por el administrador.', 'error');
      setTimeout(() => Sesion.cerrar(), 1500);
      return;
    }
    estado.usuario = usuario;
    Sesion.iniciar(usuario);
    // Solo se muestran servicios de trabajadores activos
    estado.servicios = servicios.filter(s => s.trabajador && s.trabajador.estado !== 'SUSPENDIDO');
    estado.favoritos = new Set(favoritos.map(s => s.id));
    estado.solicitudes = solicitudes;
    pintarCabecera();
    pintarTodo();
  } catch (err) {
    if (err.estado === 404) { Sesion.cerrar(); return; }
    UI.toast(err.message, 'error');
  }
}

function pintarTodo() {
  pintarCategorias();
  pintarBarrios();
  pintarServicios();
  pintarEnCurso();
  pintarFavoritos();
  pintarSolicitudes();
  pintarPerfil();
  pintarContadores();
}

/* ===================== NAVEGACIÓN ENTRE VISTAS ===================== */
function mostrarVista(vista) {
  document.querySelectorAll('.app-tab').forEach(t => {
    const activa = t.dataset.vista === vista;
    t.classList.toggle('is-active', activa);
    if (activa) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== `vista-${vista}`; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pintarCabecera() {
  const u = estado.usuario;
  $('#saludo').textContent = `¡Hola, ${UI.primerNombre(u.nombre)}!`;
  $('#btn-avatar').innerHTML = UI.avatar(u, 'sm', { redondo: true });
}

function pintarContadores() {
  $('#cuenta-favoritos').textContent = estado.favoritos.size || '';
  const activas = estado.solicitudes.filter(s => !['COMPLETADA', 'CANCELADA'].includes(s.estado)).length;
  $('#cuenta-solicitudes').textContent = activas || '';
}

/* ===================== CATÁLOGO: FILTROS EN TIEMPO REAL ===================== */

function pintarCategorias() {
  const cuenta = estado.servicios.reduce((m, s) => (m[s.categoria] = (m[s.categoria] || 0) + 1, m), {});
  $('#grid-categorias').innerHTML = Object.entries(CATEGORIAS).map(([clave, c]) => `
    <button type="button" class="cat-card ${estado.filtros.categoria === clave ? 'is-active' : ''}" data-cat="${clave}" aria-pressed="${estado.filtros.categoria === clave}">
      <span class="cat-card__icon">${UI.icono(c.icono)}</span>
      <strong>${UI.esc(c.nombre)}</strong>
      <small>${cuenta[clave] || 0} ${(cuenta[clave] || 0) === 1 ? "servicio" : "servicios"}</small>
    </button>`).join('');
}

function pintarBarrios() {
  const chips = [['', 'Todos los barrios'], ...BARRIOS_NEIVA.map(b => [b, b])];
  $('#chips-barrios').innerHTML = chips.map(([valor, texto]) => `
    <button type="button" class="chip ${(estado.filtros.barrio || '') === valor ? 'is-active' : ''}" data-barrio="${UI.esc(valor)}">${UI.esc(texto)}</button>`).join('');
}

/** Aplica todos los filtros activos sobre el catálogo cargado en memoria. */
function serviciosFiltrados() {
  const f = estado.filtros;
  const palabras = UI.normalizarTexto(f.q).split(/\s+/).filter(Boolean);
  const lista = estado.servicios.filter(s => {
    if (f.categoria && s.categoria !== f.categoria) return false;
    if (f.barrio && !s.zonaCobertura.split(',').map(z => z.trim()).includes(f.barrio)) return false;
    if (f.precioMax && Number(s.tarifa) > f.precioMax) return false;
    if (f.calificacionMin && Number(s.calificacion) < f.calificacionMin) return false;
    if (f.soloVerificados && !s.trabajador.verificado) return false;
    if (palabras.length) {
      const texto = UI.normalizarTexto([
        s.titulo, s.descripcion, CATEGORIAS[s.categoria].nombre, s.trabajador.nombre, s.trabajador.especialidad, s.zonaCobertura,
      ].join(' '));
      return palabras.every(p => texto.includes(p));
    }
    return true;
  });

  const ordenes = {
    relevancia: (a, b) => (b.trabajador.verificado - a.trabajador.verificado) || (b.calificacion - a.calificacion) || (b.numResenas - a.numResenas),
    calificacion: (a, b) => (b.calificacion - a.calificacion) || (b.numResenas - a.numResenas),
    'precio-asc': (a, b) => a.tarifa - b.tarifa,
    'precio-desc': (a, b) => b.tarifa - a.tarifa,
    resenas: (a, b) => b.numResenas - a.numResenas,
  };
  return lista.sort(ordenes[f.orden] || ordenes.relevancia);
}

function pintarServicios() {
  const lista = serviciosFiltrados();
  const f = estado.filtros;
  const hayFiltros = f.q || f.categoria || f.barrio || f.precioMax || f.calificacionMin || f.soloVerificados;

  $('#titulo-resultados').textContent = f.categoria
    ? `${CATEGORIAS[f.categoria].nombre} en Neiva`
    : (hayFiltros ? 'Resultados de tu búsqueda' : 'Profesionales destacados');
  $('#conteo-resultados').textContent = `${lista.length} ${lista.length === 1 ? 'servicio disponible' : 'servicios disponibles'}${f.barrio ? ` en ${f.barrio}` : ' en tu perímetro'}`;

  pintarFiltrosActivos();

  $('#lista-servicios').innerHTML = lista.length
    ? lista.map(tarjetaServicio).join('')
    : `<div class="empty-state" style="grid-column:1/-1">
         ${UI.icono('search')}
         <h3>No encontramos servicios con esos filtros</h3>
         <p>Prueba con otra palabra, otro barrio o una tarifa mayor.</p>
         <button type="button" class="btn btn-outline btn-sm" data-accion="limpiar">Limpiar filtros</button>
       </div>`;
}

/** Etiquetas removibles con los filtros aplicados. */
function pintarFiltrosActivos() {
  const f = estado.filtros;
  const etiquetas = [];
  if (f.q) etiquetas.push(['q', `“${f.q}”`]);
  if (f.categoria) etiquetas.push(['categoria', CATEGORIAS[f.categoria].nombre]);
  if (f.barrio) etiquetas.push(['barrio', f.barrio]);
  if (f.precioMax) etiquetas.push(['precioMax', `Hasta ${UI.moneda(f.precioMax)}`]);
  if (f.calificacionMin) etiquetas.push(['calificacionMin', `${f.calificacionMin}+ ★`]);
  if (f.soloVerificados) etiquetas.push(['soloVerificados', 'Verificados']);
  $('#filtros-activos').innerHTML = etiquetas.map(([clave, texto]) =>
    `<button type="button" class="chip" data-quitar-filtro="${clave}" aria-label="Quitar filtro ${UI.esc(texto)}">${UI.esc(texto)} ${UI.icono('x')}</button>`).join('');
}

/** Tarjeta de servicio (estilo "Profesionales destacados" de las maquetas). */
function tarjetaServicio(s) {
  const t = s.trabajador;
  const fav = estado.favoritos.has(s.id);
  const barrioPrincipal = s.zonaCobertura.split(',')[0].trim();
  return `
    <article class="card pro-card" data-servicio="${s.id}">
      <div class="pro-card__top">
        ${UI.avatar(t, 'lg')}
        <div class="pro-card__info">
          <div class="pro-card__name-row">
            <h3>${UI.esc(t.nombre)}</h3>
            ${t.verificado ? `<span class="badge badge-azul">${UI.icono('shield')} Verificado</span>` : ''}
          </div>
          <p class="pro-card__title">${UI.esc(s.titulo)}</p>
          <div class="pro-card__meta">
            ${UI.calificacion(s.calificacion, s.numResenas)}
            <span>${UI.icono('pin')} ${UI.esc(barrioPrincipal)}</span>
            <span>${UI.icono(CATEGORIAS[s.categoria].icono)} ${UI.esc(CATEGORIAS[s.categoria].nombre)}</span>
          </div>
        </div>
        <button type="button" class="fav-btn ${fav ? 'is-active' : ''}" data-accion="favorito" aria-pressed="${fav}"
                aria-label="${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">${UI.icono('heart')}</button>
      </div>
      <p class="pro-card__desc">${UI.esc(s.descripcion)}</p>
      <div class="pro-card__footer">
        <div class="price">
          <small>Tarifa base ${UNIDADES_TARIFA[s.unidadTarifa]}</small>
          <strong>${UI.moneda(s.tarifa)}<span>COP</span></strong>
        </div>
        <div class="pro-card__actions">
          <button type="button" class="btn btn-outline btn-sm" data-accion="ver-perfil">Ver perfil</button>
          <button type="button" class="btn btn-accent btn-sm" data-accion="solicitar">${UI.icono('calendar', 'icon-sm')} Solicitar</button>
        </div>
      </div>
    </article>`;
}

/** Lee el panel de filtros avanzados (con validación numérica estricta de la tarifa). */
function leerPanelFiltros() {
  const form = $('#panel-filtros');
  const precio = form.precioMax.value.trim();
  Validar.limpiar(form);
  if (precio && Validar.entero(1000, 10000000, 'La tarifa máxima')(precio)) {
    Validar.marcarError(form.precioMax, Validar.entero(1000, 10000000, 'La tarifa máxima')(precio));
    estado.filtros.precioMax = null;
  } else {
    estado.filtros.precioMax = precio ? Number(precio) : null;
  }
  estado.filtros.calificacionMin = Number(form.calificacionMin.value) || 0;
  estado.filtros.orden = form.orden.value;
  estado.filtros.soloVerificados = form.soloVerificados.checked;
  pintarServicios();
}

function limpiarFiltros() {
  estado.filtros = { q: '', categoria: null, barrio: null, precioMax: null, calificacionMin: 0, soloVerificados: false, orden: 'relevancia' };
  $('#buscador').value = '';
  const form = $('#panel-filtros');
  form.reset();
  Validar.limpiar(form);
  history.replaceState(null, '', location.pathname);
  pintarCategorias();
  pintarBarrios();
  pintarServicios();
}

/* ===================== FAVORITOS ===================== */

async function alternarFavorito(servicioId, boton) {
  const esFavorito = estado.favoritos.has(servicioId);
  // Actualización optimista: se pinta de inmediato y se revierte si falla
  esFavorito ? estado.favoritos.delete(servicioId) : estado.favoritos.add(servicioId);
  refrescarBotonesFavorito(servicioId);
  if (boton) boton.disabled = true;
  try {
    const lista = esFavorito
      ? await CercAPI.favoritos.quitar(estado.usuario.id, servicioId)
      : await CercAPI.favoritos.agregar(estado.usuario.id, servicioId);
    estado.favoritos = new Set(lista.map(s => s.id));
    UI.toast(esFavorito ? 'Quitado de favoritos.' : 'Guardado en favoritos.', 'exito');
  } catch (err) {
    esFavorito ? estado.favoritos.add(servicioId) : estado.favoritos.delete(servicioId);
    UI.toast(err.message, 'error');
  } finally {
    if (boton) boton.disabled = false;
    refrescarBotonesFavorito(servicioId);
    pintarFavoritos();
    pintarContadores();
  }
}

function refrescarBotonesFavorito(servicioId) {
  const activo = estado.favoritos.has(servicioId);
  document.querySelectorAll(`[data-servicio="${servicioId}"] [data-accion="favorito"]`).forEach(b => {
    b.classList.toggle('is-active', activo);
    b.setAttribute('aria-pressed', activo);
    b.setAttribute('aria-label', activo ? 'Quitar de favoritos' : 'Agregar a favoritos');
  });
}

function pintarFavoritos() {
  const lista = estado.servicios.filter(s => estado.favoritos.has(s.id));
  $('#lista-favoritos').innerHTML = lista.length
    ? lista.map(tarjetaServicio).join('')
    : `<div class="empty-state" style="grid-column:1/-1">
         ${UI.icono('heart')}
         <h3>Aún no tienes favoritos</h3>
         <p>Toca el corazón en cualquier servicio para guardarlo aquí.</p>
         <button type="button" class="btn btn-primary btn-sm" data-ir="explorar">Explorar servicios</button>
       </div>`;
}

/* ===================== PERFIL PROFESIONAL ===================== */

function abrirPerfilProfesional(trabajadorId) {
  const servicios = estado.servicios.filter(s => s.trabajador.id === trabajadorId);
  if (!servicios.length) return;
  const t = servicios[0].trabajador;
  estado.profesionalAbierto = trabajadorId;

  const totalResenas = servicios.reduce((a, s) => a + Number(s.numResenas || 0), 0);
  const promedio = totalResenas
    ? servicios.reduce((a, s) => a + Number(s.calificacion) * Number(s.numResenas || 0), 0) / totalResenas : 0;
  const zonas = [...new Set(servicios.flatMap(s => s.zonaCobertura.split(',').map(z => z.trim())))];

  $('#contenido-profesional').innerHTML = `
    <div class="profile-hero">
      ${UI.avatar(t, 'xl')}
      <span class="badge badge-verde">● DISPONIBLE</span>
      <h2>${UI.esc(t.nombre)}</h2>
      <p class="muted">${UI.esc(t.especialidad || CATEGORIAS[servicios[0].categoria].nombre)}</p>
      ${t.verificado ? `<span class="badge badge-azul">${UI.icono('shield')} Cédula y antecedentes verificados</span>` : '<span class="badge badge-gris">Verificación en proceso</span>'}
    </div>
    <div class="stat-row">
      <div class="stat"><strong>${promedio ? promedio.toFixed(1) : '—'}</strong><span>${totalResenas} reseñas</span></div>
      <div class="stat"><strong>${servicios.length}</strong><span>servicios</span></div>
      <div class="stat"><strong>${t.aniosExperiencia ?? '—'}</strong><span>años de experiencia</span></div>
    </div>
    <div class="card card-pad stack-sm">
      <h3 class="row" style="gap:6px">${UI.icono('pin')} Zona de cobertura en Neiva</h3>
      <div class="chip-row chip-row--wrap">${zonas.map(z => `<span class="badge badge-gris">${UI.esc(z)}</span>`).join('')}</div>
    </div>
    <div class="card card-pad stack-sm">
      <h3>Sobre ${UI.esc(UI.primerNombre(t.nombre))}</h3>
      <p class="muted text-sm">${UI.esc(t.especialidad || 'Profesional de servicios del hogar')} con ${t.aniosExperiencia ?? 'varios'} años de experiencia, con base en el barrio ${UI.esc(t.barrio || 'Neiva')}. Atiende en ${zonas.length} barrios de la ciudad.</p>
    </div>
    <div>
      <div class="row-between"><h3>Servicios y tarifas</h3><span class="subtle">COP</span></div>
      <div class="mt-2">
        ${servicios.map(s => `
          <div class="service-line">
            <span class="service-line__icon">${UI.icono(CATEGORIAS[s.categoria].icono)}</span>
            <div class="grow">
              <strong>${UI.esc(s.titulo)}</strong>
              <small>${UI.esc(s.disponibilidad)}</small>
            </div>
            <div class="service-line__price">
              <small>Desde</small>
              <strong>${UI.moneda(s.tarifa)}</strong>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  $('#btn-solicitar-desde-perfil').innerHTML = `${UI.icono('calendar')} Solicitar servicio a ${UI.esc(UI.primerNombre(t.nombre))}`;
  UI.abrirModal('modal-profesional');
}

/* ===================== SOLICITAR SERVICIO (CREATE) ===================== */

function abrirSolicitud(servicioId) {
  const servicio = estado.servicios.find(s => s.id === servicioId);
  if (!servicio) return;
  const t = servicio.trabajador;
  const delTrabajador = estado.servicios.filter(s => s.trabajador.id === t.id);
  const form = $('#form-solicitud');
  form.reset();
  Validar.limpiar(form);

  $('#solicitud-profesional').innerHTML = `
    ${UI.avatar(t, 'md')}
    <div class="grow">
      <span class="label-caps" style="color:var(--c-navy-600)">Para tu solicitud</span>
      <strong style="display:block">${UI.esc(t.nombre)}</strong>
      <span class="subtle">${UI.esc(t.especialidad || '')}</span>
    </div>
    ${UI.calificacion(servicio.calificacion, servicio.numResenas)}`;

  form.servicioId.innerHTML = delTrabajador.map(s =>
    `<option value="${s.id}" ${s.id === servicioId ? 'selected' : ''}>${UI.esc(s.titulo)} (desde ${UI.moneda(s.tarifa)})</option>`).join('');
  form.fechaPreferida.min = hoyISO();
  form.fechaPreferida.value = hoyISO();
  form.direccion.value = estado.usuario.direccion || '';
  form.barrio.value = estado.usuario.barrio || '';
  form.descripcion.dispatchEvent(new Event('input'));
  pintarCotizacion();
  UI.cerrarModal('modal-profesional');
  UI.abrirModal('modal-solicitar');
}

function pintarCotizacion() {
  const form = $('#form-solicitud');
  const s = estado.servicios.find(x => x.id === Number(form.servicioId.value));
  if (!s) return;
  const barrio = form.barrio.value;
  const cubierto = barrio && s.zonaCobertura.split(',').map(z => z.trim()).includes(barrio);
  $('#cotizacion').innerHTML = `
    <div class="row-between"><strong class="row" style="gap:6px">${UI.icono('clipboard')} Cotización estimada</strong><span class="badge badge-azul">Transparente</span></div>
    <div class="quote-line mt-2"><span>Diagnóstico y mano de obra base (${UNIDADES_TARIFA[s.unidadTarifa]})</span><strong>${UI.moneda(s.tarifa)} COP</strong></div>
    <div class="quote-line"><span>Desplazamiento local${barrio ? ` (${UI.esc(barrio)})` : ''}</span>
      <strong style="color:${cubierto || !barrio ? 'var(--c-navy-600)' : 'var(--c-amber-700)'}">${!barrio ? 'Según barrio' : cubierto ? 'Incluido' : 'Fuera de cobertura: se acuerda'}</strong></div>
    <div class="quote-note">${UI.icono('info', 'icon-sm')} El precio final se acuerda tras la inspección física. Sin cobros ocultos ni anticipos obligatorios.</div>`;
}

async function enviarSolicitud(e) {
  e.preventDefault();
  const form = e.target;
  const datos = Validar.formulario(form, {
    servicioId: [Validar.requerido],
    descripcion: [Validar.requerido, Validar.minLargo(20), Validar.maxLargo(1000)],
    fechaPreferida: [Validar.requerido, Validar.fechaNoPasada],
    franjaHoraria: [Validar.requerido, Validar.enLista(FRANJAS_HORARIAS)],
    direccion: [Validar.requerido, Validar.minLargo(5)],
    barrio: [Validar.requerido, Validar.enLista(BARRIOS_NEIVA)],
  });
  if (!datos) return;
  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    await CercAPI.solicitudes.crear({
      cliente: { id: estado.usuario.id },
      servicio: { id: Number(datos.servicioId) },
      descripcion: datos.descripcion,
      fechaPreferida: datos.fechaPreferida,
      franjaHoraria: datos.franjaHoraria,
      direccion: datos.direccion,
      barrio: datos.barrio,
    });
    UI.cerrarModal('modal-solicitar');
    UI.toast('¡Solicitud enviada! El profesional la confirmará pronto.', 'exito');
    await recargarSolicitudes();
    estado.filtroSolicitudes = 'TODAS';
    mostrarVista('solicitudes');
  } catch (err) {
    Validar.mostrarErroresServidor(form, err);
  } finally {
    UI.cargando(boton, false);
  }
}

/* ===================== MIS SOLICITUDES ===================== */

async function recargarSolicitudes() {
  estado.solicitudes = await CercAPI.solicitudes.listar({ clienteId: estado.usuario.id });
  pintarSolicitudes();
  pintarEnCurso();
  pintarContadores();
}

/** Tarjeta "En camino / En proceso" del inicio, como en la maqueta. */
function pintarEnCurso() {
  const activa = estado.solicitudes.find(s => ['ACEPTADA', 'EN_CAMINO', 'EN_EJECUCION'].includes(s.estado));
  const caja = $('#tarjeta-en-curso');
  if (!activa) { caja.hidden = true; return; }
  caja.hidden = false;
  caja.innerHTML = `
    <span class="live-card__icon">${UI.icono(activa.estado === 'EN_CAMINO' ? 'truck' : 'wrench')}</span>
    <div class="grow">
      <span class="live-card__label">${UI.esc(ESTADOS_SOLICITUD[activa.estado].corto.toUpperCase())}</span>
      <strong>${UI.esc(activa.servicio.titulo)}</strong>
      <span class="subtle">${UI.esc(activa.servicio.trabajador.nombre)} · ${UI.fecha(activa.fechaPreferida)} · ${UI.esc(activa.franjaHoraria)}</span>
    </div>
    <button type="button" class="btn btn-soft btn-sm" data-ir="solicitudes">Rastrear</button>`;
}

function solicitudesFiltradas() {
  const grupos = {
    TODAS: () => true,
    PENDIENTES: s => s.estado === 'PENDIENTE',
    EN_PROCESO: s => ['ACEPTADA', 'EN_CAMINO', 'EN_EJECUCION'].includes(s.estado),
    COMPLETADAS: s => s.estado === 'COMPLETADA',
    CANCELADAS: s => s.estado === 'CANCELADA',
  };
  return estado.solicitudes.filter(grupos[estado.filtroSolicitudes]);
}

function pintarSolicitudes() {
  document.querySelectorAll('#filtro-solicitudes button').forEach(b =>
    b.classList.toggle('is-active', b.dataset.filtro === estado.filtroSolicitudes));
  const lista = solicitudesFiltradas();
  $('#lista-solicitudes').innerHTML = lista.length
    ? lista.map(tarjetaSolicitud).join('')
    : `<div class="empty-state" style="grid-column:1/-1">
         ${UI.icono('clipboard')}
         <h3>No hay solicitudes en esta sección</h3>
         <p>Cuando solicites un servicio podrás seguir su estado aquí.</p>
         <button type="button" class="btn btn-primary btn-sm" data-ir="explorar">Buscar un servicio</button>
       </div>`;
}

function lineaDeTiempo(s) {
  const actual = FLUJO_SOLICITUD.indexOf(s.estado);
  return `<ol class="timeline">${FLUJO_SOLICITUD.map((paso, i) => {
    const clase = i < actual || s.estado === 'COMPLETADA' ? 'is-done' : i === actual ? 'is-current' : '';
    const detalle = i === 0 ? UI.fechaHora(s.fechaCreacion)
      : i === actual && s.estado !== 'COMPLETADA' ? 'Estado actual'
      : paso === 'COMPLETADA' ? (s.estado === 'COMPLETADA' ? (s.calificacion ? 'Calificado' : 'Pendiente de tu calificación') : 'Pendiente de firma y revisión final')
      : '';
    return `<li class="timeline__item ${clase}">
      <span class="timeline__dot">${clase === 'is-done' ? UI.icono('check') : ''}</span>
      <div class="timeline__text"><strong>${UI.esc(ESTADOS_SOLICITUD[paso].paso)}</strong>${detalle ? `<span>${UI.esc(detalle)}</span>` : ''}</div>
    </li>`;
  }).join('')}</ol>`;
}

function tarjetaSolicitud(s) {
  const info = ESTADOS_SOLICITUD[s.estado];
  const t = s.servicio.trabajador || {};
  const paso = FLUJO_SOLICITUD.indexOf(s.estado) + 1;
  const puedeCancelar = ['PENDIENTE', 'ACEPTADA'].includes(s.estado);
  const finalizada = ['COMPLETADA', 'CANCELADA'].includes(s.estado);

  let bloqueFinal = '';
  if (s.estado === 'COMPLETADA' && !s.calificacion) {
    const elegidas = estado.calificaciones[s.id] || 0;
    bloqueFinal = `
      <form class="rating-box" data-calificar="${s.id}" novalidate>
        <div>
          <strong>Califica el servicio</strong>
          <p class="subtle">¿Cómo fue la atención de ${UI.esc(UI.primerNombre(t.nombre))}? Deja tu reseña.</p>
        </div>
        <div class="rating-input" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${n === elegidas}" aria-label="${n} estrella${n > 1 ? 's' : ''}" data-estrella="${n}" class="${n <= elegidas ? 'is-on' : ''}">${UI.icono('star')}</button>`).join('')}
        </div>
        <div class="field">
          <label class="sr-only" for="comentario-${s.id}">Comentario</label>
          <textarea class="input" id="comentario-${s.id}" name="comentario" maxlength="500" rows="2" style="min-height:70px" placeholder="Escribe un comentario opcional sobre el trabajo"></textarea>
          <span class="field-error"></span>
        </div>
        <button type="submit" class="btn btn-accent btn-block">${UI.icono('send', 'icon-sm')} Publicar calificación</button>
      </form>`;
  } else if (s.estado === 'COMPLETADA') {
    bloqueFinal = `
      <div class="rating-box">
        <div class="row-between"><strong>Tu calificación</strong><span class="stars">${[1, 2, 3, 4, 5].map(n => UI.icono('star', n <= s.calificacion ? 'is-fill' : '')).join('')}</span></div>
        ${s.comentario ? `<p class="muted text-sm">“${UI.esc(s.comentario)}”</p>` : ''}
      </div>`;
  }

  return `
    <article class="card order-card" data-solicitud="${s.id}">
      <div class="order-card__head">
        <div>
          <div class="row wrap" style="gap:6px">
            <span class="badge ${info.clase}">${UI.esc(info.corto)}</span>
            <span class="subtle">${UI.fecha(s.fechaPreferida, { weekday: 'short', day: 'numeric', month: 'short' })} · ${UI.esc(s.franjaHoraria)}</span>
          </div>
          <h3>${UI.esc(s.servicio.titulo)}</h3>
        </div>
        <span class="live-card__icon">${UI.icono(CATEGORIAS[s.servicio.categoria] ? CATEGORIAS[s.servicio.categoria].icono : 'wrench')}</span>
      </div>

      <div class="order-card__who">
        ${UI.avatar(t, 'md')}
        <div class="grow">
          <strong>${UI.esc(t.nombre || 'Profesional')}</strong>
          <span>${UI.esc(t.especialidad || '')}</span>
        </div>
        <div style="text-align:right">
          <span class="subtle">Barrio</span>
          <strong style="display:block;font-size:var(--fs-sm)">${UI.esc(s.barrio || '—')}</strong>
        </div>
      </div>

      <p class="order-card__detail">${UI.esc(s.descripcion)}</p>

      ${s.estado === 'CANCELADA'
        ? '<div class="notice notice--rojo">' + UI.icono('ban') + ' Esta solicitud fue cancelada.</div>'
        : `<div><div class="row-between" style="margin-bottom:10px"><span class="fw-bold text-sm">Seguimiento en vivo</span><span class="subtle">Paso ${paso} de ${FLUJO_SOLICITUD.length}</span></div>${lineaDeTiempo(s)}</div>`}

      ${bloqueFinal}

      <div class="order-card__actions">
        ${!finalizada && t.telefono ? `<a class="btn btn-outline" href="tel:${UI.esc(t.telefono)}">${UI.icono('phone', 'icon-sm')} Llamar</a>` : ''}
        ${puedeCancelar ? `<button type="button" class="btn btn-ghost" data-accion="cancelar">${UI.icono('x', 'icon-sm')} Cancelar</button>` : ''}
        ${finalizada ? `<button type="button" class="btn btn-ghost" data-accion="eliminar-solicitud">${UI.icono('trash', 'icon-sm')} Quitar del historial</button>` : ''}
        ${finalizada && estado.servicios.some(x => x.id === s.servicio.id) ? `<button type="button" class="btn btn-primary" data-accion="repetir">${UI.icono('refresh', 'icon-sm')} Volver a solicitar</button>` : ''}
      </div>
    </article>`;
}

async function cancelarSolicitud(id) {
  const s = estado.solicitudes.find(x => x.id === id);
  if (!s) return;
  const ok = await UI.confirmar('El profesional será notificado de la cancelación.', { titulo: '¿Cancelar esta solicitud?', aceptar: 'Sí, cancelar', peligro: true });
  if (!ok) return;
  try {
    await CercAPI.solicitudes.actualizar(id, cuerpoSolicitud(s, { estado: 'CANCELADA' }));
    UI.toast('Solicitud cancelada.', 'exito');
    await recargarSolicitudes();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function eliminarSolicitud(id) {
  const ok = await UI.confirmar('Se eliminará del historial de forma permanente.', { titulo: '¿Quitar del historial?', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  try {
    await CercAPI.solicitudes.eliminar(id);
    UI.toast('Solicitud eliminada del historial.', 'exito');
    await recargarSolicitudes();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

async function publicarCalificacion(form) {
  const id = Number(form.dataset.calificar);
  const s = estado.solicitudes.find(x => x.id === id);
  const estrellas = estado.calificaciones[id] || 0;
  Validar.limpiar(form);
  if (!estrellas) { UI.toast('Selecciona de 1 a 5 estrellas.', 'error'); return; }
  const comentario = form.comentario.value.trim();
  if (comentario.length > 500) { Validar.marcarError(form.comentario, 'Máximo 500 caracteres.'); return; }
  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    await CercAPI.solicitudes.actualizar(id, cuerpoSolicitud(s, { calificacion: estrellas, comentario: comentario || null }));
    delete estado.calificaciones[id];
    UI.toast('¡Gracias! Tu calificación fue publicada.', 'exito');
    // La calificación cambia el promedio del servicio: se recarga el catálogo
    estado.servicios = (await CercAPI.servicios.listar({ estado: 'PUBLICADO' })).filter(x => x.trabajador.estado !== 'SUSPENDIDO');
    await recargarSolicitudes();
    pintarServicios();
  } catch (err) {
    UI.toast(err.message, 'error');
    UI.cargando(boton, false);
  }
}

/* ===================== MI PERFIL (UPDATE) ===================== */

function pintarPerfil() {
  const u = estado.usuario;
  $('#perfil-resumen').innerHTML = `
    ${UI.avatar(u, 'lg', { redondo: true })}
    <div class="grow">
      <strong style="display:block;font-size:var(--fs-lg)">${UI.esc(u.nombre)}</strong>
      <span class="subtle">Cliente desde ${UI.fecha(u.fechaRegistro, { month: 'long', year: 'numeric' })} · ${estado.solicitudes.length} solicitudes</span>
    </div>`;
  const form = $('#form-perfil');
  form.nombre.value = u.nombre || '';
  form.email.value = u.email || '';
  form.telefono.value = u.telefono || '';
  form.barrio.value = u.barrio || '';
  form.direccion.value = u.direccion || '';
  form.password.value = '';
}

async function guardarPerfil(e) {
  e.preventDefault();
  const form = e.target;
  const datos = Validar.formulario(form, {
    nombre: [Validar.requerido, Validar.minLargo(3), Validar.soloLetras],
    email: [Validar.requerido, Validar.email],
    telefono: [Validar.requerido, Validar.telefono],
    barrio: [Validar.requerido, Validar.enLista(BARRIOS_NEIVA)],
    direccion: [Validar.requerido, Validar.minLargo(5)],
    password: [Validar.opcional(Validar.minLargo(6))],
  });
  if (!datos) return;
  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    const cuerpo = cuerpoUsuario(estado.usuario, {
      nombre: datos.nombre, email: datos.email, telefono: datos.telefono, barrio: datos.barrio, direccion: datos.direccion,
    });
    if (datos.password) cuerpo.password = datos.password;
    estado.usuario = await CercAPI.usuarios.actualizar(estado.usuario.id, cuerpo);
    Sesion.iniciar(estado.usuario);
    pintarCabecera();
    pintarPerfil();
    UI.toast('Perfil actualizado.', 'exito');
  } catch (err) {
    Validar.mostrarErroresServidor(form, err);
  } finally {
    UI.cargando(boton, false);
  }
}

/* ===================== EVENTOS ===================== */

function configurarEventos() {
  // Pestañas
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-vista]');
    if (b) mostrarVista(b.dataset.vista);
  });
  $('#btn-avatar').addEventListener('click', () => mostrarVista('perfil'));

  // Búsqueda en tiempo real
  $('#buscador').addEventListener('input', e => {
    estado.filtros.q = e.target.value.trim();
    pintarServicios();
  });

  // Panel de filtros
  $('#btn-filtros').addEventListener('click', () => {
    const panel = $('#panel-filtros');
    panel.hidden = !panel.hidden;
    $('#btn-filtros').setAttribute('aria-expanded', !panel.hidden);
    $('#btn-filtros').classList.toggle('is-active', !panel.hidden);
  });
  $('#panel-filtros').addEventListener('input', leerPanelFiltros);
  $('#panel-filtros').addEventListener('change', leerPanelFiltros);
  $('#panel-filtros').addEventListener('submit', e => e.preventDefault());
  $('#btn-limpiar-filtros').addEventListener('click', limpiarFiltros);

  // Categorías y barrios
  $('#grid-categorias').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    estado.filtros.categoria = estado.filtros.categoria === b.dataset.cat ? null : b.dataset.cat;
    pintarCategorias();
    pintarServicios();
  });
  $('#btn-todas-categorias').addEventListener('click', () => {
    estado.filtros.categoria = null;
    pintarCategorias();
    pintarServicios();
  });
  $('#chips-barrios').addEventListener('click', e => {
    const b = e.target.closest('[data-barrio]');
    if (!b) return;
    estado.filtros.barrio = b.dataset.barrio || null;
    pintarBarrios();
    pintarServicios();
  });
  $('#filtros-activos').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-filtro]');
    if (!b) return;
    const clave = b.dataset.quitarFiltro;
    const form = $('#panel-filtros');
    if (clave === 'q') $('#buscador').value = '';
    if (clave === 'precioMax') form.precioMax.value = '';
    if (clave === 'calificacionMin') form.calificacionMin.value = '0';
    if (clave === 'soloVerificados') form.soloVerificados.checked = false;
    estado.filtros[clave] = clave === 'calificacionMin' ? 0 : (clave === 'soloVerificados' ? false : (clave === 'q' ? '' : null));
    pintarCategorias();
    pintarBarrios();
    pintarServicios();
  });

  // Acciones dentro de las tarjetas de servicio (catálogo y favoritos)
  const accionesServicio = e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    if (accion.dataset.accion === 'limpiar') { limpiarFiltros(); return; }
    const tarjeta = accion.closest('[data-servicio]');
    if (!tarjeta) return;
    const id = Number(tarjeta.dataset.servicio);
    const servicio = estado.servicios.find(s => s.id === id);
    if (accion.dataset.accion === 'favorito') alternarFavorito(id, accion);
    if (accion.dataset.accion === 'ver-perfil' && servicio) abrirPerfilProfesional(servicio.trabajador.id);
    if (accion.dataset.accion === 'solicitar') abrirSolicitud(id);
  };
  $('#lista-servicios').addEventListener('click', accionesServicio);
  $('#lista-favoritos').addEventListener('click', accionesServicio);

  // Enlaces internos [data-ir="vista"]
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (b) mostrarVista(b.dataset.ir);
  });

  // Perfil profesional → solicitar
  $('#btn-solicitar-desde-perfil').addEventListener('click', () => {
    const primero = estado.servicios.find(s => s.trabajador.id === estado.profesionalAbierto);
    if (primero) abrirSolicitud(primero.id);
  });

  // Formulario de solicitud
  const formSolicitud = $('#form-solicitud');
  formSolicitud.addEventListener('submit', enviarSolicitud);
  formSolicitud.servicioId.addEventListener('change', pintarCotizacion);
  formSolicitud.barrio.addEventListener('change', pintarCotizacion);

  // Mis solicitudes: filtros, estrellas, calificar, cancelar, eliminar, repetir
  $('#filtro-solicitudes').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtroSolicitudes = b.dataset.filtro;
    pintarSolicitudes();
  });
  $('#lista-solicitudes').addEventListener('click', e => {
    const estrella = e.target.closest('[data-estrella]');
    if (estrella) {
      const form = estrella.closest('[data-calificar]');
      const n = Number(estrella.dataset.estrella);
      estado.calificaciones[form.dataset.calificar] = n;
      form.querySelectorAll('[data-estrella]').forEach(b => {
        b.classList.toggle('is-on', Number(b.dataset.estrella) <= n);
        b.setAttribute('aria-checked', Number(b.dataset.estrella) === n);
      });
      return;
    }
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    const id = Number(accion.closest('[data-solicitud]').dataset.solicitud);
    if (accion.dataset.accion === 'cancelar') cancelarSolicitud(id);
    if (accion.dataset.accion === 'eliminar-solicitud') eliminarSolicitud(id);
    if (accion.dataset.accion === 'repetir') {
      const s = estado.solicitudes.find(x => x.id === id);
      if (s) abrirSolicitud(s.servicio.id);
    }
  });
  $('#lista-solicitudes').addEventListener('submit', e => {
    if (e.target.matches('[data-calificar]')) { e.preventDefault(); publicarCalificacion(e.target); }
  });

  // Perfil
  $('#form-perfil').addEventListener('submit', guardarPerfil);

  // Reintento de conexión desde el indicador "Modo local"
  document.addEventListener('cercapp:recargar', cargarTodo);
}
