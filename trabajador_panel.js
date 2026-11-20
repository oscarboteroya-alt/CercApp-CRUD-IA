/* =====================================================================
 * Ruta: trabajador_panel.js
 * CercApp — Panel del TRABAJADOR
 * ---------------------------------------------------------------------
 * CRUD de sus propios servicios del hogar:
 *   CREATE  → nuevo servicio (queda PENDIENTE de moderación)
 *   READ    → listado propio con filtro por estado
 *   UPDATE  → editar datos, pausar / reactivar publicación
 *   DELETE  → eliminar servicio
 * Además: gestión de solicitudes recibidas (cambio de estado) y perfil.
 * Las operaciones usan CercAPI (common.js) con fallback a localStorage.
 * ===================================================================== */
'use strict';

const sesion = Sesion.exigirRol('TRABAJADOR');

const estado = {
  usuario: sesion,
  servicios: [],
  solicitudes: [],
  filtroServicios: 'TODOS',
  filtroSolicitudes: 'ACTIVAS',
};

/** Siguiente estado y texto del botón para avanzar una solicitud. */
const SIGUIENTE_PASO = {
  PENDIENTE: { estado: 'ACEPTADA', texto: 'Aceptar trabajo', icono: 'check' },
  ACEPTADA: { estado: 'EN_CAMINO', texto: 'Voy en camino', icono: 'truck' },
  EN_CAMINO: { estado: 'EN_EJECUCION', texto: 'Iniciar servicio', icono: 'play' },
  EN_EJECUCION: { estado: 'COMPLETADA', texto: 'Marcar como finalizado', icono: 'check' },
};

const $ = (sel) => document.querySelector(sel);

/* ===================== ARRANQUE ===================== */
if (sesion) {
  prepararFormularios();
  configurarEventos();
  cargarTodo();
}

function prepararFormularios() {
  $('#svc-categoria').innerHTML = UI.opciones(CATEGORIAS, '', { vacio: 'Selecciona una categoría' });
  $('#svc-unidad').innerHTML = UI.opciones(Object.fromEntries(Object.entries(UNIDADES_TARIFA).map(([k, v]) => [k, v.charAt(0).toUpperCase() + v.slice(1)])), 'VISITA');
  $('#lista-disponibilidad').innerHTML = DISPONIBILIDADES_SUGERIDAS.map(d => `<option value="${UI.esc(d)}">`).join('');
  $('#perfil-barrio').innerHTML = UI.opciones(BARRIOS_NEIVA, '', { vacio: 'Selecciona tu barrio' });
}

async function cargarTodo() {
  try {
    const [usuario, servicios, solicitudes] = await Promise.all([
      CercAPI.usuarios.obtener(sesion.id),
      CercAPI.servicios.listar({ trabajadorId: sesion.id }),
      CercAPI.solicitudes.listar({ trabajadorId: sesion.id }),
    ]);
    if (usuario.estado === 'SUSPENDIDO') {
      UI.toast('Tu cuenta fue suspendida por el administrador.', 'error');
      setTimeout(() => Sesion.cerrar(), 1500);
      return;
    }
    estado.usuario = usuario;
    Sesion.iniciar(usuario);
    estado.servicios = servicios.sort((a, b) => b.id - a.id);
    estado.solicitudes = solicitudes;
    pintarResumen();
    pintarServicios();
    pintarSolicitudes();
    pintarPerfil();
  } catch (err) {
    if (err.estado === 404) { Sesion.cerrar(); return; }
    UI.toast(err.message, 'error');
  }
}

function mostrarVista(vista) {
  document.querySelectorAll('.app-tab').forEach(t => {
    t.classList.toggle('is-active', t.dataset.vista === vista);
    if (t.dataset.vista === vista) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== `vista-${vista}`; });
}

