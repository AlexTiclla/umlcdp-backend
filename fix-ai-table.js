/**
 * Script para arreglar la tabla ai_interactions
 * Ejecutar con: node fix-ai-table.js
 */

require('dotenv').config();
const { sequelize } = require('./src/config/database');

async function fixAITable() {
    try {
        console.log('🔧 Arreglando tabla ai_interactions...');
        
        // Conectar a la base de datos
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida');

        // Eliminar la tabla si existe (para recrearla limpia)
        await sequelize.query('DROP TABLE IF EXISTS ai_interactions CASCADE;');
        console.log('🗑️ Tabla ai_interactions eliminada');

        // Sincronizar solo el modelo AIInteraction
        const { AIInteraction } = require('./src/models');
        await AIInteraction.sync({ force: true });
        console.log('✅ Tabla ai_interactions recreada correctamente');

        console.log('🎉 ¡Tabla arreglada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error arreglando tabla:', error.message);
        console.error('Detalles:', error);
    } finally {
        await sequelize.close();
        console.log('🔌 Conexión cerrada');
        process.exit(0);
    }
}

// Ejecutar el script
fixAITable();
