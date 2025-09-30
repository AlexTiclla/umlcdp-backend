module.exports = (sequelize, DataTypes) => {
  const ProjectMember = sequelize.define('ProjectMember', {
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    role: {
      type: DataTypes.ENUM('viewer', 'editor', 'admin'),
      defaultValue: 'viewer',
      allowNull: false
    },
    permissions: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    invitedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'invited_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    invitedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'invited_at'
    },
    joinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'joined_at'
    },
    status: {
      type: DataTypes.ENUM('pending', 'active', 'inactive'),
      defaultValue: 'pending',
      allowNull: false
    }
  }, {
    tableName: 'project_members',
    underscored: true,
    timestamps: false
  });

  ProjectMember.associate = (models) => {
    // Relación con Project
    ProjectMember.belongsTo(models.Project, {
      foreignKey: 'projectId',
      as: 'project'
    });

    // Relación con User (miembro)
    ProjectMember.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });

    // Relación con User (quien invitó)
    ProjectMember.belongsTo(models.User, {
      foreignKey: 'invitedBy',
      as: 'inviter'
    });
  };

  return ProjectMember;
};
