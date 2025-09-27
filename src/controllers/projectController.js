const { Project, User, ProjectMember, Diagram, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * Obtener todos los proyectos del usuario
 * GET /api/projects
 */
const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, search, visibility } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Construir filtros
    const where = {
      [Op.or]: [
        { ownerId: userId },
        sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}')`)
      ]
    };

    if (search) {
      where[Op.and] = [
        {
          [Op.or]: [
            { name: { [Op.iLike]: `%${search}%` } },
            { description: { [Op.iLike]: `%${search}%` } }
          ]
        }
      ];
    }

    if (visibility) {
      if (visibility === 'public') where.isPublic = true;
      if (visibility === 'private') where.isPublic = false;
    }

    const projects = await Project.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: ProjectMember,
          as: 'projectMembers',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }]
        },
        {
          model: Diagram,
          as: 'diagrams',
          attributes: ['id', 'name', 'createdAt'],
          required: false
        }
      ],
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      success: true,
      data: {
        projects: projects.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: projects.count,
          pages: Math.ceil(projects.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener un proyecto específico
 * GET /api/projects/:id
 */
const getProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({
      where: { 
        id,
        [Op.or]: [
          { ownerId: userId },
          sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}')`),
          { isPublic: true }
        ]
      },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'username', 'firstName', 'lastName']
        },
        {
          model: ProjectMember,
          as: 'projectMembers',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }]
        },
        {
          model: Diagram,
          as: 'diagrams',
          required: false
        }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Determinar permisos del usuario
    let userRole = 'viewer';
    if (project.ownerId === userId) {
      userRole = 'owner';
    } else {
      const membership = project.projectMembers.find(m => m.userId === userId);
      if (membership) {
        userRole = membership.role;
      }
    }

    res.json({
      success: true,
      data: {
        project,
        userRole
      }
    });

  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Crear nuevo proyecto
 * POST /api/projects
 */
const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { name, description, visibility = 'private', settings } = req.body;
    const userId = req.user.id;

    const project = await Project.create({
      name,
      description,
      ownerId: userId,
      isPublic: visibility === 'public',
      settings: settings || {}
    });

    // Incluir información del propietario
    const projectWithOwner = await Project.findByPk(project.id, {
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }]
    });

    console.log(`✅ Proyecto creado: ${name} por ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Proyecto creado exitosamente',
      data: {
        project: projectWithOwner
      }
    });

  } catch (error) {
    console.error('Error creando proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar proyecto
 * PUT /api/projects/:id
 */
const updateProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, description, visibility, settings } = req.body;
    const userId = req.user.id;

    // Verificar que el proyecto existe y el usuario tiene permisos
    const project = await Project.findOne({
      where: { 
        id,
        [Op.or]: [
          { ownerId: userId },
          sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}' AND pm.role IN ('admin','editor'))`)
        ]
      },
      include: [{
        model: ProjectMember,
        as: 'projectMembers',
        where: { userId },
        required: false
      }]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o sin permisos'
      });
    }

    // Actualizar proyecto
    await project.update({
      name,
      description,
      isPublic: typeof visibility === 'string' ? visibility === 'public' : visibility,
      settings
    });

    console.log(`✅ Proyecto actualizado: ${name} por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Proyecto actualizado exitosamente',
      data: {
        project
      }
    });

  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Eliminar proyecto
 * DELETE /api/projects/:id
 */
const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const project = await Project.findOne({
      where: { id, ownerId: userId }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o sin permisos'
      });
    }

    // Soft delete
    await project.destroy();

    console.log(`✅ Proyecto eliminado: ${project.name} por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Invitar miembro al proyecto
 * POST /api/projects/:id/members
 */
const inviteMember = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { email, role = 'viewer' } = req.body;
    const userId = req.user.id;

    // Verificar que el proyecto existe y el usuario es owner o admin
    const project = await Project.findOne({
      where: { 
        id,
        [Op.or]: [
          { ownerId: userId },
          sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}' AND pm.role = 'admin')`)
        ]
      },
      include: [{
        model: ProjectMember,
        as: 'projectMembers',
        where: { userId },
        required: false
      }]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o sin permisos'
      });
    }

    // Buscar usuario a invitar
    const userToInvite = await User.findOne({
      where: { email },
      attributes: ['id', 'username', 'email', 'firstName', 'lastName']
    });

    if (!userToInvite) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar si ya es miembro
    const existingMember = await ProjectMember.findOne({
      where: { projectId: id, userId: userToInvite.id }
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: 'El usuario ya es miembro del proyecto'
      });
    }

    // Crear membresía
    const membership = await ProjectMember.create({
      projectId: id,
      userId: userToInvite.id,
      role,
      invitedBy: userId,
      joinedAt: new Date()
    });

    console.log(`✅ Usuario invitado: ${email} al proyecto ${project.name}`);

    res.status(201).json({
      success: true,
      message: 'Usuario invitado exitosamente',
      data: {
        membership: {
          ...membership.toJSON(),
          user: userToInvite
        }
      }
    });

  } catch (error) {
    console.error('Error invitando miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Remover miembro del proyecto
 * DELETE /api/projects/:id/members/:userId
 */
const removeMember = async (req, res) => {
  try {
    const { id, userId: memberUserId } = req.params;
    const userId = req.user.id;

    // Verificar permisos y encontrar membresía
    const membership = await ProjectMember.findOne({
      where: { projectId: id, userId: memberUserId },
      include: [{
        model: Project,
        as: 'project',
        where: {
          [Op.or]: [
            { ownerId: userId },
            { '$projectMembers.user_id$': userId, '$projectMembers.role$': 'admin' }
          ]
        },
        include: [{
          model: ProjectMember,
          as: 'projectMembers',
          where: { userId },
          required: false
        }]
      }]
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado o sin permisos'
      });
    }

    await membership.destroy();

    console.log(`✅ Miembro removido del proyecto por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Miembro removido exitosamente'
    });

  } catch (error) {
    console.error('Error removiendo miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener diagramas de un proyecto
 * GET /api/projects/:id/diagrams
 */
const getProjectDiagrams = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Verificar acceso al proyecto
    const project = await Project.findOne({
      where: { 
        id,
        [Op.or]: [
          { ownerId: userId },
          sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}')`),
          { isPublic: true }
        ]
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    const diagrams = await Diagram.findAndCountAll({
      where: { projectId: id, isActive: true },
      order: [['updatedAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        diagrams: diagrams.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: diagrams.count,
          pages: Math.ceil(diagrams.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo diagramas del proyecto:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Crear diagrama en un proyecto
 * POST /api/projects/:id/diagrams
 */
const createProjectDiagram = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, description, content } = req.body;
    const userId = req.user.id;

    // Verificar permisos de edición
    const project = await Project.findOne({
      where: { 
        id,
        [Op.or]: [
          { ownerId: userId },
          sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "Project"."id" AND pm.user_id = '${userId}' AND pm.role IN ('admin','editor'))`)
        ]
      }
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado o sin permisos'
      });
    }

    // Crear diagrama
    const diagram = await Diagram.create({
      projectId: id,
      name,
      description,
      content: typeof content === 'string' ? JSON.parse(content) : (content || { elements: [], connections: [], metadata: {} })
    });

    console.log(`✅ Diagrama creado: ${name} en proyecto ${project.name} por ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Diagrama creado exitosamente',
      data: diagram
    });

  } catch (error) {
    console.error('Error creando diagrama:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  inviteMember,
  removeMember,
  getProjectDiagrams,
  createProjectDiagram
};
