/**
 * Script para ejecutar seeders manualmente
 * Uso: node scripts/seed.js
 */

require('dotenv').config();
const { sequelize } = require('../src/models');

async function runSeeders() {
  try {
    console.log('🚀 Iniciando proceso de seeding...');
    console.log('📊 Conectando a la base de datos...');

    // Verificar conexión
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos exitosa');

    // Sincronizar modelos (crear tablas si no existen)
    console.log('📋 Sincronizando modelos...');
    
    try {
      await sequelize.sync({ force: false }); // force: false para no eliminar datos existentes
      console.log('✅ Modelos sincronizados');
    } catch (error) {
      // Si hay errores de índices existentes, continuar de todas formas
      if (error.message.includes('already exists')) {
        console.log('⚠️  Algunos índices ya existen, continuando...');
      } else {
        throw error;
      }
    }

    // Ejecutar seeders en orden
    console.log('🌱 Ejecutando seeders...');
    const seeders = [
      require('../src/seeders/001-demo-users'),
      require('../src/seeders/002-projects'),
      require('../src/seeders/003-project-members')
    ];

    for (const s of seeders) {
      await s.up(sequelize.getQueryInterface(), sequelize.constructor);
    }
    
    console.log('✅ Seeders ejecutados exitosamente');
    console.log('\n📋 Usuarios de prueba creados:');
    console.log('   - admin@umlcdp.com (Admin123!)');
    console.log('   - john.doe@example.com (Password123!)');
    console.log('   - jane.doe@example.com (Password123!)');
    console.log('   - dev1@company.com (Dev123!)');
    console.log('   - design1@company.com (Design123!)');
    console.log('   - lead@team.com (Lead123!)');
    console.log('\n🎯 Puedes usar cualquiera de estos usuarios para probar el sistema');

  } catch (error) {
    console.error('❌ Error ejecutando seeders:', error);
    console.error('Detalles:', error.message);
    
    if (error.name === 'SequelizeConnectionError') {
      console.error('\n💡 Verifica que:');
      console.error('   - La base de datos esté ejecutándose');
      console.error('   - Las credenciales en .env sean correctas');
      console.error('   - El archivo .env exista en la raíz del proyecto');
    }
    
    process.exit(1);
  } finally {
    // Cerrar conexión
    await sequelize.close();
    console.log('🔌 Conexión cerrada');
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runSeeders();
}

module.exports = runSeeders;
