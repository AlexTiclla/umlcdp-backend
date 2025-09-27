const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Seeder para crear usuarios de demostración
 * Incluye usuarios con diferentes roles para pruebas
 */

const demoUsers = [
  {
    id: uuidv4(),
    username: 'admin',
    email: 'admin@umlcdp.com',
    password: 'Admin123!',
    firstName: 'Administrador',
    lastName: 'Sistema',
    company: 'UML CDP',
    role: 'admin',
    isActive: true
  },
  {
    id: uuidv4(),
    username: 'johndoe',
    email: 'john.doe@example.com',
    password: 'Password123!',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corporation',
    role: 'user',
    isActive: true
  },
  {
    id: uuidv4(),
    username: 'janedoe',
    email: 'jane.doe@example.com',
    password: 'Password123!',
    firstName: 'Jane',
    lastName: 'Doe',
    company: 'Tech Solutions Inc',
    role: 'user',
    isActive: true
  },
  {
    id: uuidv4(),
    username: 'developer1',
    email: 'dev1@company.com',
    password: 'Dev123!',
    firstName: 'Carlos',
    lastName: 'Rodríguez',
    company: 'DevCorp',
    role: 'user',
    isActive: true
  },
  {
    id: uuidv4(),
    username: 'designer1',
    email: 'design1@company.com',
    password: 'Design123!',
    firstName: 'María',
    lastName: 'García',
    company: 'DesignStudio',
    role: 'user',
    isActive: true
  },
  {
    id: uuidv4(),
    username: 'teamlead',
    email: 'lead@team.com',
    password: 'Lead123!',
    firstName: 'Roberto',
    lastName: 'Martínez',
    company: 'TeamWork Ltd',
    role: 'user',
    isActive: true
  }
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🌱 Iniciando seeder de usuarios demo...');

      // Verificar si ya existen usuarios
      const existingUsers = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM users',
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (existingUsers[0].count > 0) {
        console.log('⚠️  Ya existen usuarios en la base de datos. Saltando seeder...');
        return;
      }

      // Hashear contraseñas
      const usersWithHashedPasswords = await Promise.all(
        demoUsers.map(async (user) => ({
          id: user.id,
          username: user.username,
          email: user.email,
          password_hash: await bcrypt.hash(user.password, 12),
          first_name: user.firstName,
          last_name: user.lastName,
          role: user.role,
          avatar_url: null,
          is_active: user.isActive,
          email_verified: false,
          last_login: null,
          created_at: new Date(),
          updated_at: new Date()
        }))
      );

      // Insertar usuarios
      await queryInterface.bulkInsert('users', usersWithHashedPasswords);

      console.log('✅ Usuarios demo creados exitosamente:');
      demoUsers.forEach(user => {
        console.log(`   - ${user.username} (${user.email}) - ${user.role}`);
      });

      console.log('📊 Datos de prueba listos para usar');
      console.log('💡 Nota: Las tablas de proyectos y diagramas se crearán automáticamente cuando uses la aplicación');

    } catch (error) {
      console.error('❌ Error en seeder de usuarios demo:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      console.log('🧹 Limpiando datos demo...');

      // Eliminar en orden correcto debido a las relaciones
      await queryInterface.bulkDelete('diagram_versions', null, {});
      await queryInterface.bulkDelete('diagrams', null, {});
      await queryInterface.bulkDelete('project_members', null, {});
      await queryInterface.bulkDelete('projects', null, {});
      await queryInterface.bulkDelete('users', {
        email: demoUsers.map(user => user.email)
      }, {});

      console.log('✅ Datos demo eliminados exitosamente');

    } catch (error) {
      console.error('❌ Error limpiando datos demo:', error);
      throw error;
    }
  }
};
