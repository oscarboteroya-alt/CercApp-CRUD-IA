// Ruta: backend/src/main/java/com/cercapp/model/Solicitud.java
package com.cercapp.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Solicitud de un servicio del hogar hecha por un cliente.
 * Flujo de estados: PENDIENTE → ACEPTADA → EN_CAMINO → EN_EJECUCION → COMPLETADA (o CANCELADA).
 * Al completarse, el cliente puede calificar (1 a 5), lo que actualiza el promedio del servicio.
 */
@Entity
@Table(name = "solicitudes")
public class Solicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull(message = "Debe indicar el cliente.")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    @JsonIgnoreProperties({"password", "favoritos", "hibernateLazyInitializer", "handler"})
    private Usuario cliente;

    @NotNull(message = "Debe indicar el servicio solicitado.")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "servicio_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private ServicioHogar servicio;

    @NotBlank(message = "Describa el problema o necesidad.")
    @Size(min = 20, max = 1000, message = "La descripción debe tener entre 20 y 1000 caracteres.")
    @Column(nullable = false, length = 1000)
    private String descripcion;

    @NotBlank(message = "La dirección es obligatoria.")
    @Size(min = 5, max = 150, message = "La dirección debe tener entre 5 y 150 caracteres.")
    @Column(nullable = false, length = 150)
    private String direccion;

    @Size(max = 80)
    @Column(length = 80)
    private String barrio;

    @NotNull(message = "La fecha preferida es obligatoria.")
    @Column(nullable = false)
    private LocalDate fechaPreferida;

    @NotBlank(message = "La franja horaria es obligatoria.")
    @Size(max = 40)
    @Column(nullable = false, length = 40)
    private String franjaHoraria;

    @Pattern(regexp = "PENDIENTE|ACEPTADA|EN_CAMINO|EN_EJECUCION|COMPLETADA|CANCELADA",
            message = "Estado de solicitud inválido.")
    @Column(nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @Min(value = 1, message = "La calificación mínima es 1.")
    @Max(value = 5, message = "La calificación máxima es 5.")
    private Integer calificacion;

    @Size(max = 500, message = "El comentario no puede superar 500 caracteres.")
    @Column(length = 500)
    private String comentario;

    @Column(nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @PrePersist
    protected void alCrear() {
        if (fechaCreacion == null) fechaCreacion = LocalDateTime.now();
        if (estado == null || estado.isBlank()) estado = "PENDIENTE";
    }

    // ----------------------------- Getters y setters -----------------------------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Usuario getCliente() { return cliente; }
    public void setCliente(Usuario cliente) { this.cliente = cliente; }

    public ServicioHogar getServicio() { return servicio; }
    public void setServicio(ServicioHogar servicio) { this.servicio = servicio; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getDireccion() { return direccion; }
    public void setDireccion(String direccion) { this.direccion = direccion; }

    public String getBarrio() { return barrio; }
    public void setBarrio(String barrio) { this.barrio = barrio; }

    public LocalDate getFechaPreferida() { return fechaPreferida; }
    public void setFechaPreferida(LocalDate fechaPreferida) { this.fechaPreferida = fechaPreferida; }

    public String getFranjaHoraria() { return franjaHoraria; }
    public void setFranjaHoraria(String franjaHoraria) { this.franjaHoraria = franjaHoraria; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public Integer getCalificacion() { return calificacion; }
    public void setCalificacion(Integer calificacion) { this.calificacion = calificacion; }

    public String getComentario() { return comentario; }
    public void setComentario(String comentario) { this.comentario = comentario; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
}
