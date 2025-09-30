const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                len: [3, 50]
            }
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'password_hash',
            validate: {
                len: [6, 100]
            }
        },
        firstName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        lastName: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('user', 'admin'),
            defaultValue: 'user',
            allowNull: false
        },
        avatarUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'avatar_url'
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active'
        },
        emailVerified: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            field: 'email_verified'
        },
        lastLogin: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login'
        },
        avatar: {
            type: DataTypes.STRING,
            allowNull: true
        },
        lastLoginAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login_at'
        },
        company: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'users',
        underscored: true,
        hooks: {
            beforeCreate: async (user) => {
                if (user.password) {
                    user.password = await bcrypt.hash(user.password, 12);
                }
            },
            beforeUpdate: async (user) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, 12);
                }
            }
        }
    });

    User.associate = (models) => {
        User.hasMany(models.Project, {
            foreignKey: 'ownerId',
            as: 'ownedProjects'
        });
        User.belongsToMany(models.Project, {
            through: models.ProjectMember,
            foreignKey: 'userId',
            otherKey: 'projectId',
            as: 'projects'
        });
    };

    User.prototype.validatePassword = async function (password) {
        return await bcrypt.compare(password, this.password);
    };

    return User;
};