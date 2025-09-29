const { Diagram, Project, User, ProjectMember, DiagramVersion, sequelize } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

/**
 * Obtener diagrama específico
 * GET /api/diagrams/:id
 */
const getDiagram = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const diagram = await Diagram.findOne({
      where: { id, isActive: true },
      include: [{
        model: Project,
        as: 'project',
        where: {
          [Op.or]: [
            { ownerId: userId },
            sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "project"."id" AND pm.user_id = '${userId}')`),
            { isPublic: true }
          ]
        }
      }]
    });

    if (!diagram) {
      return res.status(404).json({
        success: false,
        message: 'Diagrama no encontrado'
      });
    }

    res.json({
      success: true,
      data: diagram
    });

  } catch (error) {
    console.error('Error obteniendo diagrama:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Actualizar diagrama
 * PUT /api/diagrams/:id
 */
const updateDiagram = async (req, res) => {
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

    console.log(`🔍 Actualizando diagrama ${id} por usuario ${userId} (${req.user.username})`);

    // Primero verificar que el diagrama existe
    const diagramExists = await Diagram.findOne({
      where: { id, isActive: true }
    });

    if (!diagramExists) {
      console.log(`❌ Diagrama ${id} no encontrado o inactivo`);
      return res.status(404).json({
        success: false,
        message: 'Diagrama no encontrado'
      });
    }

    console.log(`✅ Diagrama encontrado: ${diagramExists.name} en proyecto ${diagramExists.projectId}`);

    // Verificar permisos del proyecto de manera más simple
    const projectCheck = await Project.findByPk(diagramExists.projectId);

    if (!projectCheck) {
      console.log(`❌ Proyecto ${diagramExists.projectId} no encontrado`);
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    console.log(`✅ Proyecto encontrado: ${projectCheck.name}`);
    console.log(`🔍 Owner del proyecto: ${projectCheck.ownerId}`);

    // Verificar si es el propietario del proyecto
    const isOwner = projectCheck.ownerId === userId;

    if (!isOwner) {
      // Si no es owner, verificar si es miembro con permisos
      const membership = await ProjectMember.findOne({
        where: {
          projectId: diagramExists.projectId,
          userId: userId,
          role: { [Op.in]: ['admin', 'editor'] }
        }
      });

      if (!membership) {
        console.log(`❌ Usuario ${userId} sin permisos para editar diagrama`);
        return res.status(403).json({
          success: false,
          message: 'Sin permisos para editar este diagrama'
        });
      }

      console.log(`✅ Usuario es miembro con rol: ${membership.role}`);
    } else {
      console.log(`✅ Usuario es propietario del proyecto`);
    }

    // Actualizar campos
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (content !== undefined) {
      updateData.content = typeof content === 'string' ? JSON.parse(content) : content;
      updateData.lastModified = new Date();
    }

    console.log(`🔄 Actualizando diagrama con datos:`, Object.keys(updateData));

    await diagramExists.update(updateData);

    console.log(`✅ Diagrama actualizado: ${diagramExists.name} por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Diagrama actualizado exitosamente',
      data: diagramExists
    });

  } catch (error) {
    console.error('❌ Error actualizando diagrama:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

/**
 * Eliminar diagrama
 * DELETE /api/diagrams/:id
 */
const deleteDiagram = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar permisos (solo owner o admin)
    const diagram = await Diagram.findOne({
      where: { id, isActive: true },
      include: [{
        model: Project,
        as: 'project',
        where: {
          [Op.or]: [
            { ownerId: userId },
            sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "project"."id" AND pm.user_id = '${userId}' AND pm.role = 'admin')`)
          ]
        }
      }]
    });

    if (!diagram) {
      return res.status(404).json({
        success: false,
        message: 'Diagrama no encontrado o sin permisos'
      });
    }

    // Soft delete
    await diagram.update({ isActive: false });

    console.log(`✅ Diagrama eliminado: ${diagram.name} por ${req.user.username}`);

    res.json({
      success: true,
      message: 'Diagrama eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando diagrama:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Obtener versiones del diagrama
 * GET /api/diagrams/:id/versions
 */
const getDiagramVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Verificar acceso al diagrama
    const diagram = await Diagram.findOne({
      where: { id, isActive: true },
      include: [{
        model: Project,
        as: 'project',
        where: {
          [Op.or]: [
            { ownerId: userId },
            sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "project"."id" AND pm.user_id = '${userId}')`),
            { isPublic: true }
          ]
        }
      }]
    });

    if (!diagram) {
      return res.status(404).json({
        success: false,
        message: 'Diagrama no encontrado'
      });
    }

    const versions = await DiagramVersion.findAndCountAll({
      where: { diagramId: id },
      include: [{
        model: User,
        as: 'createdBy',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        versions: versions.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: versions.count,
          pages: Math.ceil(versions.count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo versiones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

/**
 * Crear nueva versión del diagrama
 * POST /api/diagrams/:id/versions
 */
const createDiagramVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { versionName, changes, content } = req.body;
    const userId = req.user.id;

    // Verificar permisos de edición
    const diagram = await Diagram.findOne({
      where: { id, isActive: true },
      include: [{
        model: Project,
        as: 'project',
        where: {
          [Op.or]: [
            { ownerId: userId },
            sequelize.literal(`EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = "project"."id" AND pm.user_id = '${userId}' AND pm.role IN ('admin','editor'))`)
          ]
        }
      }]
    });

    if (!diagram) {
      return res.status(404).json({
        success: false,
        message: 'Diagrama no encontrado o sin permisos'
      });
    }

    // Crear nueva versión
    const version = await DiagramVersion.create({
      diagramId: id,
      versionName: versionName || `Versión ${new Date().toISOString()}`,
      changes: changes || 'Sin descripción de cambios',
      content: typeof content === 'string' ? JSON.parse(content) : content,
      createdById: userId
    });

    // Incluir información del creador
    const versionWithCreator = await DiagramVersion.findByPk(version.id, {
      include: [{
        model: User,
        as: 'createdBy',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }]
    });

    console.log(`✅ Versión creada para diagrama: ${diagram.name} por ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Versión creada exitosamente',
      data: versionWithCreator
    });

  } catch (error) {
    console.error('Error creando versión:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getDiagram,
  updateDiagram,
  deleteDiagram,
  getDiagramVersions,
  createDiagramVersion
};
