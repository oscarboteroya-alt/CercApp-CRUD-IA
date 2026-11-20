// Ruta: backend/src/main/java/com/cercapp/CercAppApplication.java
package com.cercapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Punto de entrada del backend de CercApp.
 * Levanta el servidor embebido en http://localhost:8080 y expone la API en /api/**.
 */
@SpringBootApplication
public class CercAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(CercAppApplication.class, args);
    }
}
