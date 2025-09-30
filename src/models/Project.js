module.exports = (sequelize, DataTypes) => {
  const Project = sequelize.define('Project', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'owner_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_public'
    },
    settings: {
      type: DataTypes.JSON,
      defaultValue: {
        theme: 'light',
        gridEnabled: true,
        snapToGrid: true,
        showMinimap: true,
        autoSave: true,
        collaborationEnabled: true
      }
    }
  }, {
    tableName: 'projects',
    underscored: true,
    timestamps: true
  });

  Project.associate = (models) => {
    // Relación con Usuario propietario
    Project.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner'
    });

    // Relación con Diagramas
    Project.hasMany(models.Diagram, {
      foreignKey: 'projectId',
      as: 'diagrams',
      onDelete: 'CASCADE'
    });

    // Relación con Miembros del proyecto (muchos a muchos)
    Project.belongsToMany(models.User, {
      through: models.ProjectMember,
      foreignKey: 'projectId',
      otherKey: 'userId',
      as: 'members'
    });

    // Relación directa con ProjectMember para mejor control
    Project.hasMany(models.ProjectMember, {
      foreignKey: 'projectId',
      as: 'projectMembers'
    });
  };

  return Project;
};
