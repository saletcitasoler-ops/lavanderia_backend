-- 1. TABLA DE CLIENTES
-- Almacena la información de cada cliente una sola vez.
CREATE TABLE IF NOT EXISTS clientes (
    cliente_id SERIAL PRIMARY KEY,
    nombre_completo VARCHAR(100) NOT NULL,
    contacto_celular VARCHAR(50) UNIQUE, -- El celular puede ser un identificador único
    email VARCHAR(100) UNIQUE,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE PROVEEDORES
-- (Sin cambios, la estructura original es correcta)
CREATE TABLE IF NOT EXISTS proveedores (
    proveedor_id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    contacto TEXT
);

-- 3. TABLA DE USUARIOS DEL SISTEMA
-- (Sin cambios, la estructura original es correcta)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL
);

-- 4. TABLA DE TRABAJOS (Pedidos)
-- Ahora se conecta con la tabla de clientes a través de 'cliente_id'.
CREATE TABLE IF NOT EXISTS trabajos (
    boleta_id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY (START WITH 50000),
    
    -- Clave foránea que conecta con el cliente
    cliente_id INT NOT NULL,

    -- Detalles del servicio (sin cambios)
    tipo_prenda VARCHAR(20) NOT NULL CHECK (tipo_prenda IN ('Ropas', 'Edredón', 'Calzados', 'Tintorería')),
    servicio VARCHAR(20) NOT NULL CHECK (servicio IN ('Lavado', 'Planchado', 'Lavado y Planchado')),
    descripcion TEXT,

    -- Información de pago (sin cambios)
    monto_total DECIMAL(10, 2) NOT NULL,
    monto_recibido DECIMAL(10, 2) DEFAULT 0.00,
    forma_pago VARCHAR(20) NOT NULL CHECK (forma_pago IN ('Efectivo', 'Transferencia', 'QR/Tarjeta')),
    estado_pago VARCHAR(20) NOT NULL CHECK (estado_pago IN ('Pendiente', 'Pago parcial', 'Abonado')),

    -- Estado y fechas del trabajo (sin cambios)
    estado_stock VARCHAR(20) NOT NULL DEFAULT 'En Stock' CHECK (estado_stock IN ('En Stock', 'Entregado')),
    fecha_entrada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_salida TIMESTAMP,

    -- Definición de la relación con la tabla 'clientes'
    FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id)
);

-- 5. TABLA DE GASTOS
-- Se añade 'ON DELETE SET NULL' para que si se borra un proveedor, el gasto no se elimine.
CREATE TABLE IF NOT EXISTS gastos (
    gasto_id SERIAL PRIMARY KEY,
    proveedor_id INT,
    descripcion TEXT NOT NULL,
    costo DECIMAL(10, 2) NOT NULL,
    fecha_gasto TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(proveedor_id) ON DELETE SET NULL
);

-- 6. TABLA DE SESIONES DE CAJA (CORREGIDA Y MEJORADA)
-- Renombrada y reestructurada para funcionar correctamente.
CREATE TABLE IF NOT EXISTS caja_sesiones (
    sesion_id SERIAL PRIMARY KEY,
    fecha_sesion DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    estado VARCHAR(10) NOT NULL CHECK (estado IN ('Abierta', 'Cerrada')),
    
    -- Datos de la apertura
    monto_inicial DECIMAL(10, 2) NOT NULL,
    
    -- Datos del cierre (pueden ser nulos mientras la caja está abierta)
    ingresos_dia DECIMAL(10, 2),
    gastos_dia DECIMAL(10, 2),
    balance_final_esperado DECIMAL(10, 2)
);

-- Reiniciar la secuencia de la boleta para que comience en 50000
ALTER SEQUENCE trabajos_boleta_id_seq RESTART WITH 50000;