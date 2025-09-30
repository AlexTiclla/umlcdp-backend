const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

// Middleware de autenticación para todas las rutas de IA
router.use(authenticateToken);

/**
 * @route POST /api/ai/chat
 * @desc Procesar mensaje de chat con IA
 * @access Private
 */
router.post('/chat', aiController.chat);

/**
 * @route GET /api/ai/history
 * @desc Obtener historial de interacciones con IA
 * @access Private
 */
router.get('/history', aiController.getInteractionHistory);

/**
 * @route GET /api/ai/stats
 * @desc Obtener estadísticas de uso de IA
 * @access Private
 */
router.get('/stats', aiController.getAIStats);

/**
 * @route GET /api/ai/health
 * @desc Verificar estado del servicio de IA
 * @access Private
 */
router.get('/health', aiController.healthCheck);

module.exports = router;
