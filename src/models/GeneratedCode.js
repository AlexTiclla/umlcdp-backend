module.exports = (sequelize, DataTypes) => {
  const GeneratedCode = sequelize.define('GeneratedCode', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    diagram_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'diagrams',
        key: 'id'
      }
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '1.0.0'
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['java', 'spring-boot', 'python', 'php']]
      }
    },
    code_structure: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Estructura del código generado (entidades, controladores, etc.)'
    },
    files: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Archivos generados con su contenido'
    },
    is_valid: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    compilation_errors: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Errores de compilación si los hay'
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  }, {
    tableName: 'generated_code',
    timestamps: false,
    indexes: [
      {
        fields: ['diagram_id']
      },
      {
        fields: ['language']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  GeneratedCode.associate = function(models) {
    GeneratedCode.belongsTo(models.Diagram, {
      foreignKey: 'diagram_id',
      as: 'diagram'
    });
  };

  return GeneratedCode;
};
