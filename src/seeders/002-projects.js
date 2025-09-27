const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🌱 Seed 002: creando proyectos de ejemplo...');

      const [{ count }] = await queryInterface.sequelize.query(
        'SELECT COUNT(*)::int as count FROM projects',
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (count > 0) {
        console.log('⚠️  Ya existen proyectos. Saltando 002-projects...');
        return;
      }

      // Obtener usuarios para owner_id
      const users = await queryInterface.sequelize.query(
        'SELECT id, username FROM users ORDER BY created_at ASC',
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (users.length === 0) {
        console.log('⚠️  No hay usuarios. Ejecuta 001-demo-users primero.');
        return;
      }

      const owner = users.find(u => u.username === 'admin') || users[0];

      const now = new Date();
      const projects = [
        {
          id: uuidv4(),
          name: 'CRM Interno',
          description: 'Proyecto de gestión de clientes',
          owner_id: owner.id,
          is_public: false,
          settings: JSON.stringify({ theme: 'light', gridEnabled: true }),
          created_at: now,
          updated_at: now
        },
        {
          id: uuidv4(),
          name: 'Ecommerce',
          description: 'Tienda en línea demo',
          owner_id: owner.id,
          is_public: true,
          settings: JSON.stringify({ theme: 'dark', autoSave: true }),
          created_at: now,
          updated_at: now
        }
      ];

      await queryInterface.bulkInsert('projects', projects);
      console.log('✅ 002-projects: proyectos insertados');
    } catch (error) {
      console.error('❌ Error en 002-projects:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🧹 Revirtiendo 002-projects...');
      await queryInterface.bulkDelete('projects', null, {});
      console.log('✅ 002-projects revertido');
    } catch (error) {
      console.error('❌ Error revirtiendo 002-projects:', error);
      throw error;
    }
  }
};


