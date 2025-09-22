const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const readline = require('readline');

// --- 1. CONFIGURA TUS DATOS DE CONEXIÓN A LA BASE DE DATOS ---
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'lavanderia_db',
    password: 'telas2005',
    port: 5432,
});

// --- 2. CONFIGURA EL USUARIO Y LA CONTRASEÑA DEL ADMINISTRADOR ---
const adminUsername = 'Salet';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const createAdmin = async () => {
    rl.question('Telas2025', async (password) => {
        if (!password) {
            console.error('❌ La contraseña no puede estar vacía.');
            rl.close();
            return;
        }
        
        try {
            // Encripta la contraseña antes de guardarla
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Inserta el nuevo usuario en la tabla 'users'
            const query = 'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id';
            const result = await pool.query(query, [adminUsername, hashedPassword]);

            console.log('✅ Usuario administrador creado con éxito!');
            console.log(`ID del usuario: ${result.rows[0].id}`);
        } catch (error) {
            if (error.code === '23505') { // Código de error de PostgreSQL para "duplicate key"
                console.error('❌ Error: El usuario "admin" ya existe.');
            } else {
                console.error('❌ Error al crear el usuario:', error);
            }
        } finally {
            rl.close();
            pool.end(); // Cierra la conexión de la base de datos
        }
    });
};

createAdmin();