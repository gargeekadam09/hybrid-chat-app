const { Pool } = require('pg');
require('dotenv').config();

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Create tables if they don't exist
const createTables = async () => {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                firstName VARCHAR(50) NOT NULL,
                lastName VARCHAR(50) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                isAdmin BOOLEAN DEFAULT FALSE,
                isOnline BOOLEAN DEFAULT FALSE,
                lastSeen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create messages table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                senderId INTEGER NOT NULL REFERENCES users(id),
                receiverId INTEGER REFERENCES users(id),
                content TEXT NOT NULL,
                messageType VARCHAR(20) DEFAULT 'general',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('✅ Database tables created successfully!');
        
        // Create admin user
        await createAdminUser();
    } catch (error) {
        console.error('Error creating tables:', error.message);
    }
};

// Create admin user if not exists
const createAdminUser = async () => {
    try {
        // Check if admin exists
        const result = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            ['admin@chatapp.com']
        );
        
        if (result.rows.length === 0) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            await pool.query(
                'INSERT INTO users (firstName, lastName, username, email, password, isAdmin) VALUES ($1, $2, $3, $4, $5, $6)',
                ['Admin', 'User', 'admin', 'admin@chatapp.com', hashedPassword, true]
            );
            console.log('✅ Admin user created: admin@chatapp.com / admin123');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('Error creating admin user:', error.message);
    }
};

// Initialize database
if (process.env.DATABASE_URL) {
    createTables();
} else {
    console.log('DATABASE_URL not found, skipping database initialization');
}

module.exports = pool;
