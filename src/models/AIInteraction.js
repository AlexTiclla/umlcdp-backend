const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AIInteraction = sequelize.define('AIInteraction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  diagram_id: {
    type: DataTypes.UUID,
    allowNull: true, // Puede ser null si la interacción no está relacionada con un diagrama específico
    references: {
      model: 'diagrams',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL'
  },
  interaction_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'ask',
    validate: {
      isIn: [['ask', 'agent']]
    }
  },
  prompt: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  response: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  context: {
    type: DataTypes.JSONB,
    allowNull: true,
    defaultValue: {}
  },
  confidence_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: {
      min: 0.0,
      max: 1.0
    }
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ai_interactions',
  timestamps: false, // Usamos created_at personalizado
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['diagram_id']
    },
    {
      fields: ['interaction_type']
    },
    {
      fields: ['created_at']
    }
  ]
});

module.exports = AIInteraction;
