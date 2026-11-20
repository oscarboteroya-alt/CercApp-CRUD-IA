// Ruta: backend/src/main/java/com/cercapp/repository/UsuarioRepository.java
package com.cercapp.repository;

import com.cercapp.model.Usuario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Acceso a la tabla "usuarios". Spring Data genera la implementación a partir
 * del nombre de cada método.
 */
@Repository
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    /** Login y búsquedas por correo (sin distinguir mayúsculas). */
    Optional<Usuario> findByEmailIgnoreCase(String email);

    /** Evita registrar dos cuentas con el mismo correo. */
    boolean existsByEmailIgnoreCase(String email);

    /** Lista por rol: ADMIN, TRABAJADOR o CLIENTE. */
    List<Usuario> findByRolOrderByIdAsc(String rol);
}
