// Ruta: backend/src/main/java/com/cercapp/controller/UsuarioController.java
package com.cercapp.controller;

import com.cercapp.model.ServicioHogar;
import com.cercapp.model.Usuario;
import com.cercapp.repository.ServicioHogarRepository;
import com.cercapp.repository.UsuarioRepository;
import jakarta.validation.Valid;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * API REST de usuarios (administradores, trabajadores y clientes).
 *
 * GET    /api/usuarios?rol=TRABAJADOR        → listar (filtro de rol opcional)
 * GET    /api/usuarios/{id}                  → obtener uno
 * POST   /api/usuarios                       → crear / registrarse
 * PUT    /api/usuarios/{id}                  → actualizar
 * DELETE /api/usuarios/{id}                  → eliminar (cascada en BD)
 * POST   /api/usuarios/login                 → iniciar sesión
 * GET    /api/usuarios/{id}/favoritos        → favoritos del cliente
 * POST   /api/usuarios/{id}/favoritos/{sid}  → agregar favorito
 * DELETE /api/usuarios/{id}/favoritos/{sid}  → quitar favorito
 */
@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
public class UsuarioController {

    private final UsuarioRepository usuarioRepository;
    private final ServicioHogarRepository servicioRepository;

    public UsuarioController(UsuarioRepository usuarioRepository, ServicioHogarRepository servicioRepository) {
        this.usuarioRepository = usuarioRepository;
        this.servicioRepository = servicioRepository;
    }

    /** Datos que envía el formulario de inicio de sesión. */
    public record LoginRequest(String email, String password) { }

    // ============================== CRUD ==============================

    /** READ: lista todos los usuarios o solo los de un rol. */
    @GetMapping
    public List<Usuario> listar(@RequestParam(required = false) String rol) {
        if (rol == null || rol.isBlank()) {
            return usuarioRepository.findAll(Sort.by("id"));
        }
        return usuarioRepository.findByRolOrderByIdAsc(rol.trim().toUpperCase());
    }

    /** READ: obtiene un usuario por id (404 si no existe). */
    @GetMapping("/{id}")
    public Usuario obtener(@PathVariable Long id) {
        return buscarUsuario(id);
    }

    /** CREATE: registra un usuario nuevo. La contraseña es obligatoria y el correo debe ser único. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Usuario crear(@Valid @RequestBody Usuario usuario) {
        if (usuario.getPassword() == null || usuario.getPassword().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La contraseña es obligatoria (mínimo 6 caracteres).");
        }
        if (usuarioRepository.existsByEmailIgnoreCase(usuario.getEmail().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un usuario registrado con ese correo.");
        }
        usuario.setId(null);
        normalizar(usuario);
        return usuarioRepository.save(usuario);
    }

    /** UPDATE: reemplaza los datos editables. Si la contraseña llega vacía se conserva la actual. */
    @PutMapping("/{id}")
    public Usuario actualizar(@PathVariable Long id, @Valid @RequestBody Usuario datos) {
        Usuario actual = buscarUsuario(id);
        String nuevoEmail = datos.getEmail().trim();
        if (!actual.getEmail().equalsIgnoreCase(nuevoEmail) && usuarioRepository.existsByEmailIgnoreCase(nuevoEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro usuario con ese correo.");
        }
        actual.setNombre(datos.getNombre());
        actual.setEmail(nuevoEmail);
        actual.setTelefono(datos.getTelefono());
        actual.setRol(datos.getRol());
        actual.setCiudad(datos.getCiudad());
        actual.setBarrio(datos.getBarrio());
        actual.setDireccion(datos.getDireccion());
        actual.setEspecialidad(datos.getEspecialidad());
        actual.setAniosExperiencia(datos.getAniosExperiencia());
        if (datos.getVerificado() != null) actual.setVerificado(datos.getVerificado());
        if (datos.getEstado() != null) actual.setEstado(datos.getEstado());
        if (datos.getPassword() != null && !datos.getPassword().isBlank()) {
            actual.setPassword(datos.getPassword());
        }
        normalizar(actual);
        return usuarioRepository.save(actual);
    }

    /** DELETE: elimina el usuario. La BD borra en cascada sus servicios, favoritos y solicitudes. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        if (!usuarioRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado.");
        }
        usuarioRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ============================== LOGIN ==============================

    /**
     * Inicio de sesión básico por correo y contraseña.
     * Nota: proyecto académico sin cifrado; en producción use Spring Security + BCrypt + JWT.
     */
    @PostMapping("/login")
    public Usuario login(@RequestBody LoginRequest req) {
        if (req == null || req.email() == null || req.password() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Correo y contraseña son obligatorios.");
        }
        Usuario usuario = usuarioRepository.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> u.getPassword().equals(req.password()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos."));
        if ("SUSPENDIDO".equals(usuario.getEstado())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu cuenta está suspendida. Contacta al administrador.");
        }
        return usuario;
    }

    // ============================== FAVORITOS ==============================

    /** Lista los servicios favoritos de un cliente. */
    @GetMapping("/{id}/favoritos")
    @Transactional(readOnly = true)
    public List<ServicioHogar> favoritos(@PathVariable Long id) {
        return ordenar(buscarUsuario(id).getFavoritos());
    }

    /** Agrega un servicio a los favoritos del cliente (idempotente). */
    @PostMapping("/{id}/favoritos/{servicioId}")
    @Transactional
    public List<ServicioHogar> agregarFavorito(@PathVariable Long id, @PathVariable Long servicioId) {
        Usuario cliente = buscarUsuario(id);
        if (!"CLIENTE".equals(cliente.getRol())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo los clientes pueden guardar favoritos.");
        }
        ServicioHogar servicio = servicioRepository.findById(servicioId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Servicio no encontrado."));
        cliente.getFavoritos().add(servicio);
        usuarioRepository.save(cliente);
        return ordenar(cliente.getFavoritos());
    }

    /** Quita un servicio de los favoritos del cliente. */
    @DeleteMapping("/{id}/favoritos/{servicioId}")
    @Transactional
    public List<ServicioHogar> quitarFavorito(@PathVariable Long id, @PathVariable Long servicioId) {
        Usuario cliente = buscarUsuario(id);
        cliente.getFavoritos().removeIf(s -> s.getId().equals(servicioId));
        usuarioRepository.save(cliente);
        return ordenar(cliente.getFavoritos());
    }

    // ============================== AUXILIARES ==============================

    private Usuario buscarUsuario(Long id) {
        return usuarioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado."));
    }

    /** Limpia espacios y aplica valores por defecto coherentes. */
    private void normalizar(Usuario u) {
        u.setNombre(u.getNombre().trim());
        u.setEmail(u.getEmail().trim().toLowerCase());
        if (u.getCiudad() == null || u.getCiudad().isBlank()) u.setCiudad("Neiva");
        if (u.getEstado() == null || u.getEstado().isBlank()) u.setEstado("ACTIVO");
        if (u.getVerificado() == null) u.setVerificado(false);
        if (!"TRABAJADOR".equals(u.getRol())) {
            // Especialidad y experiencia solo tienen sentido para trabajadores
            u.setEspecialidad(null);
            u.setAniosExperiencia(null);
        }
    }

    private List<ServicioHogar> ordenar(java.util.Collection<ServicioHogar> servicios) {
        List<ServicioHogar> lista = new ArrayList<>(servicios);
        lista.sort(Comparator.comparing(ServicioHogar::getId));
        return lista;
    }
}
