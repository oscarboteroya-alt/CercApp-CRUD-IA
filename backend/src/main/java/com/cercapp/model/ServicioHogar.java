// Ruta: backend/src/main/java/com/cercapp/model/ServicioHogar.java
package com.cercapp.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Servicio del hogar publicado por un trabajador (plomería, electricidad, cerrajería, aseo...).
 *
 * Ciclo de moderación (campo {@code estado}):
 *   PENDIENTE → (admin) → PUBLICADO | RECHAZADO ;  PUBLICADO ↔ PAUSADO (trabajador)
 * Solo los servicios PUBLICADO aparecen en el catálogo del cliente.
 */
@Entity
@Table(name = "servicios_hogar")
public class ServicioHogar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "El título es obligatorio.")
    @Size(min = 5, max = 120, message = "El título debe tener entre 5 y 120 caracteres.")
    @Column(nullable = false, length = 120)
    private String titulo;

    @NotBlank(message = "La categoría es obligatoria.")
    @Pattern(regexp = "PLOMERIA|ELECTRICIDAD|CERRAJERIA|ASEO|CARPINTERIA|REPARACIONES|PINTURA|TECNOLOGIA",
            message = "Categoría inválida.")
    @Column(nullable = false, length = 30)
    private String categoria;

    @NotBlank(message = "La descripción es obligatoria.")
    @Size(min = 20, max = 1000, message = "La descripción debe tener entre 20 y 1000 caracteres.")
    @Column(nullable = false, length = 1000)
    private String descripcion;

    /** Tarifa base en pesos colombianos (COP). */
    @NotNull(message = "La tarifa es obligatoria.")
    @DecimalMin(value = "1000", message = "La tarifa mínima es $1.000 COP.")
    @DecimalMax(value = "10000000", message = "La tarifa máxima es $10.000.000 COP.")
    @Digits(integer = 10, fraction = 2, message = "La tarifa debe ser un valor numérico válido.")
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal tarifa;

    @Pattern(regexp = "VISITA|HORA|JORNADA", message = "Unidad de tarifa inválida (VISITA, HORA o JORNADA).")
    @Column(nullable = false, length = 20)
    private String unidadTarifa = "VISITA";

    @NotBlank(message = "La disponibilidad es obligatoria.")
    @Size(min = 5, max = 150, message = "La disponibilidad debe tener entre 5 y 150 caracteres.")
    @Column(nullable = false, length = 150)
    private String disponibilidad;

    /** Barrios o comunas de Neiva separados por coma. */
    @NotBlank(message = "Indique al menos un barrio de cobertura.")
    @Size(max = 300)
    @Column(nullable = false, length = 300)
    private String zonaCobertura;

    @Pattern(regexp = "PENDIENTE|PUBLICADO|RECHAZADO|PAUSADO", message = "Estado de publicación inválido.")
    @Column(nullable = false, length = 20)
    private String estado = "PENDIENTE";

    @DecimalMin("0.0")
    @DecimalMax("5.0")
    @Column(nullable = false)
    private Double calificacion = 0.0;

    @Min(0)
    @Column(nullable = false)
    private Integer numResenas = 0;

    /** Trabajador dueño del servicio. En el JSON de entrada basta con {"trabajador": {"id": 2}}. */
    @NotNull(message = "Debe indicar el trabajador que presta el servicio.")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "trabajador_id", nullable = false)
    @JsonIgnoreProperties({"password", "favoritos", "hibernateLazyInitializer", "handler"})
    private Usuario trabajador;

    @Column(nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @PrePersist
    protected void alCrear() {
        if (fechaCreacion == null) fechaCreacion = LocalDateTime.now();
        if (estado == null || estado.isBlank()) estado = "PENDIENTE";
        if (unidadTarifa == null || unidadTarifa.isBlank()) unidadTarifa = "VISITA";
        if (calificacion == null) calificacion = 0.0;
        if (numResenas == null) numResenas = 0;
    }

    // ----------------------------- Getters y setters -----------------------------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }

    public String getCategoria() { return categoria; }
    public void setCategoria(String categoria) { this.categoria = categoria; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public BigDecimal getTarifa() { return tarifa; }
    public void setTarifa(BigDecimal tarifa) { this.tarifa = tarifa; }

    public String getUnidadTarifa() { return unidadTarifa; }
    public void setUnidadTarifa(String unidadTarifa) { this.unidadTarifa = unidadTarifa; }

    public String getDisponibilidad() { return disponibilidad; }
    public void setDisponibilidad(String disponibilidad) { this.disponibilidad = disponibilidad; }

    public String getZonaCobertura() { return zonaCobertura; }
    public void setZonaCobertura(String zonaCobertura) { this.zonaCobertura = zonaCobertura; }

    public String getEstado() { return estado; }
    public void setEstado(String estado) { this.estado = estado; }

    public Double getCalificacion() { return calificacion; }
    public void setCalificacion(Double calificacion) { this.calificacion = calificacion; }

    public Integer getNumResenas() { return numResenas; }
    public void setNumResenas(Integer numResenas) { this.numResenas = numResenas; }

    public Usuario getTrabajador() { return trabajador; }
    public void setTrabajador(Usuario trabajador) { this.trabajador = trabajador; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
}
