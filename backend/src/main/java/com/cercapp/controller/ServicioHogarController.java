// Ruta: backend/src/main/java/com/cercapp/controller/ServicioHogarController.java
package com.cercapp.controller;

import com.cercapp.model.ServicioHogar;
import com.cercapp.model.Usuario;
import com.cercapp.repository.ServicioHogarRepository;
import com.cercapp.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * API REST de servicios del hogar.
 *
 * GET    /api/servicios?categoria=&estado=&trabajadorId=&q=  → listar con filtros opcionales
 * GET    /api/servicios/{id}                                → obtener uno
 * POST   /api/servicios                                     → crear (queda PENDIENTE de moderación)
 * PUT    /api/servicios/{id}                                → actualizar (incluye cambio de estado / moderación)
 * DELETE /api/servicios/{id}                                → eliminar
 */
@RestController
@RequestMapping("/api/servicios")
@CrossOrigin(origins = "*")
public class ServicioHogarController {

    private final ServicioHogarRepository servicioRepository;
    private final UsuarioRepository usuarioRepository;

    public ServicioHogarController(ServicioHogarRepository servicioRepository, UsuarioRepository usuarioRepository) {
        this.servicioRepository = servicioRepository;
        this.usuarioRepository = usuarioRepository;
    }

    /** READ: listado con filtros. Los parámetros vacíos se ignoran. */
    @GetMapping
    public List<ServicioHogar> listar(@RequestParam(required = false) String categoria,
                                      @RequestParam(required = false) String estado,
                                      @RequestParam(required = false) Long trabajadorId,
                                      @RequestParam(required = false) String q) {
        String patron = vacioANulo(q) == null ? null : "%" + q.trim().toLowerCase() + "%";
        return servicioRepository.buscar(
                mayusculas(categoria), mayusculas(estado), trabajadorId, patron);
    }

    /** READ: obtiene un servicio por id. */
    @GetMapping("/{id}")
    public ServicioHogar obtener(@PathVariable Long id) {
        return buscarServicio(id);
    }

    /**
     * CREATE: publica un servicio nuevo. JSON mínimo esperado:
     * {"titulo":"...","categoria":"PLOMERIA","descripcion":"...","tarifa":45000,"unidadTarifa":"VISITA",
     *  "disponibilidad":"...","zonaCobertura":"Quirinal, Ipanema","trabajador":{"id":2}}
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServicioHogar crear(@Valid @RequestBody ServicioHogar servicio) {
        servicio.setId(null);
        servicio.setTrabajador(resolverTrabajador(servicio.getTrabajador()));
        if (servicio.getEstado() == null || servicio.getEstado().isBlank()) servicio.setEstado("PENDIENTE");
        // La reputación arranca en cero: solo cambia con calificaciones reales
        servicio.setCalificacion(0.0);
        servicio.setNumResenas(0);
        limpiar(servicio);
        return servicioRepository.save(servicio);
    }

    /** UPDATE: actualiza datos y estado. La calificación y el número de reseñas no se editan aquí. */
    @PutMapping("/{id}")
    public ServicioHogar actualizar(@PathVariable Long id, @Valid @RequestBody ServicioHogar datos) {
        ServicioHogar actual = buscarServicio(id);
        actual.setTitulo(datos.getTitulo());
        actual.setCategoria(datos.getCategoria());
        actual.setDescripcion(datos.getDescripcion());
        actual.setTarifa(datos.getTarifa());
        actual.setUnidadTarifa(datos.getUnidadTarifa());
        actual.setDisponibilidad(datos.getDisponibilidad());
        actual.setZonaCobertura(datos.getZonaCobertura());
        if (datos.getEstado() != null && !datos.getEstado().isBlank()) actual.setEstado(datos.getEstado());
        if (datos.getTrabajador() != null && datos.getTrabajador().getId() != null
                && !datos.getTrabajador().getId().equals(actual.getTrabajador().getId())) {
            actual.setTrabajador(resolverTrabajador(datos.getTrabajador()));
        }
        limpiar(actual);
        return servicioRepository.save(actual);
    }

    /** DELETE: elimina el servicio (la BD borra en cascada favoritos y solicitudes asociadas). */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!servicioRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Servicio no encontrado.");
        }
        servicioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ============================== AUXILIARES ==============================

    private ServicioHogar buscarServicio(Long id) {
        return servicioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Servicio no encontrado."));
    }

    /** Verifica que el usuario indicado exista, sea TRABAJADOR y no esté suspendido. */
    private Usuario resolverTrabajador(Usuario referencia) {
        if (referencia == null || referencia.getId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Debe indicar el trabajador que presta el servicio.");
        }
        Usuario trabajador = usuarioRepository.findById(referencia.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El trabajador indicado no existe."));
        if (!"TRABAJADOR".equals(trabajador.getRol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El usuario indicado no tiene rol TRABAJADOR.");
        }
        if ("SUSPENDIDO".equals(trabajador.getEstado())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "El trabajador está suspendido y no puede publicar servicios.");
        }
        return trabajador;
    }

    private void limpiar(ServicioHogar s) {
        s.setTitulo(s.getTitulo().trim());
        s.setDescripcion(s.getDescripcion().trim());
        s.setDisponibilidad(s.getDisponibilidad().trim());
        s.setZonaCobertura(s.getZonaCobertura().trim());
        if (s.getUnidadTarifa() == null || s.getUnidadTarifa().isBlank()) s.setUnidadTarifa("VISITA");
    }

    private static String vacioANulo(String v) {
        return (v == null || v.isBlank()) ? null : v;
    }

    private static String mayusculas(String v) {
        return vacioANulo(v) == null ? null : v.trim().toUpperCase();
    }
}
