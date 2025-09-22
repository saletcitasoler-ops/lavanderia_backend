// server.js (Versión FINAL con corrección IPv4)
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const excel = require('exceljs');

const app = express();
const PORT = 5500;

// --- CONEXIÓN A LA BASE DE DATOS EN LA NUBE (SUPABASE) ---
// Modificado para forzar la conexión por IPv4 y solucionar el error ENETUNREACH
const pool = new Pool({
    user: 'postgres',
    host: 'db.dfmpyiucosdnzciqnzjy.supabase.co',
    database: 'postgres',
    password: 'telas2005', // ATENCIÓN: Mueve esto a variables de entorno en el futuro
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
    family: 4, // <-- Esta es la línea que soluciona el problema
});

app.use(express.json());
// Se comentan las líneas del frontend para que el backend funcione de forma independiente
// app.use(express.static(path.join(__dirname, '..', 'frontend'))); 
app.use(cors({
    origin: (origin, callback) => {
        callback(null, origin);
    },
    credentials: true
}));
app.use(session({
    secret: 'una_clave_secreta_muy_larga_y_unica',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: 'auto' }
}));

// Se comenta la ruta raíz para que no intente servir el index.html
// app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

// --- RUTAS API DE CAJA (ACTUALIZADAS) ---
app.get('/api/caja/estado', async (req, res) => {
    try {
        const query = "SELECT * FROM caja_sesiones WHERE fecha_sesion = CURRENT_DATE AND estado = 'Abierta'";
        const result = await pool.query(query);
        res.json({ abierta: result.rows.length > 0, datos: result.rows[0] });
    } catch (e) {
        console.error("Error en GET /api/caja/estado:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/caja/abrir', async (req, res) => {
    const { monto_inicial } = req.body;
    if (monto_inicial === undefined || isNaN(monto_inicial)) {
        return res.status(400).json({ error: 'Monto inicial inválido.' });
    }
    try {
        const query = "INSERT INTO caja_sesiones (monto_inicial, estado) VALUES ($1, 'Abierta') RETURNING *";
        await pool.query(query, [monto_inicial]);
        res.status(201).json({ message: 'Caja abierta con éxito.' });
    } catch (e) {
        console.error("Error al abrir la caja:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/caja/cerrar', async (req, res) => {
    const { ingresos_dia, gastos_dia, balance_final } = req.body;
    try {
        const query = "UPDATE caja_sesiones SET estado = 'Cerrada', ingresos_dia = $1, gastos_dia = $2, balance_final_esperado = $3 WHERE fecha_sesion = CURRENT_DATE AND estado = 'Abierta'";
        await pool.query(query, [ingresos_dia, gastos_dia, balance_final]);
        res.status(200).json({ message: 'Caja cerrada con éxito.' });
    } catch (e) {
        console.error("Error en POST /api/caja/cerrar:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- RUTAS API DE TRABAJOS (ACTUALIZADAS) ---
app.post('/api/trabajos', async (req, res) => {
    const {
        nombre_cliente, contacto_celular, email_cliente, tipo_prenda, servicio, descripcion,
        monto_total, monto_recibido, forma_pago, estado_pago,
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let clienteId;
        if (contacto_celular) {
            const clienteExistente = await client.query('SELECT cliente_id FROM clientes WHERE contacto_celular = $1', [contacto_celular]);
            if (clienteExistente.rows.length > 0) {
                clienteId = clienteExistente.rows[0].cliente_id;
            }
        }
        if (!clienteId) {
            const nuevoCliente = await client.query(
                'INSERT INTO clientes (nombre_completo, contacto_celular, email) VALUES ($1, $2, $3) RETURNING cliente_id',
                [nombre_cliente, contacto_celular || null, email_cliente || null]
            );
            clienteId = nuevoCliente.rows[0].cliente_id;
        }
        const query = 'INSERT INTO trabajos (cliente_id, tipo_prenda, servicio, descripcion, monto_total, monto_recibido, forma_pago, estado_pago) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING boleta_id';
        const result = await client.query(query, [
            clienteId, tipo_prenda, servicio, descripcion,
            monto_total, monto_recibido, forma_pago, estado_pago,
        ]);
        await client.query('COMMIT');
        res.status(201).json({ message: 'Trabajo registrado', boleta_id: result.rows[0].boleta_id });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error al registrar trabajo:", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.get('/api/trabajos', async (req, res) => {
    try {
        const query = `
            SELECT t.*, c.nombre_completo
            FROM trabajos t
            JOIN clientes c ON t.cliente_id = c.cliente_id
            WHERE t.estado_stock = 'En Stock' 
            ORDER BY t.fecha_entrada DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) {
        console.error("Error en GET /api/trabajos:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/trabajos/buscar', async (req, res) => {
    const { termino } = req.query;
    try {
        const query = `
            SELECT t.*, c.nombre_completo, TO_CHAR(t.fecha_salida, 'DD/MM/YYYY HH24:MI') as fecha_salida_f
            FROM trabajos t
            JOIN clientes c ON t.cliente_id = c.cliente_id
            WHERE CAST(t.boleta_id AS TEXT) ILIKE $1 OR c.nombre_completo ILIKE $1
            ORDER BY t.fecha_entrada DESC
        `;
        const result = await pool.query(query, [`%${termino}%`]);
        res.json(result.rows);
    } catch (e) {
        console.error("Error en GET /api/trabajos/buscar:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- OTRAS RUTAS ---
app.get('/api/caja/resumen-dia', async (req, res) => {
    try {
        const trabajosQuery = `
            SELECT t.*, c.nombre_completo
            FROM trabajos t
            JOIN clientes c ON t.cliente_id = c.cliente_id
            WHERE t.fecha_salida >= CURRENT_DATE AND t.estado_stock = 'Entregado'
        `;
        const gastosQuery = "SELECT * FROM gastos WHERE fecha_gasto >= CURRENT_DATE";
        const [trabajosResult, gastosResult] = await Promise.all([pool.query(trabajosQuery), pool.query(gastosQuery)]);
        const totalIngresosEfectivo = trabajosResult.rows
            .filter(t => t.forma_pago === 'Efectivo')
            .reduce((sum, t) => sum + Number(t.monto_recibido), 0);
        const totalIngresosElectronico = trabajosResult.rows
            .filter(t => t.forma_pago !== 'Efectivo')
            .reduce((sum, t) => sum + Number(t.monto_recibido), 0);
        const totalGastos = gastosResult.rows.reduce((sum, g) => sum + Number(g.costo), 0);
        res.json({
            detalleIngresos: trabajosResult.rows,
            detalleGastos: gastosResult.rows,
            totalIngresosEfectivo: totalIngresosEfectivo,
            totalIngresosElectronico: totalIngresosElectronico,
            totalGastos: totalGastos
        });
    } catch (e) {
        console.error('Error al generar resumen del día:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/trabajos/:id/entregar', async (req, res) => {
    const { id } = req.params;
    const { monto_cobrado, forma_pago_final } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateQuery = 'UPDATE trabajos SET estado_stock = $1, fecha_salida = CURRENT_TIMESTAMP WHERE boleta_id = $2 RETURNING *';
        const updateResult = await client.query(updateQuery, ['Entregado', id]);
        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Boleta no encontrada o ya entregada.' });
        }
        if (monto_cobrado > 0) {
            const trabajo = updateResult.rows[0];
            const nuevoMontoRecibido = Number(trabajo.monto_recibido) + Number(monto_cobrado);
            const nuevoEstadoPago = (nuevoMontoRecibido >= Number(trabajo.monto_total)) ? 'Abonado' : 'Pago parcial';
            const cobroQuery = 'UPDATE trabajos SET monto_recibido = $1, estado_pago = $2, forma_pago = $3 WHERE boleta_id = $4';
            await client.query(cobroQuery, [nuevoMontoRecibido, nuevoEstadoPago, forma_pago_final, id]);
        }
        await client.query('COMMIT');
        res.status(200).json({ message: 'Trabajo entregado y cobro registrado con éxito.' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error al entregar trabajo:", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.get('/api/trabajos/entregados-hoy', async (req, res) => {
    try {
        const query = `
            SELECT t.*, c.nombre_completo, TO_CHAR(t.fecha_salida, 'HH24:MI') as hora_salida 
            FROM trabajos t
            JOIN clientes c ON t.cliente_id = c.cliente_id
            WHERE t.estado_stock = 'Entregado' AND t.fecha_salida >= CURRENT_DATE 
            ORDER BY t.fecha_salida DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) {
        console.error("Error en GET /api/trabajos/entregados-hoy:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/proveedores', async (req, res) => {
    try {
        const query = 'SELECT * FROM proveedores ORDER BY nombre ASC';
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) {
        console.error("Error en GET /api/proveedores:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/gastos', async (req, res) => {
    const { descripcion, proveedor_id, costo } = req.body;
    try {
        const query = 'INSERT INTO gastos (descripcion, proveedor_id, costo) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(query, [descripcion, proveedor_id || null, costo]);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        console.error("Error en POST /api/gastos:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/gastos', async (req, res) => {
    try {
        const query = `
            SELECT 
                g.descripcion, 
                g.costo, 
                TO_CHAR(g.fecha_gasto, 'DD/MM/YYYY') as fecha,
                p.nombre as proveedor
            FROM gastos g
            LEFT JOIN proveedores p ON g.proveedor_id = p.proveedor_id
            WHERE g.fecha_gasto >= CURRENT_DATE
            ORDER BY g.fecha_gasto DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) {
        console.error("Error en GET /api/gastos:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/reporte/mensual', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        if (!mes || !ano) {
            return res.status(400).send('Mes y año son requeridos.');
        }
        const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const nombreMes = mesesNombres[mes - 1];
        const detalleIngresosQuery = `
            SELECT t.*, c.nombre_completo, TO_CHAR(t.fecha_entrada, 'YYYY-MM-DD') as fecha_registro 
            FROM trabajos t
            JOIN clientes c ON t.cliente_id = c.cliente_id
            WHERE t.estado_stock = 'Entregado' AND EXTRACT(MONTH FROM t.fecha_entrada) = $1 AND EXTRACT(YEAR FROM t.fecha_entrada) = $2 
            ORDER BY t.fecha_entrada ASC
        `;
        const gastosQuery = `SELECT g.*, p.nombre as proveedor FROM gastos g LEFT JOIN proveedores p ON g.proveedor_id = p.proveedor_id WHERE EXTRACT(MONTH FROM g.fecha_gasto) = $1 AND EXTRACT(YEAR FROM g.fecha_gasto) = $2 ORDER BY g.fecha_gasto`;
        const [detalleIngresosResult, gastosResult] = await Promise.all([
             pool.query(detalleIngresosQuery, [mes, ano]),
             pool.query(gastosQuery, [mes, ano])
        ]);
        const ingresosTotales = detalleIngresosResult.rows.reduce((sum, row) => sum + Number(row.monto_total), 0);
        const gastosTotales = gastosResult.rows.reduce((sum, row) => sum + Number(row.costo), 0);
        const gananciaNeta = ingresosTotales - gastosTotales;
        const workbook = new excel.Workbook();
        const resumenSheet = workbook.addWorksheet('Resumen Mensual');
        // ... (resto del código de excel)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Reporte_Financiero_${nombreMes}-${ano}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (e) {
        console.error('Error al generar reporte:', e);
        res.status(500).send('Error al generar el reporte.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});