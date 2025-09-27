const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware de autenticación JWT
 * Verifica el token y agrega el usuario al request
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Buscar el usuario en la base de datos
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'isActive']
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Agregar usuario al request
    req.user = user;
    next();

  } catch (error) {
    console.error('Error de autenticación:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware de autorización por roles
 * @param {string|string[]} allowedRoles - Roles permitidos
 */
const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Permisos insuficientes',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: userRole
      });
    }

    next();
  };
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero agrega el usuario si existe
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'role', 'isActive']
    });

    req.user = user && user.isActive ? user : null;
    next();

  } catch (error) {
    // En caso de error, continuar sin usuario autenticado
    req.user = null;
    next();
  }
};

/**
 * Generar token JWT
 * @param {object} user - Datos del usuario
 * @param {object} options - Opciones adicionales
 */
const generateTokens = (user, options = {}) => {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };

  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

  // Token de acceso (15 minutos por defecto)
  const accessToken = jwt.sign(payload, secret, {
    expiresIn: options.accessTokenExpiry || '15m',
    issuer: 'umlcdp-backend',
    audience: 'umlcdp-frontend'
  });

  // Token de refresh (7 días por defecto)
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' }, 
    refreshSecret, 
    {
      expiresIn: options.refreshTokenExpiry || '7d',
      issuer: 'umlcdp-backend',
      audience: 'umlcdp-frontend'
    }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: options.accessTokenExpiry || '15m'
  };
};

/**
 * Verificar token de refresh
 * @param {string} refreshToken - Token de refresh
 */
const verifyRefreshToken = (refreshToken) => {
  try {
    const secret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
    const decoded = jwt.verify(refreshToken, secret);
    
    if (decoded.type !== 'refresh') {
      throw new Error('Tipo de token inválido');
    }

    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * Middleware para verificar permisos de proyecto
 * @param {string} permission - Tipo de permiso: 'read', 'write', 'admin'
 */
const checkProjectPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.body.projectId;
      const userId = req.user.id;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          message: 'ID de proyecto requerido',
          code: 'PROJECT_ID_REQUIRED'
        });
      }

      // Buscar el proyecto y verificar permisos
      const { Project, ProjectMember } = require('../models');
      
      const project = await Project.findByPk(projectId, {
        include: [{
          model: ProjectMember,
          as: 'members',
          where: { userId: userId },
          required: false
        }]
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Proyecto no encontrado',
          code: 'PROJECT_NOT_FOUND'
        });
      }

      // El propietario tiene todos los permisos
      if (project.ownerId === userId) {
        req.projectPermission = 'admin';
        return next();
      }

      // Verificar membresía del proyecto
      const membership = project.members && project.members[0];
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'No tienes acceso a este proyecto',
          code: 'PROJECT_ACCESS_DENIED'
        });
      }

      // Verificar nivel de permiso requerido
      const userPermission = membership.role;
      const permissionLevels = {
        'read': ['viewer', 'editor', 'admin'],
        'write': ['editor', 'admin'],
        'admin': ['admin']
      };

      if (!permissionLevels[permission].includes(userPermission)) {
        return res.status(403).json({
          success: false,
          message: `Permisos insuficientes. Se requiere: ${permission}`,
          code: 'INSUFFICIENT_PROJECT_PERMISSIONS',
          required: permission,
          current: userPermission
        });
      }

      req.projectPermission = userPermission;
      next();

    } catch (error) {
      console.error('Error verificando permisos de proyecto:', error);
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  generateTokens,
  verifyRefreshToken,
  checkProjectPermission
};
