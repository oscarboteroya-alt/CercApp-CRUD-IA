/* =====================================================================
 * Ruta: admin_dashboard.js
 * CercApp — Panel del ADMINISTRADOR
 * ---------------------------------------------------------------------
 * CRUD global con moderación:
 *   USUARIOS   → crear, listar/buscar/filtrar, editar, suspender/activar,
 *                verificar trabajadores y eliminar (con cascada)
 *   SERVICIOS  → crear para cualquier trabajador, listar/filtrar, editar,
 *                moderar estado (Pendiente / Publicado / Pausado / Rechazado), eliminar
 *   SOLICITUDES→ listar, cambiar estado y eliminar
 * Todas las operaciones usan CercAPI (common.js): API REST con fallback a localStorage.
 * ===================================================================== */
'use strict';

const sesion = Sesion.exigirRol('ADMIN');

const estado = {
  usuarios: [],
  servicios: [],
  solicitudes: [],
  vista: 'resumen',
};

const $ = (sel) => document.querySelector(sel);

/* ===================== ARRANQUE ===================== */
if (sesion) {
  prepararFormularios();
  configurarEventos();
  $('#saludo-admin').textContent = `Hola, ${UI.primerNombre(sesion.nombre)} · ${UI.fecha(hoyISO(), { weekday: 'long', day: 'numeric', month: 'long' })}`;
  cargarTodo();
}

function prepararFormularios() {
  $('#usr-barrio').innerHTML = UI.opciones(BARRIOS_NEIVA, '', { vacio: 'Sin barrio' });
  $('#adm-svc-categoria').innerHTML = UI.opciones(CATEGORIAS, '', { vacio: 'Selecciona una categoría' });
  $('#adm-svc-unidad').innerHTML = UI.opciones(Object.fromEntries(Object.entries(UNIDADES_TARIFA).map(([k, v]) => [k, v.charAt(0).toUpperCase() + v.slice(1)])), 'VISITA');
  $('#adm-svc-estado').innerHTML = UI.opciones(Object.fromEntries(Object.entries(ESTADOS_SERVICIO).map(([k, v]) => [k, v.texto])), 'PUBLICADO');
  $('#adm-lista-disponibilidad').innerHTML = DISPONIBILIDADES_SUGERIDAS.map(d => `<option value="${UI.esc(d)}">`).join('');
  $('#filtro-categoria').innerHTML = UI.opciones(CATEGORIAS, '', { vacio: 'Todas las categorías' });
  $('#filtro-estado-solicitud').innerHTML = UI.opciones(
    Object.fromEntries(Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => [k, v.corto])), '', { vacio: 'Todos los estados' });
}

