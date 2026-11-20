// Ruta: backend/src/main/java/com/cercapp/repository/ServicioHogarRepository.java
package com.cercapp.repository;

import com.cercapp.model.ServicioHogar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Acceso a la tabla "servicios_hogar".
 */
@Repository
public interface ServicioHogarRepository extends JpaRepository<ServicioHogar, Long> {

    /** Servicios que ofrece un trabajador concreto (panel del trabajador). */
    List<ServicioHogar> findByTrabajadorIdOrderByIdAsc(Long trabajadorId);

    /**
     * Búsqueda con filtros opcionales: cualquier parámetro nulo se ignora.
     * {@code patron} debe llegar en minúsculas y con comodines, por ejemplo "%fuga%".
     */
    @Query("""
            SELECT s FROM ServicioHogar s
            WHERE (:categoria IS NULL OR s.categoria = :categoria)
              AND (:estado IS NULL OR s.estado = :estado)
              AND (:trabajadorId IS NULL OR s.trabajador.id = :trabajadorId)
              AND (:patron IS NULL
                   OR LOWER(s.titulo) LIKE :patron
                   OR LOWER(s.descripcion) LIKE :patron
                   OR LOWER(s.zonaCobertura) LIKE :patron)
            ORDER BY s.calificacion DESC, s.id ASC
            """)
    List<ServicioHogar> buscar(@Param("categoria") String categoria,
                               @Param("estado") String estado,
                               @Param("trabajadorId") Long trabajadorId,
                               @Param("patron") String patron);
}
