const express = require('express');
const router = express.Router();
const codeGenerationController = require('../controllers/codeGenerationController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Code Generation
 *   description: API para generación de código backend
 * 
 * components:
 *   schemas:
 *     GeneratedCode:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único del código generado
 *         diagram_id:
 *           type: string
 *           format: uuid
 *           description: ID del diagrama fuente
 *         version:
 *           type: string
 *           description: Versión del código generado
 *         language:
 *           type: string
 *           enum: [java, spring-boot, python, php]
 *           description: Lenguaje del código generado
 *         code_structure:
 *           type: object
 *           description: Estructura del código generado
 *         files:
 *           type: object
 *           description: Archivos generados y su contenido
 *         is_valid:
 *           type: boolean
 *           description: Si el código generado es válido
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación
 */

// Middleware de autenticación para todas las rutas
router.use(auth.authenticateToken);

/**
 * @swagger
 * /api/code-generation/diagrams/{diagramId}/generate:
 *   post:
 *     summary: Generar código backend para un diagrama
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagramId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del diagrama
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [java, spring-boot, python, php]
 *               projectName:
 *                 type: string
 *               packageName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Código generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 generatedCodeId:
 *                   type: string
 *                   format: uuid
 *                 structure:
 *                   type: object
 *                 fileCount:
 *                   type: integer
 *                 downloadUrl:
 *                   type: string
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Diagrama no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/diagrams/:diagramId/generate', codeGenerationController.generateBackend);

/**
 * @swagger
 * /api/code-generation/{generatedCodeId}/download:
 *   get:
 *     summary: Descargar proyecto generado como ZIP
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: generatedCodeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del código generado
 *     responses:
 *       200:
 *         description: Archivo ZIP del proyecto
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Código generado no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:generatedCodeId/download', codeGenerationController.downloadProject);

/**
 * @swagger
 * /api/code-generation/diagrams/{diagramId}/history:
 *   get:
 *     summary: Obtener historial de código generado para un diagrama
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: diagramId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del diagrama
 *     responses:
 *       200:
 *         description: Historial de código generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 history:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GeneratedCode'
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.get('/diagrams/:diagramId/history', codeGenerationController.getGeneratedCodeHistory);

/**
 * @swagger
 * /api/code-generation/{generatedCodeId}:
 *   get:
 *     summary: Obtener detalles de código generado específico
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: generatedCodeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del código generado
 *     responses:
 *       200:
 *         description: Detalles del código generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 generatedCode:
 *                   $ref: '#/components/schemas/GeneratedCode'
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Código generado no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:generatedCodeId', codeGenerationController.getGeneratedCodeDetails);

/**
 * @swagger
 * /api/code-generation/{generatedCodeId}:
 *   delete:
 *     summary: Eliminar código generado
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: generatedCodeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del código generado
 *     responses:
 *       200:
 *         description: Código generado eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Código generado no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete('/:generatedCodeId', codeGenerationController.deleteGeneratedCode);

/**
 * @swagger
 * /api/code-generation/{generatedCodeId}/files/{filePath}:
 *   get:
 *     summary: Obtener archivo específico del código generado
 *     tags: [Code Generation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: generatedCodeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del código generado
 *       - in: path
 *         name: filePath
 *         required: true
 *         schema:
 *           type: string
 *         description: Ruta del archivo dentro del proyecto
 *     responses:
 *       200:
 *         description: Contenido del archivo
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *           text/x-java-source:
 *             schema:
 *               type: string
 *           application/xml:
 *             schema:
 *               type: string
 *           text/yaml:
 *             schema:
 *               type: string
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Archivo no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get('/:generatedCodeId/files/*', (req, res) => {
  // Extraer el path del archivo de la URL
  const filePath = req.params[0];
  req.params.filePath = filePath;
  codeGenerationController.getGeneratedFile(req, res);
});

module.exports = router;
