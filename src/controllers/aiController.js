const { GoogleGenerativeAI } = require('@google/generative-ai');
const { AIInteraction } = require('../models');
const { v4: uuidv4 } = require('uuid');

class AIController {
    constructor() {
        // Inicialización lazy - se hará cuando se necesite
        this.genAI = null;
        this.model = null;
        this.initialized = false;

        this.systemPrompts = {
            ask: `Eres un experto en UML y diseño de software. Tu trabajo es ayudar a los usuarios a entender y mejorar sus diagramas UML de clases.

Puedes:
- Analizar diagramas UML existentes
- Sugerir mejoras de diseño
- Explicar conceptos de UML
- Responder preguntas sobre patrones de diseño
- Validar buenas prácticas

Responde siempre en español, de manera clara y educativa. Si no tienes información sobre el diagrama, pregunta por más detalles.`,

            agent: `Eres un asistente IA que puede crear y modificar diagramas UML automáticamente. Tu trabajo es interpretar las solicitudes del usuario y generar las acciones necesarias para crear o modificar diagramas.

Cuando el usuario te pida crear un diagrama, debes:
1. Analizar el dominio solicitado
2. Identificar las entidades principales
3. Definir atributos y métodos para cada clase
4. Establecer relaciones apropiadas

Responde SIEMPRE en formato JSON con esta estructura:
{
  "message": "Descripción de lo que vas a crear",
  "actions": [
    {
      "type": "create_class|create_interface|create_abstract_class|create_relationship",
      "data": {
        "name": "NombreClase",
        "attributes": ["atributo1: tipo", "atributo2: tipo"],
        "methods": ["metodo1(): tipo", "metodo2(param: tipo): tipo"],
        "position": {"x": 100, "y": 100}
      }
    }
  ]
}

Para relaciones usa:
{
  "type": "create_relationship",
  "data": {
    "type": "association|inheritance|implementation|composition|aggregation",
    "sourceId": "id_clase_origen",
    "targetId": "id_clase_destino",
    "sourceMultiplicity": "1",
    "targetMultiplicity": "*"
  }
}

Responde siempre en español pero el JSON debe mantener las claves en inglés.`
        };
    }

    /**
     * Inicializar Gemini Pro de forma lazy
     */
    initializeGemini() {
        if (this.initialized) {
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your-gemini-pro-api-key-here') {
            console.warn('⚠️ GEMINI_API_KEY no configurada. Funcionalidad de IA deshabilitada.');
            this.genAI = null;
            this.model = null;
        } else {
            try {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                console.log('✅ Gemini Pro inicializado correctamente');
            } catch (error) {
                console.error('❌ Error inicializando Gemini Pro:', error.message);
                this.genAI = null;
                this.model = null;
            }
        }
        this.initialized = true;
    }

