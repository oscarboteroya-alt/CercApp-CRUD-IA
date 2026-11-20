// Ruta: backend/src/main/java/com/cercapp/repository/SolicitudRepository.java
package com.cercapp.repository;

import com.cercapp.model.Solicitud;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Acceso a la tabla "solicitudes".
 */
@Repository
public interface SolicitudRepository extends JpaRepository<Solicitud, Long> {

    /** Historial del cliente ("Mis solicitudes"). */
    List<Solicitud> findByClienteIdOrderByFechaCreacionDesc(Long clienteId);

    /** Solicitudes recibidas por un trabajador (navega servicio.trabajador.id). */
    List<Solicitud> findByServicioTrabajadorIdOrderByFechaCreacionDesc(Long trabajadorId);
}