/** READ global: usuarios, servicios y solicitudes en paralelo. */
async function cargarTodo() {
  try {
    const [usuarios, servicios, solicitudes] = await Promise.all([
      CercAPI.usuarios.listar(),
      CercAPI.servicios.listar(),
      CercAPI.solicitudes.listar(),
    ]);
    estado.usuarios = usuarios;
    estado.servicios = servicios;
    estado.solicitudes = solicitudes;
    pintarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

function pintarTodo() {
  pintarResumen();
  pintarUsuarios();
  pintarServicios();
  pintarSolicitudes();
  const pendientes = estado.servicios.filter(s => s.estado === 'PENDIENTE').length;
  $('#cuenta-pendientes').textContent = pendientes || '';
}

function mostrarVista(vista) {
  estado.vista = vista;
  document.querySelectorAll('#nav-admin [data-vista]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.vista === vista);
    if (b.dataset.vista === vista) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== `vista-${vista}`; });
  window.scrollTo({ top: 0 });
}

/* ===================== RESUMEN ===================== */
function pintarResumen() {
  const u = estado.usuarios;
  const s = estado.servicios;
  const tarjetas = [
    ['users', u.length, 'Usuarios registrados'],
    ['wrench', u.filter(x => x.rol === 'TRABAJADOR').length, 'Trabajadores'],
    ['home', u.filter(x => x.rol === 'CLIENTE').length, 'Clientes'],
    ['briefcase', s.filter(x => x.estado === 'PUBLICADO').length, 'Servicios publicados'],
    ['clock', s.filter(x => x.estado === 'PENDIENTE').length, 'Por moderar', true],
    ['clipboard', estado.solicitudes.filter(x => !['COMPLETADA', 'CANCELADA'].includes(x.estado)).length, 'Solicitudes activas'],
  ];
  $('#estadisticas').innerHTML = tarjetas.map(([icono, valor, texto, alerta]) => `
    <div class="card stat-card ${alerta && valor ? 'stat-card--alerta' : ''}">
      <span class="stat-card__icon">${UI.icono(icono)}</span>
      <strong>${valor}</strong>
      <span>${texto}</span>
    </div>`).join('');

  // Cola de moderación: servicios pendientes + trabajadores sin verificar
  const pendientes = s.filter(x => x.estado === 'PENDIENTE');
  const sinVerificar = u.filter(x => x.rol === 'TRABAJADOR' && !x.verificado && x.estado === 'ACTIVO');
  $('#lista-moderacion').innerHTML = (pendientes.length || sinVerificar.length)
    ? pendientes.map(x => `
        <div class="mod-item" data-servicio="${x.id}">
          <span class="service-line__icon">${UI.icono(CATEGORIAS[x.categoria].icono)}</span>
          <div class="grow"><strong>${UI.esc(x.titulo)}</strong><span>${UI.esc(x.trabajador.nombre)} · ${UI.moneda(x.tarifa)} ${UNIDADES_TARIFA[x.unidadTarifa]}</span></div>
          <button type="button" class="btn btn-success btn-sm" data-moderar="PUBLICADO">${UI.icono('check', 'icon-sm')} Aprobar</button>
          <button type="button" class="btn btn-outline btn-sm" data-moderar="RECHAZADO">Rechazar</button>
        </div>`).join('') +
      sinVerificar.map(x => `
        <div class="mod-item" data-usuario="${x.id}">
          ${UI.avatar(x, 'sm')}
          <div class="grow"><strong>${UI.esc(x.nombre)}</strong><span>Trabajador sin verificar · ${UI.esc(x.especialidad || '')}</span></div>
          <button type="button" class="btn btn-soft btn-sm" data-verificar>${UI.icono('shield', 'icon-sm')} Verificar</button>
        </div>`).join('')
    : `<div class="empty-state">${UI.icono('check')}<h3>Todo al día</h3><p>No hay publicaciones ni trabajadores pendientes.</p></div>`;

  // Barras por categoría
  const publicados = s.filter(x => x.estado === 'PUBLICADO');
  const cuenta = publicados.reduce((m, x) => (m[x.categoria] = (m[x.categoria] || 0) + 1, m), {});
  const maximo = Math.max(1, ...Object.values(cuenta));
  $('#barras-categorias').innerHTML = Object.entries(CATEGORIAS).map(([clave, c]) => `
    <div>
      <div class="bar__label"><span>${UI.esc(c.nombre)}</span><span>${cuenta[clave] || 0}</span></div>
      <div class="bar__track"><div class="bar__fill" style="width:${((cuenta[clave] || 0) / maximo) * 100}%"></div></div>
    </div>`).join('');
}

/* ===================== USUARIOS ===================== */
function usuariosFiltrados() {
  const q = UI.normalizarTexto($('#buscar-usuario').value);
  const rol = $('#filtro-rol').value;
  const est = $('#filtro-estado-usuario').value;
  return estado.usuarios.filter(u =>
    (!rol || u.rol === rol) &&
    (!est || u.estado === est) &&
    (!q || UI.normalizarTexto(`${u.nombre} ${u.email} ${u.telefono} ${u.barrio || ''} ${u.especialidad || ''}`).includes(q)));
}

function pintarUsuarios() {
  const lista = usuariosFiltrados();
  $('#conteo-usuarios').textContent = `${lista.length} de ${estado.usuarios.length} usuarios`;
  const roles = { ADMIN: ['Admin', 'badge-solid'], TRABAJADOR: ['Trabajador', 'badge-naranja'], CLIENTE: ['Cliente', 'badge-azul'] };
  $('#tabla-usuarios').innerHTML = lista.length ? lista.map(u => {
    const propio = u.id === sesion.id;
    return `
    <tr data-usuario="${u.id}">
      <td><div class="cell-user">${UI.avatar(u, 'sm')}<div><strong>${UI.esc(u.nombre)}${propio ? ' (tú)' : ''}</strong><span>${UI.esc(u.email)}</span></div></div></td>
      <td><span class="badge ${roles[u.rol][1]}">${roles[u.rol][0]}</span></td>
      <td>${UI.esc(u.telefono)}</td>
      <td>${UI.esc(u.barrio || '—')}</td>
      <td>${u.rol === 'TRABAJADOR'
        ? `<label class="switch" title="${u.verificado ? 'Quitar verificación' : 'Marcar como verificado'}"><input type="checkbox" data-verificar ${u.verificado ? 'checked' : ''} aria-label="Verificado"><span></span></label>`
        : '<span class="subtle">—</span>'}</td>
      <td><span class="badge ${u.estado === 'ACTIVO' ? 'badge-verde' : 'badge-rojo'}">${u.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}</span></td>
      <td><div class="actions">
        ${propio ? '' : `<button type="button" class="btn-icon" data-accion="suspender" title="${u.estado === 'ACTIVO' ? 'Suspender' : 'Reactivar'}" aria-label="${u.estado === 'ACTIVO' ? 'Suspender' : 'Reactivar'} usuario">${UI.icono(u.estado === 'ACTIVO' ? 'ban' : 'play')}</button>`}
        <button type="button" class="btn-icon" data-accion="editar" title="Editar" aria-label="Editar usuario">${UI.icono('edit')}</button>
        ${propio ? '' : `<button type="button" class="btn-icon btn-icon--danger" data-accion="eliminar" title="Eliminar" aria-label="Eliminar usuario">${UI.icono('trash')}</button>`}
      </div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-state">' + UI.icono('search') + '<h3>Sin resultados</h3><p>Ajusta la búsqueda o los filtros.</p></div></td></tr>';
}

/** Muestra u oculta los campos propios de trabajador según el rol elegido. */
function alternarCamposTrabajador() {
  const esTrabajador = $('#form-usuario').rol.value === 'TRABAJADOR';
  document.querySelectorAll('#form-usuario [data-solo-trabajador]').forEach(el => { el.hidden = !esTrabajador; });
}

function abrirFormularioUsuario(u = null) {
  const form = $('#form-usuario');
  form.reset();
  Validar.limpiar(form);
  form.elements.editandoId.value = u ? u.id : '';
  $('#titulo-modal-usuario').textContent = u ? 'Editar usuario' : 'Nuevo usuario';
  form.nombre.value = u ? u.nombre : '';
  form.email.value = u ? u.email : '';
  form.telefono.value = u ? u.telefono : '';
  form.rol.value = u ? u.rol : '';
  form.estado.value = u ? u.estado : 'ACTIVO';
  form.barrio.value = u ? (u.barrio || '') : '';
  form.direccion.value = u ? (u.direccion || '') : '';
  form.especialidad.value = u ? (u.especialidad || '') : '';
  form.aniosExperiencia.value = u && u.aniosExperiencia != null ? u.aniosExperiencia : '';
  form.verificado.checked = !!(u && u.verificado);
  // Al editar, la contraseña es opcional (vacía = se conserva)
  $('#req-password').hidden = !!u;
  $('#ayuda-password').textContent = u ? 'Déjala vacía para conservar la contraseña actual.' : 'Mínimo 6 caracteres.';
  // Un administrador no puede quitarse a sí mismo el rol ni suspenderse
  const propio = u && u.id === sesion.id;
  form.rol.disabled = propio;
  form.estado.disabled = propio;
  alternarCamposTrabajador();
  UI.abrirModal('modal-usuario');
  setTimeout(() => form.nombre.focus(), 50);
}

async function guardarUsuario(e) {
  e.preventDefault();
  const form = e.target;
  const id = Number(form.elements.editandoId.value) || null;
  const esTrabajador = form.rol.value === 'TRABAJADOR';
  const reglas = {
    nombre: [Validar.requerido, Validar.minLargo(3), Validar.soloLetras],
    email: [Validar.requerido, Validar.email],
    telefono: [Validar.requerido, Validar.telefono],
    rol: [Validar.requerido, Validar.enLista(['ADMIN', 'TRABAJADOR', 'CLIENTE'])],
    estado: [Validar.requerido, Validar.enLista(['ACTIVO', 'SUSPENDIDO'])],
    barrio: [Validar.opcional(Validar.enLista(BARRIOS_NEIVA))],
    direccion: [Validar.opcional(Validar.minLargo(5))],
    password: id ? [Validar.opcional(Validar.minLargo(6))] : [Validar.requerido, Validar.minLargo(6)],
  };
  if (esTrabajador) {
    reglas.especialidad = [Validar.requerido, Validar.minLargo(4)];
    reglas.aniosExperiencia = [Validar.requerido, Validar.entero(0, 60, 'Los años de experiencia')];
  }
  const datos = Validar.formulario(form, reglas);
  if (!datos) return;

  const cuerpo = {
    nombre: datos.nombre,
    email: datos.email,
    telefono: datos.telefono,
    rol: datos.rol,
    ciudad: 'Neiva',
    estado: datos.estado,
    barrio: datos.barrio || null,
    direccion: datos.direccion || null,
    especialidad: esTrabajador ? datos.especialidad : null,
    aniosExperiencia: esTrabajador ? Number(datos.aniosExperiencia) : null,
    verificado: esTrabajador ? form.verificado.checked : false,
  };
  if (datos.password) cuerpo.password = datos.password;

  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    if (id) {
      const actualizado = await CercAPI.usuarios.actualizar(id, cuerpo);
      if (id === sesion.id) Sesion.iniciar(actualizado);
      UI.toast('Usuario actualizado.', 'exito');
    } else {
      await CercAPI.usuarios.crear(cuerpo);
      UI.toast('Usuario creado.', 'exito');
    }
    UI.cerrarModal('modal-usuario');
    await cargarTodo();
  } catch (err) {
    Validar.mostrarErroresServidor(form, err);
  } finally {
    UI.cargando(boton, false);
  }
}

/** UPDATE parcial reutilizable: estado ACTIVO/SUSPENDIDO o verificación. */
async function actualizarUsuarioRapido(id, cambios, mensaje) {
  const u = estado.usuarios.find(x => x.id === id);
  if (!u) return;
  try {
    await CercAPI.usuarios.actualizar(id, cuerpoUsuario(u, cambios));
    UI.toast(mensaje, 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
    pintarTodo();
  }
}

async function eliminarUsuario(id) {
  const u = estado.usuarios.find(x => x.id === id);
  if (!u) return;
  const extra = u.rol === 'TRABAJADOR' ? ' También se eliminarán sus servicios y las solicitudes asociadas.' : u.rol === 'CLIENTE' ? ' También se eliminarán sus favoritos y solicitudes.' : '';
  const ok = await UI.confirmar(`Vas a eliminar a ${u.nombre}.${extra} Esta acción no se puede deshacer.`, { titulo: '¿Eliminar usuario?', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  try {
    await CercAPI.usuarios.eliminar(id);
    UI.toast('Usuario eliminado.', 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== SERVICIOS ===================== */
function serviciosFiltrados() {
  const q = UI.normalizarTexto($('#buscar-servicio').value);
  const cat = $('#filtro-categoria').value;
  const est = $('#filtro-estado-servicio').value;
  return estado.servicios
    .filter(s => (!cat || s.categoria === cat) && (!est || s.estado === est) &&
      (!q || UI.normalizarTexto(`${s.titulo} ${s.trabajador.nombre} ${s.zonaCobertura}`).includes(q)))
    .sort((a, b) => (a.estado === 'PENDIENTE' ? -1 : 0) - (b.estado === 'PENDIENTE' ? -1 : 0) || a.id - b.id);
}

function pintarServicios() {
  const lista = serviciosFiltrados();
  $('#conteo-servicios').textContent = `${lista.length} de ${estado.servicios.length} servicios`;
  $('#tabla-servicios').innerHTML = lista.length ? lista.map(s => `
    <tr data-servicio="${s.id}">
      <td><div class="cell-user"><span class="service-line__icon">${UI.icono(CATEGORIAS[s.categoria].icono)}</span><div><strong>${UI.esc(s.titulo)}</strong><span>${UI.esc(CATEGORIAS[s.categoria].nombre)} · ${UI.esc(s.zonaCobertura.split(',').length)} barrios</span></div></div></td>
      <td><div class="cell-user" style="min-width:170px">${UI.avatar(s.trabajador, 'sm')}<div><strong>${UI.esc(s.trabajador.nombre)}</strong><span>${s.trabajador.estado === 'SUSPENDIDO' ? 'Suspendido' : (s.trabajador.verificado ? 'Verificado' : 'Sin verificar')}</span></div></div></td>
      <td><strong>${UI.moneda(s.tarifa)}</strong><br><span class="subtle">${UNIDADES_TARIFA[s.unidadTarifa]}</span></td>
      <td>${UI.calificacion(s.calificacion, s.numResenas)}</td>
      <td>
        <select class="input" data-cambiar-estado aria-label="Estado de publicación">
          ${UI.opciones(Object.fromEntries(Object.entries(ESTADOS_SERVICIO).map(([k, v]) => [k, v.texto])), s.estado)}
        </select>
      </td>
      <td><div class="actions">
        <button type="button" class="btn-icon" data-accion="editar" title="Editar" aria-label="Editar servicio">${UI.icono('edit')}</button>
        <button type="button" class="btn-icon btn-icon--danger" data-accion="eliminar" title="Eliminar" aria-label="Eliminar servicio">${UI.icono('trash')}</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">' + UI.icono('search') + '<h3>Sin resultados</h3><p>Ajusta la búsqueda o los filtros.</p></div></td></tr>';
}

function abrirFormularioServicio(s = null) {
  const trabajadores = estado.usuarios.filter(u => u.rol === 'TRABAJADOR' && (u.estado === 'ACTIVO' || (s && u.id === s.trabajador.id)));
  if (!trabajadores.length) { UI.toast('Primero registra un trabajador activo.', 'error'); return; }
  const form = $('#form-servicio');
  form.reset();
  Validar.limpiar(form);
  form.elements.editandoId.value = s ? s.id : '';
  $('#titulo-modal-servicio').textContent = s ? 'Editar servicio' : 'Nuevo servicio';
  form.trabajadorId.innerHTML = UI.opciones(Object.fromEntries(trabajadores.map(t => [t.id, `${t.nombre} — ${t.especialidad || 'Trabajador'}`])), s ? s.trabajador.id : '', { vacio: 'Selecciona un trabajador' });
  form.categoria.value = s ? s.categoria : '';
  form.titulo.value = s ? s.titulo : '';
  form.tarifa.value = s ? Math.round(s.tarifa) : '';
  form.unidadTarifa.value = s ? s.unidadTarifa : 'VISITA';
  form.estado.value = s ? s.estado : 'PUBLICADO';
  form.disponibilidad.value = s ? s.disponibilidad : '';
  form.descripcion.value = s ? s.descripcion : '';
  $('#adm-svc-zonas').innerHTML = UI.chipsCheckbox('zonaCobertura', BARRIOS_NEIVA, s ? s.zonaCobertura.split(',') : []);
  form.descripcion.dispatchEvent(new Event('input'));
  UI.abrirModal('modal-servicio');
}

async function guardarServicio(e) {
  e.preventDefault();
  const form = e.target;
  const datos = Validar.formulario(form, {
    trabajadorId: [Validar.requerido],
    categoria: [Validar.requerido, Validar.enLista(Object.keys(CATEGORIAS))],
    titulo: [Validar.requerido, Validar.minLargo(5), Validar.maxLargo(120)],
    tarifa: [Validar.requerido, Validar.entero(1000, 10000000, 'La tarifa')],
    unidadTarifa: [Validar.requerido, Validar.enLista(Object.keys(UNIDADES_TARIFA))],
    estado: [Validar.requerido, Validar.enLista(Object.keys(ESTADOS_SERVICIO))],
    disponibilidad: [Validar.requerido, Validar.minLargo(5), Validar.maxLargo(150)],
    zonaCobertura: [v => (v ? null : 'Selecciona al menos un barrio de cobertura.')],
    descripcion: [Validar.requerido, Validar.minLargo(20), Validar.maxLargo(1000)],
  });
  if (!datos) return;
  const id = Number(form.elements.editandoId.value) || null;
  const cuerpo = {
    titulo: datos.titulo,
    categoria: datos.categoria,
    descripcion: datos.descripcion,
    tarifa: Number(datos.tarifa),
    unidadTarifa: datos.unidadTarifa,
    disponibilidad: datos.disponibilidad,
    zonaCobertura: datos.zonaCobertura,
    estado: datos.estado,
    trabajador: { id: Number(datos.trabajadorId) },
  };
  const boton = form.querySelector('[type="submit"]');
  UI.cargando(boton, true);
  try {
    if (id) await CercAPI.servicios.actualizar(id, cuerpo);
    else await CercAPI.servicios.crear(cuerpo);
    UI.toast(id ? 'Servicio actualizado.' : 'Servicio creado.', 'exito');
    UI.cerrarModal('modal-servicio');
    await cargarTodo();
  } catch (err) {
    Validar.mostrarErroresServidor(form, err);
  } finally {
    UI.cargando(boton, false);
  }
}

/** Moderación: cambia el estado de publicación de un servicio. */
async function moderarServicio(id, nuevoEstado) {
  const s = estado.servicios.find(x => x.id === id);
  if (!s || s.estado === nuevoEstado) return;
  try {
    await CercAPI.servicios.actualizar(id, cuerpoServicio(s, { estado: nuevoEstado }));
    UI.toast(`“${s.titulo}” ahora está: ${ESTADOS_SERVICIO[nuevoEstado].texto}.`, 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
    pintarTodo();
  }
}

async function eliminarServicio(id) {
  const s = estado.servicios.find(x => x.id === id);
  if (!s) return;
  const ok = await UI.confirmar(`Se eliminará “${s.titulo}” junto con sus favoritos y solicitudes asociadas.`, { titulo: '¿Eliminar servicio?', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  try {
    await CercAPI.servicios.eliminar(id);
    UI.toast('Servicio eliminado.', 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== SOLICITUDES ===================== */
function pintarSolicitudes() {
  const q = UI.normalizarTexto($('#buscar-solicitud').value);
  const est = $('#filtro-estado-solicitud').value;
  const lista = estado.solicitudes.filter(s => (!est || s.estado === est) &&
    (!q || UI.normalizarTexto(`${s.cliente.nombre} ${s.servicio.titulo} ${s.barrio || ''} ${s.servicio.trabajador ? s.servicio.trabajador.nombre : ''}`).includes(q)));
  $('#conteo-solicitudes').textContent = `${lista.length} de ${estado.solicitudes.length} solicitudes`;
  $('#tabla-solicitudes').innerHTML = lista.length ? lista.map(s => `
    <tr data-solicitud="${s.id}">
      <td><div class="cell-user" style="min-width:180px">${UI.avatar(s.cliente, 'sm', { redondo: true })}<div><strong>${UI.esc(s.cliente.nombre)}</strong><span>${UI.esc(s.barrio || '')} · ${UI.esc(s.direccion)}</span></div></div></td>
      <td><strong>${UI.esc(s.servicio.titulo)}</strong><br><span class="subtle">${UI.esc(s.servicio.trabajador ? s.servicio.trabajador.nombre : '')}</span></td>
      <td>${UI.fecha(s.fechaPreferida)}<br><span class="subtle">${UI.esc(s.franjaHoraria)}</span></td>
      <td>${s.calificacion ? `<span class="rating">${UI.icono('star')} ${s.calificacion}/5</span>` : '<span class="subtle">—</span>'}</td>
      <td>
        <select class="input" data-cambiar-estado-solicitud aria-label="Estado de la solicitud">
          ${UI.opciones(Object.fromEntries(Object.entries(ESTADOS_SOLICITUD).map(([k, v]) => [k, v.corto])), s.estado)}
        </select>
      </td>
      <td><div class="actions">
        <button type="button" class="btn-icon btn-icon--danger" data-accion="eliminar" title="Eliminar" aria-label="Eliminar solicitud">${UI.icono('trash')}</button>
      </div></td>
    </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">' + UI.icono('clipboard') + '<h3>Sin solicitudes</h3><p>No hay registros con esos filtros.</p></div></td></tr>';
}

async function cambiarEstadoSolicitud(id, nuevoEstado) {
  const s = estado.solicitudes.find(x => x.id === id);
  if (!s) return;
  try {
    await CercAPI.solicitudes.actualizar(id, cuerpoSolicitud(s, { estado: nuevoEstado }));
    UI.toast('Estado de la solicitud actualizado.', 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
    pintarSolicitudes();
  }
}

async function eliminarSolicitud(id) {
  const ok = await UI.confirmar('La solicitud se eliminará de forma permanente.', { titulo: '¿Eliminar solicitud?', aceptar: 'Eliminar', peligro: true });
  if (!ok) return;
  try {
    await CercAPI.solicitudes.eliminar(id);
    UI.toast('Solicitud eliminada.', 'exito');
    await cargarTodo();
  } catch (err) {
    UI.toast(err.message, 'error');
  }
}

/* ===================== EVENTOS ===================== */
function configurarEventos() {
  $('#nav-admin').addEventListener('click', e => {
    const b = e.target.closest('[data-vista]');
    if (b) mostrarVista(b.dataset.vista);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if (!b) return;
    if (b.dataset.filtroEstado) { $('#filtro-estado-servicio').value = b.dataset.filtroEstado; pintarServicios(); }
    mostrarVista(b.dataset.ir);
  });

  // Filtros en tiempo real
  ['#buscar-usuario', '#filtro-rol', '#filtro-estado-usuario'].forEach(s => $(s).addEventListener('input', pintarUsuarios));
  ['#buscar-servicio', '#filtro-categoria', '#filtro-estado-servicio'].forEach(s => $(s).addEventListener('input', pintarServicios));
  ['#buscar-solicitud', '#filtro-estado-solicitud'].forEach(s => $(s).addEventListener('input', pintarSolicitudes));

  // Formularios
  $('#btn-nuevo-usuario').addEventListener('click', () => abrirFormularioUsuario());
  $('#btn-nuevo-servicio').addEventListener('click', () => abrirFormularioServicio());
  $('#form-usuario').addEventListener('submit', guardarUsuario);
  $('#form-usuario').rol.addEventListener('change', alternarCamposTrabajador);
  $('#form-servicio').addEventListener('submit', guardarServicio);

  // Resumen: moderación rápida
  $('#lista-moderacion').addEventListener('click', e => {
    const mod = e.target.closest('[data-moderar]');
    if (mod) { moderarServicio(Number(mod.closest('[data-servicio]').dataset.servicio), mod.dataset.moderar); return; }
    const ver = e.target.closest('[data-verificar]');
    if (ver) actualizarUsuarioRapido(Number(ver.closest('[data-usuario]').dataset.usuario), { verificado: true }, 'Trabajador verificado.');
  });

  // Tabla de usuarios
  $('#tabla-usuarios').addEventListener('click', e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    const id = Number(accion.closest('[data-usuario]').dataset.usuario);
    const u = estado.usuarios.find(x => x.id === id);
    if (accion.dataset.accion === 'editar') abrirFormularioUsuario(u);
    if (accion.dataset.accion === 'eliminar') eliminarUsuario(id);
    if (accion.dataset.accion === 'suspender') {
      const nuevo = u.estado === 'ACTIVO' ? 'SUSPENDIDO' : 'ACTIVO';
      actualizarUsuarioRapido(id, { estado: nuevo }, nuevo === 'SUSPENDIDO' ? 'Usuario suspendido.' : 'Usuario reactivado.');
    }
  });
  $('#tabla-usuarios').addEventListener('change', e => {
    if (!e.target.matches('[data-verificar]')) return;
    const id = Number(e.target.closest('[data-usuario]').dataset.usuario);
    actualizarUsuarioRapido(id, { verificado: e.target.checked }, e.target.checked ? 'Trabajador verificado.' : 'Verificación retirada.');
  });

  // Tabla de servicios
  $('#tabla-servicios').addEventListener('click', e => {
    const accion = e.target.closest('[data-accion]');
    if (!accion) return;
    const id = Number(accion.closest('[data-servicio]').dataset.servicio);
    if (accion.dataset.accion === 'editar') abrirFormularioServicio(estado.servicios.find(x => x.id === id));
    if (accion.dataset.accion === 'eliminar') eliminarServicio(id);
  });
  $('#tabla-servicios').addEventListener('change', e => {
    if (!e.target.matches('[data-cambiar-estado]')) return;
    moderarServicio(Number(e.target.closest('[data-servicio]').dataset.servicio), e.target.value);
  });

  // Tabla de solicitudes
  $('#tabla-solicitudes').addEventListener('change', e => {
    if (!e.target.matches('[data-cambiar-estado-solicitud]')) return;
    cambiarEstadoSolicitud(Number(e.target.closest('[data-solicitud]').dataset.solicitud), e.target.value);
  });
  $('#tabla-solicitudes').addEventListener('click', e => {
    const accion = e.target.closest('[data-accion="eliminar"]');
    if (accion) eliminarSolicitud(Number(accion.closest('[data-solicitud]').dataset.solicitud));
  });

  // Restablecer datos de demostración (solo afecta el modo local)
  $('#btn-restablecer').addEventListener('click', async () => {
    const ok = await UI.confirmar('Se borrarán los cambios guardados en este navegador y se recargarán los datos semilla. La base MySQL no se modifica.', {
      titulo: '¿Restablecer datos locales?', aceptar: 'Restablecer', peligro: true,
    });
    if (!ok) return;
    const s = Sesion.obtener();
    Store.inicializar(true);
    Sesion.iniciar(s);
    UI.toast('Datos de demostración restablecidos.', 'exito');
    await cargarTodo();
  });

  document.addEventListener('cercapp:recargar', cargarTodo);
}