/* ===================== RESUMEN (KPIs) ===================== */
function pintarResumen() {
  const u = estado.usuario;
  const publicados = estado.servicios.filter(s => s.estado === 'PUBLICADO');
  const resenas = publicados.reduce((a, s) => a + Number(s.numResenas || 0), 0);
  const promedio = resenas ? publicados.reduce((a, s) => a + Number(s.calificacion) * Number(s.numResenas || 0), 0) / resenas : 0;
  const activas = estado.solicitudes.filter(s => !['COMPLETADA', 'CANCELADA'].includes(s.estado)).length;

  $('#resumen-trabajador').innerHTML = `
    <div class="row">
      ${UI.avatar(u, 'lg', { redondo: true })}
      <div>
        <p>¡Hola de nuevo! 👋</p>
        <h1>${UI.esc(u.nombre)}</h1>
        <div class="row wrap mt-2" style="gap:6px">
          <span class="badge badge-gris">${UI.esc(u.especialidad || 'Sin especialidad')}</span>
          ${u.verificado ? `<span class="badge badge-azul">${UI.icono('shield')} Verificado</span>` : '<span class="badge badge-naranja">Verificación pendiente</span>'}
        </div>
      </div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><strong>${publicados.length}</strong><span>publicados</span></div>
      <div class="kpi"><strong>${estado.servicios.filter(s => s.estado === 'PENDIENTE').length}</strong><span>en revisión</span></div>
      <div class="kpi"><strong>${promedio ? promedio.toFixed(1) + ' ★' : '—'}</strong><span>${resenas} reseñas</span></div>
      <div class="kpi"><strong>${activas}</strong><span>solicitudes activas</span></div>
    </div>`;
  $('#cuenta-solicitudes').textContent = estado.solicitudes.filter(s => s.estado === 'PENDIENTE').length || '';
}

/* ===================== READ: MIS SERVICIOS ===================== */
function pintarServicios() {
  document.querySelectorAll('#filtro-servicios button').forEach(b => b.classList.toggle('is-active', b.dataset.filtro === estado.filtroServicios));
  const lista = estado.servicios.filter(s => estado.filtroServicios === 'TODOS' || s.estado === estado.filtroServicios);
  $('#lista-servicios').innerHTML = lista.length
    ? lista.map(tarjetaServicio).join('')
    : `<div class="empty-state" style="grid-column:1/-1">
         ${UI.icono('briefcase')}
         <h3>${estado.servicios.length ? 'No hay servicios con este estado' : 'Aún no publicas servicios'}</h3>
         <p>Crea tu primer servicio del hogar para empezar a recibir solicitudes.</p>
         <button type="button" class="btn btn-accent btn-sm" data-accion="nuevo">${UI.icono('plus', 'icon-sm')} Nuevo servicio</button>
       </div>`;
}

function tarjetaServicio(s) {
  const info = ESTADOS_SERVICIO[s.estado];
  const cat = CATEGORIAS[s.categoria];
  const zonas = s.zonaCobertura.split(',').map(z => z.trim()).filter(Boolean);
  const aviso = {
    PENDIENTE: `<div class="notice">${UI.icono('clock')} En revisión: aún no es visible para los clientes.</div>`,
    RECHAZADO: `<div class="notice notice--rojo">${UI.icono('alert')} Rechazado por moderación. Edítalo y se enviará de nuevo a revisión.</div>`,
    PAUSADO: `<div class="notice">${UI.icono('pause')} Pausado: no aparece en el catálogo hasta que lo reactives.</div>`,
  }[s.estado] || '';

  return `
    <article class="card svc-card ${s.estado === 'RECHAZADO' ? 'svc-card--rechazado' : ''}" data-servicio="${s.id}">
      <div class="svc-card__head">
        <span class="service-line__icon">${UI.icono(cat.icono)}</span>
        <div class="grow">
          <div class="row wrap" style="gap:6px"><span class="badge ${info.clase}">${info.texto}</span><span class="subtle">${UI.esc(cat.nombre)}</span></div>
          <h3 class="mt-2">${UI.esc(s.titulo)}</h3>
        </div>
      </div>
      <p class="pro-card__desc">${UI.esc(s.descripcion)}</p>
      <div class="svc-card__facts">
        <div>${UI.icono('clock')}<span>${UI.esc(s.disponibilidad)}</span></div>
        <div>${UI.icono('pin')}<span>${zonas.map(UI.esc).join(' · ')}</span></div>
        <div>${UI.icono('star')}<span>${s.numResenas ? `${Number(s.calificacion).toFixed(1)} de 5 · ${s.numResenas} reseñas` : 'Sin reseñas todavía'}</span></div>
      </div>
      ${aviso}
      <div class="svc-card__foot">
        <div class="price"><small>Tarifa base ${UNIDADES_TARIFA[s.unidadTarifa]}</small><strong>${UI.moneda(s.tarifa)}<span>COP</span></strong></div>
        <div class="actions">
          ${s.estado === 'PUBLICADO' ? `<button type="button" class="btn-icon" data-accion="pausar" aria-label="Pausar publicación" title="Pausar">${UI.icono('pause')}</button>` : ''}
          ${s.estado === 'PAUSADO' ? `<button type="button" class="btn-icon" data-accion="reactivar" aria-label="Reactivar publicación" title="Reactivar">${UI.icono('play')}</button>` : ''}
          <button type="button" class="btn-icon" data-accion="editar" aria-label="Editar servicio" title="Editar">${UI.icono('edit')}</button>
          <button type="button" class="btn-icon btn-icon--danger" data-accion="eliminar" aria-label="Eliminar servicio" title="Eliminar">${UI.icono('trash')}</button>
        </div>
      </div>
    </article>`;
}

