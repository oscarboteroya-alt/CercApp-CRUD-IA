-- Ruta: database/schema.sql
-- =====================================================================
-- CercApp - Base de datos de servicios del hogar (Neiva, Huila)
-- Motor: MySQL 8.0.16 o superior (necesario para las restricciones CHECK)
-- Uso: abra este archivo en MySQL Workbench y ejecútelo completo (rayo ⚡).
-- ATENCIÓN: elimina y vuelve a crear la base de datos cercapp_db.
-- =====================================================================

DROP DATABASE IF EXISTS cercapp_db;
CREATE DATABASE cercapp_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE cercapp_db;

-- ---------------------------------------------------------------------
-- 1. USUARIOS: administradores, trabajadores y clientes en una sola tabla
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id                 BIGINT       NOT NULL AUTO_INCREMENT,
  nombre             VARCHAR(100) NOT NULL,
  email              VARCHAR(120) NOT NULL,
  telefono           CHAR(10)     NOT NULL,
  password           VARCHAR(100) NOT NULL,
  rol                VARCHAR(20)  NOT NULL,
  ciudad             VARCHAR(60)  NOT NULL DEFAULT 'Neiva',
  barrio             VARCHAR(80)  NULL,
  direccion          VARCHAR(150) NULL,
  especialidad       VARCHAR(120) NULL,
  anios_experiencia  INT          NULL,
  verificado         BOOLEAN      NOT NULL DEFAULT FALSE,
  estado             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO',
  fecha_registro     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_usuarios PRIMARY KEY (id),
  CONSTRAINT uq_usuarios_email UNIQUE (email),
  CONSTRAINT chk_usuarios_rol CHECK (rol IN ('ADMIN', 'TRABAJADOR', 'CLIENTE')),
  CONSTRAINT chk_usuarios_estado CHECK (estado IN ('ACTIVO', 'SUSPENDIDO')),
  CONSTRAINT chk_usuarios_telefono CHECK (telefono REGEXP '^[0-9]{10}$'),
  CONSTRAINT chk_usuarios_anios CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 60)
) ENGINE = InnoDB;

CREATE INDEX idx_usuarios_rol ON usuarios (rol);

