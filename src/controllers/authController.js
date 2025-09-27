const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateTokens, verifyRefreshToken } = require('../middleware/auth');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * Registro de usuario
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { username, email, password, firstName, lastName, company } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: username }
        ]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email 
          ? 'Este correo electrónico ya está registrado' 
          : 'Este nombre de usuario ya está en uso',
        code: 'USER_ALREADY_EXISTS'
      });
    }

    // Crear nuevo usuario
    const newUser = await User.create({
      username,
      email,
      password, // Se hashea automáticamente en el hook beforeCreate
      firstName,
      lastName,
      company,
      role: 'user', // Rol por defecto
      isActive: true
    });

    // Generar tokens
    const tokens = generateTokens(newUser);

    // Respuesta (sin incluir la contraseña)
    const userResponse = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      company: newUser.company,
      role: newUser.role,
      createdAt: newUser.createdAt
    };

    console.log(`✅ Usuario registrado: ${newUser.username} (${newUser.email})`);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: userResponse,
        ...tokens
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Inicio de sesión
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    // Verificar errores de validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { email, password, remember } = req.body;

    // Buscar usuario por email o username
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: email },
          { username: email } // Permitir login con username también
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada. Contacta al administrador.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verificar contraseña
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generar tokens con expiración extendida si "remember" está activo
    const tokenOptions = remember ? {
      accessTokenExpiry: '24h',
      refreshTokenExpiry: '30d'
    } : {};

    const tokens = generateTokens(user, tokenOptions);

    // Actualizar último login
    await user.update({ lastLoginAt: new Date() });

    // Respuesta del usuario (sin contraseña)
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      role: user.role,
      lastLoginAt: user.lastLoginAt
    };

    console.log(`✅ Usuario autenticado: ${user.username} (${user.email})`);

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      data: {
        user: userResponse,
        ...tokens
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Renovar token de acceso
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de refresh requerido',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Verificar token de refresh
    const decoded = verifyRefreshToken(token);
    
    // Buscar usuario
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'isActive']
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado o inactivo',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generar nuevos tokens
    const tokens = generateTokens(user);

    res.json({
      success: true,
      message: 'Tokens renovados exitosamente',
      data: tokens
    });

  } catch (error) {
    console.error('Error renovando token:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token de refresh expirado',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token de refresh inválido',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Cerrar sesión
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // En una implementación real, aquí podrías invalidar el token
    // agregándolo a una blacklist en Redis o base de datos
    
    console.log(`✅ Usuario cerró sesión: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Obtener perfil del usuario actual
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    // Obtener información adicional del usuario
    const fullUser = await User.findByPk(user.id, {
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'company', 'role', 'avatar', 'createdAt', 'lastLoginAt']
    });

    res.json({
      success: true,
      data: {
        user: fullUser
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Actualizar perfil del usuario
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { firstName, lastName, company, avatar } = req.body;

    // Actualizar usuario
    const [updatedRows] = await User.update(
      { firstName, lastName, company, avatar },
      { 
        where: { id: userId },
        returning: true
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Obtener usuario actualizado
    const updatedUser = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'company', 'role', 'avatar', 'updatedAt']
    });

    console.log(`✅ Perfil actualizado: ${updatedUser.username}`);

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Cambiar contraseña
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Buscar usuario con contraseña
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Actualizar contraseña (se hashea automáticamente en el hook)
    await user.update({ password: newPassword });

    console.log(`✅ Contraseña cambiada: ${user.username}`);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword
};