/* ===================== CREATE / UPDATE: FORMULARIO ===================== */
function abrirFormulario(servicio = null) {
  const form = $('#form-servicio');
  form.reset();
  Validar.limpiar(form);
  form.elements.editandoId.value = servicio ? servicio.id : '';
  $('#titulo-modal-servicio').textContent = servicio ? 'Editar servicio' : 'Nuevo servicio';
  $('#aviso-moderacion').hidden = !!servicio && servicio.estado !== 'RECHAZADO';
  form.categoria.value = servicio ? servicio.categoria : '';
  form.titulo.value = servicio ? servicio.titulo : '';
  form.tarifa.value = servicio ? Math.round(servicio.tarifa) : '';
  form.unidadTarifa.value = servicio ? servicio.unidadTarifa : 'VISITA';
  form.disponibilidad.value = servicio ? servicio.disponibilidad : '';
  form.descripcion.value = servicio ? servicio.descripcion : '';
  const zonas = servicio ? servicio.zonaCobertura.split(',').map(z => z.trim()) : [estado.usuario.barrio].filter(Boolean);
  $('#svc-zonas').innerHTML = UI.chipsCheckbox('zonaCobertura', BARRIOS_NEIVA, zonas);
  form.descripcion.dispatchEvent(new Event('input'));
  UI.abrirModal('modal-servicio');
  setTimeout(() => form.categoria.focus(), 50);
}

async function guardarServicio(e) {
  e.preventDefault();
  const form = e.target;
  // Validación estricta: tarifa solo dígitos, campos obligatorios y al menos un barrio
  const datos = Validar.formulario(form, {
    categoria: [Validar.requerido, Validar.enLista(Object.keys(CATEGORIAS))],
    titulo: [Validar.requerido, Validar.minLargo(5), Validar.maxLargo(120)],
    tarifa: [Validar.requerido, Validar.entero(1000, 10000000, 'La tarifa')],
    unidadTarifa: [Validar.requerido, Validar.enLista(Object.keys(UNIDADES_TARIFA))],
    disponibilidad: [Validar.requerido, Validar.minLargo(5), Validar.maxLargo(150)],
    zonaCobertura: [v => (v ? null : 'Selecciona al menos un barrio de cobertura.')],
    descripcion: [Validar.requerido, Validar.minLargo(20), Validar.maxLargo(1000)],
  });
  if (!datos) return;

  const id = Number(form.elements.editandoId.value) || null;
  const anterior = id ? estado.servicios.find(s => s.id === id) : null;
  const cuerpo = {
    titulo: datos.titulo,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    tarifa: Number(datos.tarifa),
    unidadTarifa: datos.unidadTarifa,
    disponibilidad: datos.disponibilidad,
    zonaCobertura: datos.zonaCobertura,
    // Nuevo → PENDIENTE; editar un RECHAZADO lo devuelve a revisión; los demás conservan su estado
    estado: !anterior || anterior.estado === 'RECHAZADO' ? 'PENDIENTE' : anterior.estado,
    trabajador: { id: estado.usuario.id },
  };

  const boton = $('#btn-guardar-servicio');
  UI.cargando(boton, true);
  try {
    if (id) {
      await CercAPI.servicios.actualizar(id, cuerpo);
      UI.toast('Servicio actualizado.', 'exito');
    } else {
      await CercAPI.servicios.crear(cuerpo);
      UI.toast('Servicio creado. Quedó en revisión del administrador.', 'exito');
    }
    UI.cerrarModal('modal-servicio');
    await recargarServicios();
  } catch (err) {
    Validar.mostrarErroresServidor(form, err);
  } finally {
    UI.cargando(boton, false);
  }
}