    async chat(req, res) {
        try {
            // Inicializar Gemini Pro si no está inicializado
            this.initializeGemini();

            const { message, mode, diagramData, conversationHistory } = req.body;
            const userId = req.user.id;
            const diagramId = req.body.diagramId || null;

            // Validar entrada
            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Message is required'
                });
            }

            if (!this.genAI) {
                return res.status(503).json({
                    success: false,
                    error: 'AI service not available. Please configure GEMINI_API_KEY.'
                });
            }

            // Preparar el prompt
            const systemPrompt = this.systemPrompts[mode] || this.systemPrompts.ask;
            const context = this.buildContext(diagramData, conversationHistory);
            const fullPrompt = `${systemPrompt}\n\n${context}\n\nUsuario: ${message}`;

            console.log('🤖 Procesando solicitud de IA:', {
                mode,
                messageLength: message.length,
                hasDigramData: !!diagramData,
                userId
            });

            // Llamar a Gemini Pro
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            let aiResponse = response.text();

            console.log('📝 Respuesta de Gemini Pro recibida:', {
                responseLength: aiResponse.length,
                mode
            });

            // Procesar respuesta según el modo
            let processedResponse;
            if (mode === 'agent') {
                processedResponse = this.processAgentResponse(aiResponse);
            } else {
                processedResponse = {
                    message: aiResponse,
                    mode: 'ask'
                };
            }

            // Guardar interacción en la base de datos
            await this.saveInteraction(userId, diagramId, mode, message, aiResponse);

            res.json({
                success: true,
                ...processedResponse
            });

        } catch (error) {
            console.error('Error en chat de IA:', error);
            
            // Manejar errores específicos de Gemini
            if (error.message?.includes('API key')) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid API key configuration'
                });
            }

            if (error.message?.includes('quota')) {
                return res.status(429).json({
                    success: false,
                    error: 'API quota exceeded. Please try again later.'
                });
            }

            res.status(500).json({
                success: false,
                error: 'Internal server error processing AI request'
            });
        }
    }

    buildContext(diagramData, conversationHistory) {
        let context = '';

        // Agregar información del diagrama actual
        if (diagramData) {
            context += `\nDiagrama actual:\n`;
            context += `- ${diagramData.elementCount} elementos\n`;
            context += `- ${diagramData.linkCount} relaciones\n`;

            if (diagramData.elements && diagramData.elements.length > 0) {
                context += `\nClases en el diagrama:\n`;
                diagramData.elements.forEach(element => {
                    const name = element.name?.replace(/<<.*?>>\n/, '') || 'Sin nombre';
                    context += `- ${name}`;
                    if (element.attributes && element.attributes.length > 0) {
                        context += ` (${element.attributes.length} atributos)`;
                    }
                    if (element.methods && element.methods.length > 0) {
                        context += ` (${element.methods.length} métodos)`;
                    }
                    context += `\n`;
                });
            }
        } else {
            context += `\nEl diagrama está vacío.`;
        }

        // Agregar historial de conversación reciente
        if (conversationHistory && conversationHistory.length > 0) {
            context += `\nConversación reciente:\n`;
            conversationHistory.slice(-3).forEach(conv => {
                context += `Usuario: ${conv.user}\n`;
                context += `IA: ${conv.ai}\n`;
            });
        }

        return context;
    }

    processAgentResponse(aiResponse) {
        try {
            // Intentar parsear como JSON
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonResponse = JSON.parse(jsonMatch[0]);
                
                // Validar estructura
                if (jsonResponse.message && jsonResponse.actions) {
                    return {
                        message: jsonResponse.message,
                        actions: this.validateActions(jsonResponse.actions),
                        mode: 'agent'
                    };
                }
            }

            // Si no es JSON válido, tratar como mensaje normal
            return {
                message: aiResponse,
                mode: 'ask'
            };

        } catch (error) {
            console.warn('Error procesando respuesta de agente:', error);
            return {
                message: aiResponse,
                mode: 'ask'
            };
        }
    }

    validateActions(actions) {
        if (!Array.isArray(actions)) return [];

        return actions.filter(action => {
            if (!action.type || !action.data) return false;

            const validTypes = [
                'create_class',
                'create_interface', 
                'create_abstract_class',
                'create_relationship',
                'modify_element',
                'delete_element'
            ];

            return validTypes.includes(action.type);
        }).map(action => {
            // Generar IDs únicos para nuevos elementos
            if (['create_class', 'create_interface', 'create_abstract_class'].includes(action.type)) {
                action.data.id = uuidv4();
            }

            // Asegurar posición por defecto
            if (!action.data.position) {
                action.data.position = { x: 100, y: 100 };
            }

            return action;
        });
    }

    async saveInteraction(userId, diagramId, interactionType, prompt, response) {
        try {
            await AIInteraction.create({
                id: uuidv4(),
                user_id: userId,
                diagram_id: diagramId,
                interaction_type: interactionType,
                prompt: prompt,
                response: response,
                context: {
                    timestamp: new Date().toISOString(),
                    mode: interactionType
                },
                confidence_score: 1.0, // Por ahora un valor fijo
                created_at: new Date()
            });

            console.log('💾 Interacción de IA guardada en base de datos');
        } catch (error) {
            console.error('Error guardando interacción de IA:', error);
            // No lanzar error para no interrumpir el flujo principal
        }
    }

    async getInteractionHistory(req, res) {
        try {
            const userId = req.user.id;
            const { diagramId, limit = 50 } = req.query;

            const whereClause = { user_id: userId };
            if (diagramId) {
                whereClause.diagram_id = diagramId;
            }

            const interactions = await AIInteraction.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                attributes: [
                    'id',
                    'interaction_type',
                    'prompt',
                    'response',
                    'confidence_score',
                    'created_at'
                ]
            });

            res.json({
                success: true,
                interactions: interactions.reverse() // Orden cronológico
            });

        } catch (error) {
            console.error('Error obteniendo historial de IA:', error);
            res.status(500).json({
                success: false,
                error: 'Error retrieving AI interaction history'
            });
        }
    }

    async getAIStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await AIInteraction.findAll({
                where: { user_id: userId },
                attributes: [
                    'interaction_type',
                    [AIInteraction.sequelize.fn('COUNT', AIInteraction.sequelize.col('id')), 'count']
                ],
                group: ['interaction_type']
            });

            const totalInteractions = await AIInteraction.count({
                where: { user_id: userId }
            });

            res.json({
                success: true,
                stats: {
                    total: totalInteractions,
                    byType: stats.reduce((acc, stat) => {
                        acc[stat.interaction_type] = parseInt(stat.dataValues.count);
                        return acc;
                    }, {})
                }
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas de IA:', error);
            res.status(500).json({
                success: false,
                error: 'Error retrieving AI statistics'
            });
        }
    }

    // Método para verificar el estado del servicio de IA
    async healthCheck(req, res) {
        // Inicializar Gemini Pro si no está inicializado
        this.initializeGemini();
        
        const isAvailable = !!this.genAI;
        
        res.json({
            success: true,
            aiServiceAvailable: isAvailable,
            model: isAvailable ? 'gemini-pro' : null,
            status: isAvailable ? 'operational' : 'unavailable'
        });
    }
}

const aiController = new AIController();

// Bind methods to preserve 'this' context
module.exports = {
    chat: aiController.chat.bind(aiController),
    getInteractionHistory: aiController.getInteractionHistory.bind(aiController),
    getAIStats: aiController.getAIStats.bind(aiController),
    healthCheck: aiController.healthCheck.bind(aiController)
};
