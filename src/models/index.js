const { Sequelize } = require('sequelize');
const sequelize = require('../config/database');

// Importar modelos
const User = require('./User');
const Project = require('./Project');
const ProjectMember = require('./ProjectMember');
const Diagram = require('./Diagram');
const DiagramVersion = require('./DiagramVersion');
const GeneratedCode = require('./GeneratedCode');

// Inicializar modelos
const models = {
  User: User(sequelize, Sequelize.DataTypes),
  Project: Project(sequelize, Sequelize.DataTypes),
  ProjectMember: ProjectMember(sequelize, Sequelize.DataTypes),
  Diagram: Diagram(sequelize, Sequelize.DataTypes),
  DiagramVersion: DiagramVersion(sequelize, Sequelize.DataTypes),
  GeneratedCode: GeneratedCode(sequelize, Sequelize.DataTypes)
};

// Definir asociaciones
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;