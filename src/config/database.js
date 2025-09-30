const { Sequelize } = require('sequelize');
require('dotenv').config();

// Configuración de base de datos
let sequelize;

if (process.env.DB_URL) {
  // Usar URL completa si está disponible
  // Limpiar la URL si tiene prefijo DATABASE_URL=
  let dbUrl = process.env.DB_URL;
  if (dbUrl.startsWith('DATABASE_URL=')) {
    dbUrl = dbUrl.replace('DATABASE_URL=', '');
  }
  
  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Usar configuración individual
  sequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'umlcdp',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

module.exports = sequelize;