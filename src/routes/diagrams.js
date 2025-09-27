const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const diagramController = require('../controllers/diagramController');
const { authenticateToken, checkProjectPermission } = require('../middleware/auth');

// Validaciones
const createDiagramValidation = [
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

const updateDiagramValidation = [
  param('id').isUUID().withMessage('ID de diagrama inválido'),
  body('name')
    .optional()
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

const diagramParamValidation = [
  param('id').isUUID().withMessage('ID de diagrama inválido')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Diagram:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         projectId:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         content:
 *           type: object
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/diagrams/{id}:
 *   get:
 *     summary: Obtener diagrama específico
 *     tags: [Diagrams]
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
 *         description: Datos del diagrama
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Diagram'
 *       404:
 *         description: Diagrama no encontrado
 */
router.get('/:id', authenticateToken, diagramParamValidation, diagramController.getDiagram);

/**
 * @swagger
 * /api/diagrams/{id}:
 *   put:
 *     summary: Actualizar diagrama
 *     tags: [Diagrams]
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
 *               content:
 *                 type: object
 *     responses:
 *       200:
 *         description: Diagrama actualizado
 *       404:
 *         description: Diagrama no encontrado
 */
router.put('/:id', authenticateToken, updateDiagramValidation, diagramController.updateDiagram);

/**
 * @swagger
 * /api/diagrams/{id}:
 *   delete:
 *     summary: Eliminar diagrama
 *     tags: [Diagrams]
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
 *         description: Diagrama eliminado
 *       404:
 *         description: Diagrama no encontrado
 */
router.delete('/:id', authenticateToken, diagramParamValidation, diagramController.deleteDiagram);

/**
 * @swagger
 * /api/diagrams/{id}/versions:
 *   get:
 *     summary: Obtener versiones del diagrama
 *     tags: [Diagrams]
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
 *         description: Lista de versiones del diagrama
 */
router.get('/:id/versions', authenticateToken, diagramParamValidation, diagramController.getDiagramVersions);

/**
 * @swagger
 * /api/diagrams/{id}/versions:
 *   post:
 *     summary: Crear nueva versión del diagrama
 *     tags: [Diagrams]
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
 *               versionName:
 *                 type: string
 *               changes:
 *                 type: string
 *               content:
 *                 type: object
 *     responses:
 *       201:
 *         description: Versión creada exitosamente
 */
router.post('/:id/versions', authenticateToken, diagramParamValidation, diagramController.createDiagramVersion);

module.exports = router;