-- ---------------------------------------------------------------------
-- 2. SERVICIOS DEL HOGAR: cada uno pertenece a un trabajador (1:N)
-- ---------------------------------------------------------------------
CREATE TABLE servicios_hogar (
  id              BIGINT        NOT NULL AUTO_INCREMENT,
  trabajador_id   BIGINT        NOT NULL,
  titulo          VARCHAR(120)  NOT NULL,
  categoria       VARCHAR(30)   NOT NULL,
  descripcion     VARCHAR(1000) NOT NULL,
  tarifa          DECIMAL(12,2) NOT NULL,
  unidad_tarifa   VARCHAR(20)   NOT NULL DEFAULT 'VISITA',
  disponibilidad  VARCHAR(150)  NOT NULL,
  zona_cobertura  VARCHAR(300)  NOT NULL,
  estado          VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
  calificacion    DECIMAL(2,1)  NOT NULL DEFAULT 0.0,
  num_resenas     INT           NOT NULL DEFAULT 0,
  fecha_creacion  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_servicios PRIMARY KEY (id),
  CONSTRAINT fk_servicios_trabajador FOREIGN KEY (trabajador_id)
    REFERENCES usuarios (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_servicios_categoria CHECK (categoria IN
    ('PLOMERIA', 'ELECTRICIDAD', 'CERRAJERIA', 'ASEO', 'CARPINTERIA', 'REPARACIONES', 'PINTURA', 'TECNOLOGIA')),
  CONSTRAINT chk_servicios_tarifa CHECK (tarifa BETWEEN 1000 AND 10000000),
  CONSTRAINT chk_servicios_unidad CHECK (unidad_tarifa IN ('VISITA', 'HORA', 'JORNADA')),
  CONSTRAINT chk_servicios_estado CHECK (estado IN ('PENDIENTE', 'PUBLICADO', 'RECHAZADO', 'PAUSADO')),
  CONSTRAINT chk_servicios_calificacion CHECK (calificacion BETWEEN 0 AND 5),
  CONSTRAINT chk_servicios_resenas CHECK (num_resenas >= 0)
) ENGINE = InnoDB;

CREATE INDEX idx_servicios_categoria ON servicios_hogar (categoria);
CREATE INDEX idx_servicios_estado ON servicios_hogar (estado);

-- ---------------------------------------------------------------------
-- 3. FAVORITOS: relación N:M entre clientes y servicios
-- ---------------------------------------------------------------------
CREATE TABLE favoritos (
  cliente_id      BIGINT   NOT NULL,
  servicio_id     BIGINT   NOT NULL,
  fecha_agregado  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_favoritos PRIMARY KEY (cliente_id, servicio_id),
  CONSTRAINT fk_favoritos_cliente FOREIGN KEY (cliente_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_favoritos_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios_hogar (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. SOLICITUDES: servicios solicitados por los clientes
-- ---------------------------------------------------------------------
CREATE TABLE solicitudes (
  id               BIGINT        NOT NULL AUTO_INCREMENT,
  cliente_id       BIGINT        NOT NULL,
  servicio_id      BIGINT        NOT NULL,
  descripcion      VARCHAR(1000) NOT NULL,
  direccion        VARCHAR(150)  NOT NULL,
  barrio           VARCHAR(80)   NULL,
  fecha_preferida  DATE          NOT NULL,
  franja_horaria   VARCHAR(40)   NOT NULL,
  estado           VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',
  calificacion     TINYINT       NULL,
  comentario       VARCHAR(500)  NULL,
  fecha_creacion   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_solicitudes PRIMARY KEY (id),
  CONSTRAINT fk_solicitudes_cliente FOREIGN KEY (cliente_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_solicitudes_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios_hogar (id) ON DELETE CASCADE,
  CONSTRAINT chk_solicitudes_estado CHECK (estado IN
    ('PENDIENTE', 'ACEPTADA', 'EN_CAMINO', 'EN_EJECUCION', 'COMPLETADA', 'CANCELADA')),
  CONSTRAINT chk_solicitudes_calificacion CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5)
) ENGINE = InnoDB;

CREATE INDEX idx_solicitudes_estado ON solicitudes (estado);

-- =====================================================================
-- DATOS SEMILLA (los mismos que usa el modo local del frontend)
-- Contraseñas de demostración en texto plano: SOLO para pruebas.
-- =====================================================================

INSERT INTO usuarios (id, nombre, email, telefono, password, rol, barrio, direccion, especialidad, anios_experiencia, verificado, estado, fecha_registro) VALUES
(1,  'Administrador CercApp',   'admin@cercapp.co',              '3001112233', 'admin123',      'ADMIN',      'Centro',            'Carrera 5 # 8-20',          NULL, NULL, TRUE,  'ACTIVO',     '2026-01-10 08:00:00'),
(2,  'Carlos Méndez',           'carlos.mendez@cercapp.co',      '3104567890', 'trabajador123', 'TRABAJADOR', 'Quirinal',          'Calle 21 # 6-14',           'Plomería e instalaciones hidráulicas',        9,  TRUE,  'ACTIVO',     '2026-02-03 09:15:00'),
(3,  'Andrea Dussán',           'andrea.dussan@cercapp.co',      '3157894561', 'trabajador123', 'TRABAJADOR', 'Las Granjas',       'Carrera 30 # 45-10',        'Aseo y desinfección de vivienda',             6,  TRUE,  'ACTIVO',     '2026-02-11 10:30:00'),
(4,  'Jorge Trujillo',          'jorge.trujillo@cercapp.co',     '3112345678', 'trabajador123', 'TRABAJADOR', 'Altico',            'Calle 7 # 12-33',           'Reparación de electrodomésticos y equipos',   12, TRUE,  'ACTIVO',     '2026-02-20 14:00:00'),
(5,  'Diego Fernando Rivera',   'diego.rivera@cercapp.co',       '3168765432', 'trabajador123', 'TRABAJADOR', 'Prado Alto',        'Carrera 9 # 15-60',         'Plomería y redes hidráulicas',                7,  TRUE,  'ACTIVO',     '2026-03-02 11:45:00'),
(6,  'Luisa Fernanda Perdomo',  'luisa.perdomo@cercapp.co',      '3209876543', 'trabajador123', 'TRABAJADOR', 'Ipanema',           'Calle 34 # 18-05',          'Electricista residencial certificada RETIE',  8,  TRUE,  'ACTIVO',     '2026-03-15 16:20:00'),
(7,  'Hernán Cabrera',          'hernan.cabrera@cercapp.co',     '3173334455', 'trabajador123', 'TRABAJADOR', 'Centro',            'Carrera 4 # 10-48',         'Cerrajería residencial',                      15, FALSE, 'ACTIVO',     '2026-04-01 08:40:00'),
(8,  'Yesid Polanía',           'yesid.polania@cercapp.co',      '3185556677', 'trabajador123', 'TRABAJADOR', 'Cándido Leguízamo', 'Calle 64 # 2-30',           'Carpintería y ebanistería',                   10, TRUE,  'ACTIVO',     '2026-04-18 13:10:00'),
(9,  'Martha Liliana Charry',   'martha.charry@cercapp.co',      '3137778899', 'trabajador123', 'TRABAJADOR', 'Santa Inés',        'Carrera 22 # 26-11',        'Pintura y acabados de interiores',            5,  FALSE, 'ACTIVO',     '2026-10-28 17:05:00'),
(10, 'Sebastián Rojas',         'sebastian.rojas@correo.com',    '3201234567', 'cliente123',    'CLIENTE',    'Ipanema',           'Calle 14 # 22-45',          NULL, NULL, FALSE, 'ACTIVO',     '2026-05-06 19:00:00'),
(11, 'María Fernanda Ramírez',  'mafe.ramirez@correo.com',       '3189876543', 'cliente123',    'CLIENTE',    'Quirinal',          'Carrera 6 # 19-27',         NULL, NULL, FALSE, 'ACTIVO',     '2026-06-14 12:25:00'),
(12, 'Julián Andrés Vargas',    'julian.vargas@correo.com',      '3145550011', 'cliente123',    'CLIENTE',    'Las Granjas',       'Calle 50 # 31-08',          NULL, NULL, FALSE, 'SUSPENDIDO', '2026-07-21 15:50:00');

INSERT INTO servicios_hogar (id, trabajador_id, titulo, categoria, descripcion, tarifa, unidad_tarifa, disponibilidad, zona_cobertura, estado, calificacion, num_resenas, fecha_creacion) VALUES
(1,  2, 'Destape de cañerías y sifones', 'PLOMERIA',
     'Destape de lavaplatos, lavamanos, duchas y sifones de patio con sonda eléctrica y manual, sin romper baldosas. Incluye prueba de flujo al terminar.',
     45000, 'VISITA', 'Lunes a sábado · 7:00 a.m. – 7:00 p.m.', 'Quirinal, Ipanema, Prado Alto, Altico, Las Granjas', 'PUBLICADO', 4.9, 134, '2026-02-05 08:00:00'),
(2,  2, 'Reparación de fugas de agua', 'PLOMERIA',
     'Detección y reparación de fugas en tuberías, llaves de paso y registros. Impermeabilización puntual de muros afectados por humedad.',
     60000, 'VISITA', 'Todos los días · urgencias 24 horas', 'Quirinal, Ipanema, Prado Alto, Altico, Las Granjas', 'PUBLICADO', 4.9, 98, '2026-02-05 08:10:00'),
(3,  2, 'Grifería y sanitarios: montaje y cambio', 'PLOMERIA',
     'Instalación y cambio de grifería, sanitarios, herrajes de tanque y llaves de lavamanos. Garantía escrita de 30 días en mano de obra.',
     75000, 'VISITA', 'Lunes a sábado · 7:00 a.m. – 7:00 p.m.', 'Quirinal, Ipanema, Prado Alto', 'PUBLICADO', 4.8, 41, '2026-02-06 09:00:00'),
(4,  3, 'Aseo profundo y desinfección de vivienda', 'ASEO',
     'Limpieza profunda de cocina, baños, pisos y ventanas con productos desinfectantes. Ideal para entrega de apartamento o después de una obra.',
     60000, 'JORNADA', 'Martes a sábado · 8:00 a.m. – 5:00 p.m.', 'Las Granjas, Santa Inés, Calixto, Centro', 'PUBLICADO', 4.8, 98, '2026-02-12 10:00:00'),
(5,  4, 'Reparación de neveras y lavadoras', 'REPARACIONES',
     'Diagnóstico a domicilio y reparación de neveras, lavadoras y secadoras de todas las marcas. Repuestos originales con factura.',
     50000, 'VISITA', 'Lunes a viernes · 8:00 a.m. – 6:00 p.m.', 'Altico, Centro, Los Mártires, Quirinal', 'PUBLICADO', 5.0, 82, '2026-02-21 08:30:00'),
(6,  4, 'Mantenimiento de aire acondicionado', 'REPARACIONES',
     'Limpieza profunda de unidades tipo mini split, revisión de presiones y recarga de gas refrigerante para equipos inverter y convencionales.',
     85000, 'VISITA', 'Lunes a sábado · 8:00 a.m. – 5:00 p.m.', 'Altico, Centro, Los Mártires, Quirinal, Ipanema', 'PUBLICADO', 4.9, 37, '2026-03-01 09:30:00'),
(7,  5, 'Instalación de calentadores a gas', 'PLOMERIA',
     'Instalación y mantenimiento de calentadores de paso a gas, filtros de agua ozonizada y reemplazo de tuberías PVC y CPVC.',
     50000, 'VISITA', 'Lunes a sábado · 2:00 p.m. – 7:00 p.m.', 'Prado Alto, Centro, Quirinal', 'PUBLICADO', 4.7, 76, '2026-03-03 15:00:00'),
(8,  6, 'Revisión y arreglo de cortos eléctricos', 'ELECTRICIDAD',
     'Localización de cortocircuitos, cambio de breakers y revisión del tablero eléctrico de la vivienda cumpliendo la norma RETIE.',
     55000, 'VISITA', 'Lunes a sábado · 7:00 a.m. – 6:00 p.m.', 'Ipanema, Quirinal, Altico, Cándido Leguízamo', 'PUBLICADO', 4.9, 112, '2026-03-16 08:00:00'),
(9,  6, 'Instalación de lámparas, tomas e interruptores', 'ELECTRICIDAD',
     'Instalación de lámparas LED, ventiladores de techo, tomas dobles e interruptores, con revisión de polo a tierra incluida.',
     35000, 'HORA', 'Lunes a sábado · 7:00 a.m. – 6:00 p.m.', 'Ipanema, Quirinal, Altico', 'PUBLICADO', 4.8, 64, '2026-03-16 08:20:00'),
(10, 7, 'Apertura de puertas y cambio de guardas', 'CERRAJERIA',
     'Apertura de puertas sin daños, cambio de guardas y chapas de seguridad, duplicado de llaves e instalación de cerrojos.',
     40000, 'VISITA', 'Todos los días · 24 horas', 'Centro, Los Mártires, Santa Inés, Calixto, Altico', 'PUBLICADO', 4.6, 58, '2026-04-02 09:00:00'),
(11, 8, 'Reparación de puertas, clósets y muebles', 'CARPINTERIA',
     'Ajuste de bisagras, cambio de rieles de cajones, reparación de clósets y puertas de madera, lacado y restauración de muebles.',
     70000, 'VISITA', 'Lunes a viernes · 7:00 a.m. – 5:00 p.m.', 'Cándido Leguízamo, Las Granjas, Ipanema', 'PUBLICADO', 4.7, 29, '2026-04-19 10:00:00'),
(12, 9, 'Pintura de interiores por habitación', 'PINTURA',
     'Resane de grietas, lijado y aplicación de dos manos de pintura tipo 1 en paredes y techos. Materiales cotizados aparte.',
     180000, 'JORNADA', 'Lunes a sábado · 7:00 a.m. – 4:00 p.m.', 'Santa Inés, Calixto, Centro', 'PENDIENTE', 0.0, 0, '2026-10-29 08:00:00'),
(13, 4, 'Instalación de TV, soportes y red WiFi del hogar', 'TECNOLOGIA',
     'Instalación de televisores en pared con soporte, organización de cableado y configuración de router y repetidores WiFi en casa.',
     65000, 'VISITA', 'Lunes a sábado · 9:00 a.m. – 6:00 p.m.', 'Altico, Centro, Quirinal, Ipanema', 'PUBLICADO', 4.8, 15, '2026-05-10 11:00:00'),
(14, 3, 'Lavado de muebles y colchones', 'ASEO',
     'Lavado en seco e inyección-succión de salas, sillas, colchones y tapetes. Secado rápido y eliminación de ácaros y olores.',
     90000, 'VISITA', 'Sábados y domingos · 8:00 a.m. – 4:00 p.m.', 'Las Granjas, Santa Inés, Calixto', 'PAUSADO', 4.7, 22, '2026-05-22 09:00:00');

INSERT INTO favoritos (cliente_id, servicio_id) VALUES
(10, 1),
(10, 8),
(11, 4);

INSERT INTO solicitudes (id, cliente_id, servicio_id, descripcion, direccion, barrio, fecha_preferida, franja_horaria, estado, calificacion, comentario, fecha_creacion) VALUES
(1, 10, 2,  'Tengo una fuga continua debajo del lavaplatos de la cocina que gotea hacia el mueble y ya empezó a hinchar la madera.',
     'Calle 14 # 22-45', 'Ipanema', '2026-11-20', '8:00 a.m. – 12:00 m.', 'EN_EJECUCION', NULL, NULL, '2026-11-18 08:30:00'),
(2, 10, 6,  'Limpieza profunda y recarga de gas del aire acondicionado de la habitación principal, enfría muy poco desde hace un mes.',
     'Calle 14 # 22-45', 'Ipanema', '2026-11-16', '2:00 p.m. – 6:00 p.m.', 'COMPLETADA', NULL, NULL, '2026-11-14 15:00:00'),
(3, 11, 4,  'Necesito aseo profundo del apartamento antes de entregarlo al arrendador: cocina, dos baños y ventanas.',
     'Carrera 6 # 19-27', 'Quirinal', '2026-11-24', '8:00 a.m. – 12:00 m.', 'PENDIENTE', NULL, NULL, '2026-11-19 09:10:00'),
(4, 11, 1,  'El lavamanos del baño social está totalmente tapado y el agua no baja, ya intenté con destapador sin resultado.',
     'Carrera 6 # 19-27', 'Quirinal', '2026-11-05', '8:00 a.m. – 12:00 m.', 'COMPLETADA', 5, 'Llegó puntual y solucionó todo rápido. Muy honesto con el precio.', '2026-11-04 18:40:00');

-- Ajusta los contadores AUTO_INCREMENT después de insertar ids explícitos
ALTER TABLE usuarios        AUTO_INCREMENT = 13;
ALTER TABLE servicios_hogar AUTO_INCREMENT = 15;
ALTER TABLE solicitudes     AUTO_INCREMENT = 5;

-- =====================================================================
-- VISTA DE APOYO: catálogo público con datos del trabajador
-- =====================================================================
CREATE OR REPLACE VIEW vista_catalogo_publico AS
SELECT s.id, s.titulo, s.categoria, s.tarifa, s.unidad_tarifa, s.zona_cobertura,
       s.calificacion, s.num_resenas, u.nombre AS trabajador, u.verificado, u.telefono
FROM servicios_hogar s
JOIN usuarios u ON u.id = s.trabajador_id
WHERE s.estado = 'PUBLICADO' AND u.estado = 'ACTIVO';

-- Consultas de verificación rápida (opcionales)
-- SELECT rol, COUNT(*) AS total FROM usuarios GROUP BY rol;
-- SELECT categoria, COUNT(*) AS servicios FROM servicios_hogar WHERE estado = 'PUBLICADO' GROUP BY categoria;
-- SELECT * FROM vista_catalogo_publico ORDER BY calificacion DESC;
