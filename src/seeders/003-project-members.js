const { v4: uuidv4 } = require('uuid');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🌱 Seed 003: creando miembros de proyecto...');

      const [{ count }] = await queryInterface.sequelize.query(
        'SELECT COUNT(*)::int as count FROM project_members',
        { type: Sequelize.QueryTypes.SELECT }
      );
      if (count > 0) {
        console.log('⚠️  Ya existen miembros. Saltando 003-project-members...');
        return;
      }

      const users = await queryInterface.sequelize.query(
        'SELECT id, username FROM users ORDER BY created_at ASC',
        { type: Sequelize.QueryTypes.SELECT }
      );
      const projects = await queryInterface.sequelize.query(
        'SELECT id, name, owner_id FROM projects ORDER BY created_at ASC',
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (users.length < 2 || projects.length === 0) {
        console.log('⚠️  Faltan usuarios o proyectos para crear membresías.');
        return;
      }

      const admin = users.find(u => u.username === 'admin') || users[0];
      const john = users.find(u => u.username === 'johndoe') || users[1];
      const jane = users.find(u => u.username === 'janedoe') || users[2] || users[0];

      const targetProject = projects[0];
      const now = new Date();

      const members = [
        {
          id: uuidv4(),
          project_id: targetProject.id,
          user_id: john.id,
          role: 'editor',
          permissions: JSON.stringify({ canInvite: false }),
          invited_by: admin.id,
          invited_at: now,
          joined_at: now,
          status: 'active'
        },
        {
          id: uuidv4(),
          project_id: targetProject.id,
          user_id: jane.id,
          role: 'viewer',
          permissions: JSON.stringify({}),
          invited_by: admin.id,
          invited_at: now,
          joined_at: now,
          status: 'active'
        }
      ];

      await queryInterface.bulkInsert('project_members', members);
      console.log('✅ 003-project-members: membresías insertadas');
    } catch (error) {
      console.error('❌ Error en 003-project-members:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🧹 Revirtiendo 003-project-members...');
      await queryInterface.bulkDelete('project_members', null, {});
      console.log('✅ 003-project-members revertido');
    } catch (error) {
      console.error('❌ Error revirtiendo 003-project-members:', error);
      throw error;
    }
  }
};


