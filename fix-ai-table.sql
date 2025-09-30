-- Script SQL para arreglar la tabla ai_interactions
-- Ejecutar en tu cliente de PostgreSQL (pgAdmin, psql, etc.)

-- 1. Eliminar la tabla si existe (esto eliminará todos los datos)
DROP TABLE IF EXISTS ai_interactions CASCADE;

-- 2. Crear la tabla ai_interactions con la estructura correcta
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    diagram_id UUID,
    interaction_type VARCHAR(20) NOT NULL DEFAULT 'ask' CHECK (interaction_type IN ('ask', 'agent')),
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    confidence_score FLOAT CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Crear índices para optimizar consultas
CREATE INDEX idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX idx_ai_interactions_diagram_id ON ai_interactions(diagram_id);
CREATE INDEX idx_ai_interactions_interaction_type ON ai_interactions(interaction_type);
CREATE INDEX idx_ai_interactions_created_at ON ai_interactions(created_at);

-- 4. Agregar claves foráneas (ajusta los nombres de tabla según tu esquema)
-- Nota: Descomenta estas líneas si las tablas users y diagrams existen
-- ALTER TABLE ai_interactions 
--     ADD CONSTRAINT fk_ai_interactions_user_id 
--     FOREIGN KEY (user_id) REFERENCES users(id) 
--     ON UPDATE CASCADE ON DELETE CASCADE;

-- ALTER TABLE ai_interactions 
--     ADD CONSTRAINT fk_ai_interactions_diagram_id 
--     FOREIGN KEY (diagram_id) REFERENCES diagrams(id) 
--     ON UPDATE CASCADE ON DELETE SET NULL;

-- 5. Comentarios en la tabla
COMMENT ON TABLE ai_interactions IS 'Tabla para almacenar interacciones con IA';
COMMENT ON COLUMN ai_interactions.id IS 'ID único de la interacción';
COMMENT ON COLUMN ai_interactions.user_id IS 'ID del usuario que realizó la interacción';
COMMENT ON COLUMN ai_interactions.diagram_id IS 'ID del diagrama relacionado (opcional)';
COMMENT ON COLUMN ai_interactions.interaction_type IS 'Tipo de interacción: ask o agent';
COMMENT ON COLUMN ai_interactions.prompt IS 'Prompt enviado por el usuario';
COMMENT ON COLUMN ai_interactions.response IS 'Respuesta generada por la IA';
COMMENT ON COLUMN ai_interactions.context IS 'Contexto adicional en formato JSON';
COMMENT ON COLUMN ai_interactions.confidence_score IS 'Puntuación de confianza de la respuesta (0.0-1.0)';
COMMENT ON COLUMN ai_interactions.created_at IS 'Fecha y hora de creación';

-- 6. Verificar que la tabla se creó correctamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ai_interactions' 
ORDER BY ordinal_position;

-- 7. Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '✅ Tabla ai_interactions creada exitosamente';
    RAISE NOTICE '📊 Estructura:';
    RAISE NOTICE '   - id: UUID (PK)';
    RAISE NOTICE '   - user_id: UUID (FK a users)';
    RAISE NOTICE '   - diagram_id: UUID (FK a diagrams, nullable)';
    RAISE NOTICE '   - interaction_type: VARCHAR(20) (ask/agent)';
    RAISE NOTICE '   - prompt: TEXT';
    RAISE NOTICE '   - response: TEXT';
    RAISE NOTICE '   - context: JSONB';
    RAISE NOTICE '   - confidence_score: FLOAT (0.0-1.0)';
    RAISE NOTICE '   - created_at: TIMESTAMP WITH TIME ZONE';
    RAISE NOTICE '🎉 ¡Listo para usar!';
END $$;
