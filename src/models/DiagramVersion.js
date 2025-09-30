module.exports = (sequelize, DataTypes) => {
  const DiagramVersion = sequelize.define('DiagramVersion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    diagramId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'diagram_id',
      references: {
        model: 'diagrams',
        key: 'id'
      }
    },
    versionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'version_number'
    },
    content: {
      type: DataTypes.JSON,
      allowNull: false
    },
    changesSummary: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'changes_summary'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
  }, {
    tableName: 'diagram_versions',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  DiagramVersion.associate = (models) => {
    // Relación con Diagram
    DiagramVersion.belongsTo(models.Diagram, {
      foreignKey: 'diagramId',
      as: 'diagram'
    });

    // Relación con User (creador de la versión)
    DiagramVersion.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator'
    });
  };

  return DiagramVersion;
};
