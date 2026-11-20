// Ruta: backend/src/main/java/com/cercapp/controller/ApiExceptionHandler.java
package com.cercapp.controller;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Convierte las excepciones en respuestas JSON uniformes:
 *   { "mensaje": "texto legible", "errores": { "campo": "detalle" } }
 * El frontend muestra "mensaje" en un aviso y pinta "errores" bajo cada campo del formulario.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** Errores de @Valid (campos vacíos, teléfono sin 10 dígitos, tarifa fuera de rango...). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacion(MethodArgumentNotValidException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> errores.putIfAbsent(e.getField(), e.getDefaultMessage()));
        return cuerpo(HttpStatus.BAD_REQUEST, "Revisa los campos marcados.", errores);
    }

    /** Validaciones que Hibernate ejecuta al guardar la entidad. */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> restriccion(ConstraintViolationException ex) {
        Map<String, String> errores = new LinkedHashMap<>();
        ex.getConstraintViolations()
                .forEach(v -> errores.putIfAbsent(v.getPropertyPath().toString(), v.getMessage()));
        return cuerpo(HttpStatus.BAD_REQUEST, "Revisa los campos marcados.", errores);
    }

    /** Errores de negocio lanzados en los controladores (404, 409, 401...). */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> negocio(ResponseStatusException ex) {
        HttpStatus estado = HttpStatus.resolve(ex.getStatusCode().value());
        return cuerpo(estado == null ? HttpStatus.BAD_REQUEST : estado, ex.getReason(), null);
    }

    /** JSON mal formado, por ejemplo letras en un campo numérico o una fecha inválida. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> jsonInvalido(HttpMessageNotReadableException ex) {
        return cuerpo(HttpStatus.BAD_REQUEST,
                "Formato de datos inválido: revisa los campos numéricos y las fechas.", null);
    }

    /** Violación de llaves únicas o foráneas en MySQL. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> integridad(DataIntegrityViolationException ex) {
        return cuerpo(HttpStatus.CONFLICT,
                "La operación viola una restricción de la base de datos (dato duplicado o referencia inexistente).", null);
    }

    private ResponseEntity<Map<String, Object>> cuerpo(HttpStatus estado, String mensaje, Map<String, String> errores) {
        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("estado", estado.value());
        respuesta.put("mensaje", mensaje);
        if (errores != null && !errores.isEmpty()) respuesta.put("errores", errores);
        return ResponseEntity.status(estado).body(respuesta);
    }
}
