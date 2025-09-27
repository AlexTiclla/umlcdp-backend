const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const projectController = require('../controllers/projectController');
const { authenticateToken, checkProjectPermission } = require('../middleware/auth');

// Validaciones
const createProjectValidation = [
  body('name')
    .notEmpty()
    .withMessage('El nombre del proyecto es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('visibility')
    .optional()
    .isIn(['private', 'public', 'team'])
    .withMessage('La visibilidad debe ser: private, public o team'),
  
  body('settings')
    .optional()
    .isObject()
    .withMessage('Los settings deben ser un objeto válido')
];

const updateProjectValidation = [
  param('id').isUUID().withMessage('ID de proyecto inválido'),
  ...createProjectValidation
];

const inviteMemberValidation = [
  param('id').isUUID().withMessage('ID de proyecto inválido'),
  body('email')
    .isEmail()
    .withMessage('Email válido requerido')
    .normalizeEmail(),
  
  body('role')
    .optional()
    .isIn(['viewer', 'editor', 'admin'])
    .withMessage('El rol debe ser: viewer, editor o admin')
];

const createDiagramValidation = [
  param('id').isUUID().withMessage('ID de proyecto inválido'),
  body('name')
    .notEmpty()
    .withMessage('El nombre del diagrama es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El nombre debe tener entre 1 y 100 caracteres'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('La descripción no puede exceder 500 caracteres'),
  
  body('content')
    .optional()
    .custom((value) => {
      if (value && typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch (e) {
          throw new Error('El contenido debe ser un JSON válido');
        }
      }
      return true;
    })
];

const projectParamValidation = [
  param('id').isUUID().withMessage('ID de proyecto inválido')
];

const memberParamValidation = [
  param('id').isUUID().withMessage('ID de proyecto inválido'),
  param('userId').isUUID().withMessage('ID de usuario inválido')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         ownerId:
 *           type: string
 *           format: uuid
 *         visibility:
 *           type: string
 *           enum: [private, public, team]
 *         settings:
 *           type: object
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lastModifiedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Obtener proyectos del usuario
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: visibility
 *         schema:
 *           type: string
 *           enum: [private, public, team]
 *     responses:
 *       200:
 *         description: Lista de proyectos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     pagination:
 *                       type: object
 */
router.get('/', authenticateToken, projectController.getProjects);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Obtener proyecto específico
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Datos del proyecto
 *       404:
 *         description: Proyecto no encontrado
 */
router.get('/:id', authenticateToken, projectParamValidation, projectController.getProject);

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Crear nuevo proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team]
 *                 default: private
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Proyecto creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/', authenticateToken, createProjectValidation, projectController.createProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Actualizar proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [private, public, team]
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Proyecto actualizado
 *       404:
 *         description: Proyecto no encontrado
 */
router.put('/:id', authenticateToken, updateProjectValidation, projectController.updateProject);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Eliminar proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Proyecto eliminado
 *       404:
 *         description: Proyecto no encontrado
 */
router.delete('/:id', authenticateToken, projectParamValidation, projectController.deleteProject);

/**
 * @swagger
 * /api/projects/{id}/members:
 *   post:
 *     summary: Invitar miembro al proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, admin]
 *                 default: viewer
 *     responses:
 *       201:
 *         description: Usuario invitado exitosamente
 *       404:
 *         description: Proyecto o usuario no encontrado
 */
router.post('/:id/members', authenticateToken, inviteMemberValidation, projectController.inviteMember);

/**
 * @swagger
 * /api/projects/{id}/members/{userId}:
 *   delete:
 *     summary: Remover miembro del proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Miembro removido
 *       404:
 *         description: Miembro no encontrado
 */
router.delete('/:id/members/:userId', authenticateToken, memberParamValidation, projectController.removeMember);

/**
 * @swagger
 * /api/projects/{id}/diagrams:
 *   get:
 *     summary: Obtener diagramas de un proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lista de diagramas del proyecto
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     diagrams:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Diagram'
 *                     pagination:
 *                       type: object
 *       404:
 *         description: Proyecto no encontrado
 */
router.get('/:id/diagrams', authenticateToken, projectParamValidation, projectController.getProjectDiagrams);

/**
 * @swagger
 * /api/projects/{id}/diagrams:
 *   post:
 *     summary: Crear diagrama en un proyecto
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               content:
 *                 type: object
 *     responses:
 *       201:
 *         description: Diagrama creado exitosamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: Proyecto no encontrado
 */
router.post('/:id/diagrams', authenticateToken, createDiagramValidation, projectController.createProjectDiagram);

module.exports = router;