async function recargarServicios() {
  estado.servicios = (await CercAPI.servicios.listar({ trabajadorId: estado.usuario.id })).sort((a, b) => b.id - a.id);
  pintarServicios();
  pintarResumen();
}

/* ===================== UPDATE: PAUSAR / REACTIVAR ===================== */
async function cambiarEstadoServicio(id, nuevoEstado) {
  const s = estado.servicios.find(x => x.id === id);
  if (!s) return;
  try {
    await CercAPI.servicios.actualizar(id, cuerpoServicio(s, { estado: nuevoEstado }));
    UI.toast(nuevoEstado === 'PAUSADO' ? 'Publicación pausada.' : 'Publicación reactivada.', 'exito');
    await recargarServicios();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== DELETE ===================== */
async function eliminarServicio(id) {
  const s = estado.servicios.find(x => x.id === id);
  if (!s) return;
  const ok = await UI.confirmar(`“${s.titulo}” se eliminará junto con sus solicitudes y favoritos asociados.`, {
    titulo: '¿Eliminar este servicio?', aceptar: 'Eliminar', peligro: true,
  });
  if (!ok) return;
  try {
    await CercAPI.servicios.eliminar(id);
    UI.toast('Servicio eliminado.', 'exito');
    await recargarServicios();
    estado.solicitudes = await CercAPI.solicitudes.listar({ trabajadorId: estado.usuario.id });
    pintarSolicitudes();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== SOLICITUDES RECIBIDAS ===================== */
function pintarSolicitudes() {
  document.querySelectorAll('#filtro-solicitudes button').forEach(b => b.classList.toggle('is-active', b.dataset.filtro === estado.filtroSolicitudes));
  const f = estado.filtroSolicitudes;
  const lista = estado.solicitudes.filter(s =>
    f === 'ACTIVAS' ? !['COMPLETADA', 'CANCELADA'].includes(s.estado) : s.estado === f);
  $('#lista-solicitudes').innerHTML = lista.length
    ? lista.map(tarjetaSolicitud).join('')
    : `<div class="empty-state" style="grid-column:1/-1">${UI.icono('clipboard')}<h3>No hay solicitudes aquí</h3><p>Las nuevas solicitudes de tus clientes aparecerán en esta sección.</p></div>`;
}

function tarjetaSolicitud(s) {
  const info = ESTADOS_SOLICITUD[s.estado];
  const c = s.cliente || {};
  const siguiente = SIGUIENTE_PASO[s.estado];
  return `
    <article class="card order-card" data-solicitud="${s.id}">
      <div class="order-card__head">
        <div>
          <div class="row wrap" style="gap:6px">
            <span class="badge ${info.clase}">${UI.esc(info.corto)}</span>
            <span class="subtle">Recibida ${UI.fechaHora(s.fechaCreacion)}</span>
          </div>
          <h3>${UI.esc(s.servicio.titulo)}</h3>
        </div>
      </div>
      <div class="order-card__who">
        ${UI.avatar(c, 'md', { redondo: true })}
        <div class="grow">
          <strong>${UI.esc(c.nombre || 'Cliente')}</strong>
          <span>${UI.esc(s.direccion)} · ${UI.esc(s.barrio || '')}</span>
        </div>
      </div>
      <div class="svc-card__facts">
        <div>${UI.icono('calendar')}<span>${UI.fecha(s.fechaPreferida, { weekday: 'long', day: 'numeric', month: 'long' })} · ${UI.esc(s.franjaHoraria)}</span></div>
        <div>${UI.icono('info')}<span>${UI.esc(s.descripcion)}</span></div>
        ${s.calificacion ? `<div>${UI.icono('star')}<span>Calificación del cliente: ${s.calificacion}/5${s.comentario ? ` — “${UI.esc(s.comentario)}”` : ''}</span></div>` : ''}
      </div>
      <div class="order-card__actions">
        ${c.telefono && !['COMPLETADA', 'CANCELADA'].includes(s.estado) ? `<a class="btn btn-outline" href="tel:${UI.esc(c.telefono)}">${UI.icono('phone', 'icon-sm')} Llamar</a>` : ''}
        ${s.estado === 'PENDIENTE' ? `<button type="button" class="btn btn-ghost" data-accion="rechazar">${UI.icono('x', 'icon-sm')} Rechazar</button>` : ''}
        ${siguiente ? `<button type="button" class="btn ${s.estado === 'EN_EJECUCION' ? 'btn-success' : 'btn-primary'}" data-accion="avanzar">${UI.icono(siguiente.icono, 'icon-sm')} ${siguiente.texto}</button>` : ''}
      </div>
    </article>`;
}

async function cambiarEstadoSolicitud(id, nuevoEstado) {
  const s = estado.solicitudes.find(x => x.id === id);
  if (!s) return;
  if (nuevoEstado === 'CANCELADA') {
    const ok = await UI.confirmar('El cliente verá la solicitud como cancelada.', { titulo: '¿Rechazar la solicitud?', aceptar: 'Rechazar', peligro: true });
    if (!ok) return;
  }
  try {
    await CercAPI.solicitudes.actualizar(id, cuerpoSolicitud(s, { estado: nuevoEstado }));
    UI.toast(`Estado actualizado: ${ESTADOS_SOLICITUD[nuevoEstado].corto}.`, 'exito');
    estado.solicitudes = await CercAPI.solicitudes.listar({ trabajadorId: estado.usuario.id });
    pintarSolicitudes();
    pintarResumen();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== PERFIL ===================== */
function pintarPerfil() {
  const u = estado.usuario;
  const form = $('#form-perfil');
  form.nombre.value = u.nombre || '';
  form.email.value = u.email || '';
  form.telefono.value = u.telefono || '';
  form.especialidad.value = u.especialidad || '';
  form.aniosExperiencia.value = u.aniosExperiencia ?? '';
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
    especialidad: [Validar.requerido, Validar.minLargo(4)],
    aniosExperiencia: [Validar.requerido, Validar.entero(0, 60, 'Los años de experiencia')],
    barrio: [Validar.requerido, Validar.enLista(BARRIOS_NEIVA)],
    direccion: [Validar.opcional(Validar.minLargo(5))],
    password: [Validar.opcional(Validar.minLargo(6))],
  });
  if (!datos) return;
  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    const cuerpo = cuerpoUsuario(estado.usuario, {
      nombre: datos.nombre,
      email: datos.email,
      telefono: datos.telefono,
      especialidad: datos.especialidad,
      aniosExperiencia: Number(datos.aniosExperiencia),
      barrio: datos.barrio,
      direccion: datos.direccion || null,
    });
    if (datos.password) cuerpo.password = datos.password;
    estado.usuario = await CercAPI.usuarios.actualizar(estado.usuario.id, cuerpo);
    Sesion.iniciar(estado.usuario);
    pintarResumen();
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
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-vista]');
    if (b) mostrarVista(b.dataset.vista);
  });
  $('#btn-nuevo-servicio').addEventListener('click', () => abrirFormulario());
  $('#form-servicio').addEventListener('submit', guardarServicio);
  $('#form-perfil').addEventListener('submit', guardarPerfil);

  $('#filtro-servicios').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtroServicios = b.dataset.filtro;
    pintarServicios();
  });
  $('#filtro-solicitudes').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    estado.filtroSolicitudes = b.dataset.filtro;
    pintarSolicitudes();
  });

  $('#lista-servicios').addEventListener('click', e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    if (accion.dataset.accion === 'nuevo') { abrirFormulario(); return; }
    const id = Number(accion.closest('[data-servicio]').dataset.servicio);
    const s = estado.servicios.find(x => x.id === id);
    if (accion.dataset.accion === 'editar') abrirFormulario(s);
    if (accion.dataset.accion === 'eliminar') eliminarServicio(id);
    if (accion.dataset.accion === 'pausar') cambiarEstadoServicio(id, 'PAUSADO');
    if (accion.dataset.accion === 'reactivar') cambiarEstadoServicio(id, 'PUBLICADO');
  });

  $('#lista-solicitudes').addEventListener('click', e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    const id = Number(accion.closest('[data-solicitud]').dataset.solicitud);
    const s = estado.solicitudes.find(x => x.id === id);
    if (accion.dataset.accion === 'avanzar' && SIGUIENTE_PASO[s.estado]) cambiarEstadoSolicitud(id, SIGUIENTE_PASO[s.estado].estado);
    if (accion.dataset.accion === 'rechazar') cambiarEstadoSolicitud(id, 'CANCELADA');
  });

  document.addEventListener('cercapp:recargar', cargarTodo);
}
