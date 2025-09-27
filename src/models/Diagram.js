module.exports = (sequelize, DataTypes) => {
  const Diagram = sequelize.define('Diagram', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: {
        model: 'projects',
        key: 'id'
      }
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
    content: {
      type: DataTypes.JSON,
      defaultValue: {
        elements: [],
        connections: [],
        metadata: {}
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    }
  }, {
    tableName: 'diagrams',
    underscored: true,
    timestamps: true
  });

  Diagram.associate = (models) => {
    // Relación con Project
    Diagram.belongsTo(models.Project, {
      foreignKey: 'projectId',
      as: 'project'
    });

    // Relación con Versiones del diagrama
    Diagram.hasMany(models.DiagramVersion, {
      foreignKey: 'diagramId',
      as: 'versions',
      onDelete: 'CASCADE'
    });
  };

  return Diagram;
};
