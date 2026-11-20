// Ruta: backend/src/main/java/com/cercapp/model/Usuario.java
package com.cercapp.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Persona registrada en CercApp. El campo {@code rol} distingue los tres perfiles:
 * ADMIN, TRABAJADOR y CLIENTE.
 *
 * Relaciones:
 *  - Un TRABAJADOR ofrece N servicios del hogar (lado propietario: ServicioHogar.trabajador).
 *  - Un CLIENTE marca N servicios como favoritos (tabla intermedia "favoritos").
 */
@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "El nombre es obligatorio.")
    @Size(min = 3, max = 100, message = "El nombre debe tener entre 3 y 100 caracteres.")
    @Column(nullable = false, length = 100)
    private String nombre;

    @NotBlank(message = "El correo es obligatorio.")
    @Email(message = "El correo no tiene un formato válido.")
    @Size(max = 120, message = "El correo no puede superar 120 caracteres.")
    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @NotBlank(message = "El teléfono es obligatorio.")
    @Pattern(regexp = "\\d{10}", message = "El teléfono debe tener exactamente 10 dígitos numéricos.")
    @Column(nullable = false, length = 10)
    private String telefono;

    /** Solo de escritura: se recibe en POST/PUT pero nunca se devuelve en el JSON. */
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    @Size(min = 6, max = 100, message = "La contraseña debe tener entre 6 y 100 caracteres.")
    @Column(nullable = false, length = 100)
    private String password;

    @NotBlank(message = "El rol es obligatorio.")
    @Pattern(regexp = "ADMIN|TRABAJADOR|CLIENTE", message = "Rol inválido (ADMIN, TRABAJADOR o CLIENTE).")
    @Column(nullable = false, length = 20)
    private String rol;

    @Size(max = 60)
    @Column(nullable = false, length = 60)
    private String ciudad = "Neiva";

    @Size(max = 80)
    @Column(length = 80)
    private String barrio;

    @Size(max = 150)
    @Column(length = 150)
    private String direccion;

    /** Solo aplica a trabajadores (ej. "Plomería e instalaciones hidráulicas"). */
    @Size(max = 120)
    @Column(length = 120)
    private String especialidad;

    @Min(value = 0, message = "Los años de experiencia no pueden ser negativos.")
    @Max(value = 60, message = "Los años de experiencia no pueden superar 60.")
    private Integer aniosExperiencia;

    /** Cédula y antecedentes revisados por el administrador. */
    @Column(nullable = false)
    private Boolean verificado = false;

    @Pattern(regexp = "ACTIVO|SUSPENDIDO", message = "Estado inválido (ACTIVO o SUSPENDIDO).")
    @Column(nullable = false, length = 20)
    private String estado = "ACTIVO";

    @Column(nullable = false, updatable = false)
    private LocalDateTime fechaRegistro;

    /** Servicios favoritos del cliente. Se excluye del JSON para evitar ciclos. */
    @JsonIgnore
    @ManyToMany
    @JoinTable(
            name = "favoritos",
            joinColumns = @JoinColumn(name = "cliente_id"),
            inverseJoinColumns = @JoinColumn(name = "servicio_id"))
    private Set<ServicioHogar> favoritos = new HashSet<>();

    /** Valores por defecto antes de insertar. */
    @PrePersist
    protected void alCrear() {
        if (fechaRegistro == null) fechaRegistro = LocalDateTime.now();
        if (ciudad == null || ciudad.isBlank()) ciudad = "Neiva";
        if (verificado == null) verificado = false;
        if (estado == null || estado.isBlank()) estado = "ACTIVO";
    }

    // ----------------------------- Getters y setters -----------------------------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRol() { return rol; }
    public void setRol(String rol) { this.rol = rol; }

    public String getCiudad() { return ciudad; }
    public void setCiudad(String ciudad) { this.ciudad = ciudad; }

    public String getBarrio() { return barrio; }
    public void setBarrio(String barrio) { this.barrio = barrio; }

    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }

    public String getEspecialidad() { return especialidad; }
    public void setEspecialidad(String especialidad) { this.especialidad = especialidad; }

    public Integer getAniosExperiencia() { return aniosExperiencia; }
    public void setAniosExperiencia(Integer aniosExperiencia) { this.aniosExperiencia = aniosExperiencia; }

    public Boolean getVerificado() { return verificado; }
    public void setVerificado(Boolean verificado) { this.verificado = verificado; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public LocalDateTime getFechaRegistro() { return fechaRegistro; }
    public void setFechaRegistro(LocalDateTime fechaRegistro) { this.fechaRegistro = fechaRegistro; }

    public Set<ServicioHogar> getFavoritos() { return favoritos; }
    public void setFavoritos(Set<ServicioHogar> favoritos) { this.favoritos = favoritos; }
}
