/**
 * Script de prueba para verificar la integración con Gemini Pro
 * Ejecutar con: node test-ai.js
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiIntegration() {
    console.log('🧪 Probando integración con Gemini Pro...\n');

    // Verificar API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-pro-api-key-here') {
        console.error('❌ GEMINI_API_KEY no configurada correctamente.');
        console.log('📖 Lee GEMINI_SETUP.md para obtener instrucciones.');
        process.exit(1);
    }

    try {
        // Inicializar Gemini Pro
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        console.log('✅ API Key configurada correctamente');
        console.log('🚀 Probando conexión con Gemini Pro...\n');

        // Prueba simple
        const prompt = `Eres un experto en UML. Responde brevemente: ¿Qué es un diagrama de clases UML?`;
        
        console.log('📤 Enviando prompt de prueba...');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('📥 Respuesta recibida:');
        console.log('─'.repeat(50));
        console.log(text);
        console.log('─'.repeat(50));

        console.log('\n✅ ¡Integración con Gemini Pro exitosa!');
        console.log('🎉 El sistema de IA está listo para usar.');

        // Prueba del modo agente
        console.log('\n🤖 Probando modo agente...');
        const agentPrompt = `Responde SOLO en formato JSON válido. Crea un diagrama simple con dos clases: Usuario y Perfil, con una relación de composición.

{
  "message": "Creando diagrama simple con Usuario y Perfil",
  "actions": [
    {
      "type": "create_class",
      "data": {
        "name": "Usuario",
        "attributes": ["+id: Long", "+email: String"],
        "methods": ["+login(): boolean"]
      }
    },
    {
      "type": "create_class", 
      "data": {
        "name": "Perfil",
        "attributes": ["+nombre: String", "+avatar: String"],
        "methods": ["+actualizarPerfil(): void"]
      }
    }
  ]
}`;

        const agentResult = await model.generateContent(agentPrompt);
        const agentResponse = await agentResult.response;
        const agentText = agentResponse.text();

        console.log('📥 Respuesta del agente:');
        console.log('─'.repeat(50));
        console.log(agentText);
        console.log('─'.repeat(50));

        try {
            const jsonMatch = agentText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('✅ Respuesta JSON válida del agente');
                console.log(`📊 Acciones generadas: ${parsed.actions?.length || 0}`);
            } else {
                console.log('⚠️ Respuesta no contiene JSON válido (normal en pruebas)');
            }
        } catch (e) {
            console.log('⚠️ Error parseando JSON (normal en pruebas):', e.message);
        }

    } catch (error) {
        console.error('❌ Error probando Gemini Pro:', error.message);
        
        if (error.message.includes('API key')) {
            console.log('💡 Verifica que tu API key sea válida');
        } else if (error.message.includes('quota')) {
            console.log('💡 Has excedido el límite de la API gratuita');
        } else {
            console.log('💡 Verifica tu conexión a internet');
        }
        
        process.exit(1);
    }
}

// Ejecutar prueba
testGeminiIntegration();
