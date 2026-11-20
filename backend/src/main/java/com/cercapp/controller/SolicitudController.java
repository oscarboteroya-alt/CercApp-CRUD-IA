// Ruta: backend/src/main/java/com/cercapp/controller/SolicitudController.java
package com.cercapp.controller;

import com.cercapp.model.ServicioHogar;
import com.cercapp.model.Solicitud;
import com.cercapp.model.Usuario;
import com.cercapp.repository.ServicioHogarRepository;
import com.cercapp.repository.SolicitudRepository;
import com.cercapp.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * API REST de solicitudes de servicio (pantallas "Solicitar servicio" y "Servicios contratados").
 *
 * GET    /api/solicitudes?clienteId=&trabajadorId=  → listar
 * GET    /api/solicitudes/{id}                      → obtener una
 * POST   /api/solicitudes                           → crear (cliente)
 * PUT    /api/solicitudes/{id}                      → cambiar estado / calificar
 * DELETE /api/solicitudes/{id}                      → eliminar
 */
@RestController
@RequestMapping("/api/solicitudes")
@CrossOrigin(origins = "*")
public class SolicitudController {

    private final SolicitudRepository solicitudRepository;
    private final UsuarioRepository usuarioRepository;
    private final ServicioHogarRepository servicioRepository;

    public SolicitudController(SolicitudRepository solicitudRepository,
                               UsuarioRepository usuarioRepository,
                               ServicioHogarRepository servicioRepository) {
        this.solicitudRepository = solicitudRepository;
        this.usuarioRepository = usuarioRepository;
        this.servicioRepository = servicioRepository;
    }

    /** READ: por cliente, por trabajador o todas (administrador). */
    @GetMapping
    public List<Solicitud> listar(@RequestParam(required = false) Long clienteId,
                                  @RequestParam(required = false) Long trabajadorId) {
        if (clienteId != null) return solicitudRepository.findByClienteIdOrderByFechaCreacionDesc(clienteId);
        if (trabajadorId != null) return solicitudRepository.findByServicioTrabajadorIdOrderByFechaCreacionDesc(trabajadorId);
        return solicitudRepository.findAll(Sort.by(Sort.Direction.DESC, "fechaCreacion"));
    }

    @GetMapping("/{id}")
    public Solicitud obtener(@PathVariable Long id) {
        return buscarSolicitud(id);
    }

    /** CREATE: el cliente solicita un servicio publicado para hoy o una fecha futura. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Solicitud crear(@Valid @RequestBody Solicitud solicitud) {
        Usuario cliente = usuarioRepository.findById(solicitud.getCliente().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El cliente indicado no existe."));
        if (!"CLIENTE".equals(cliente.getRol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo los clientes pueden solicitar servicios.");
        }
        ServicioHogar servicio = servicioRepository.findById(solicitud.getServicio().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El servicio indicado no existe."));
        if (!"PUBLICADO".equals(servicio.getEstado())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El servicio no está disponible en este momento.");
        }
        if (solicitud.getFechaPreferida().isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha preferida no puede estar en el pasado.");
        }
        solicitud.setId(null);
        solicitud.setCliente(cliente);
        solicitud.setServicio(servicio);
        solicitud.setEstado("PENDIENTE");
        solicitud.setCalificacion(null);
        solicitud.setComentario(null);
        return solicitudRepository.save(solicitud);
    }

    /**
     * UPDATE: avanza el estado (trabajador/admin) o registra la calificación (cliente).
     * La primera calificación de una solicitud COMPLETADA recalcula el promedio del servicio.
     */
    @PutMapping("/{id}")
    @Transactional
    public Solicitud actualizar(@PathVariable Long id, @Valid @RequestBody Solicitud datos) {
        Solicitud actual = buscarSolicitud(id);
        actual.setDescripcion(datos.getDescripcion());
        actual.setDireccion(datos.getDireccion());
        actual.setBarrio(datos.getBarrio());
        actual.setFechaPreferida(datos.getFechaPreferida());
        actual.setFranjaHoraria(datos.getFranjaHoraria());
        if (datos.getEstado() != null && !datos.getEstado().isBlank()) actual.setEstado(datos.getEstado());

        if (datos.getCalificacion() != null && actual.getCalificacion() == null) {
            if (!"COMPLETADA".equals(actual.getEstado())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo se pueden calificar servicios completados.");
            }
            actual.setCalificacion(datos.getCalificacion());
            actual.setComentario(datos.getComentario());
            actualizarReputacion(actual.getServicio(), datos.getCalificacion());
        }
        return solicitudRepository.save(actual);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!solicitudRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada.");
        }
        solicitudRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ============================== AUXILIARES ==============================

    private Solicitud buscarSolicitud(Long id) {
        return solicitudRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Solicitud no encontrada."));
    }

    /** Promedio incremental: nuevo = (promedio * n + nota) / (n + 1), redondeado a 1 decimal. */
    private void actualizarReputacion(ServicioHogar servicio, int nota) {
        int n = servicio.getNumResenas() == null ? 0 : servicio.getNumResenas();
        double promedio = servicio.getCalificacion() == null ? 0.0 : servicio.getCalificacion();
        double nuevo = (promedio * n + nota) / (n + 1);
        servicio.setCalificacion(Math.round(nuevo * 10.0) / 10.0);
        servicio.setNumResenas(n + 1);
        servicioRepository.save(servicio);
    }
}
