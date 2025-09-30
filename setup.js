/**
 * Script de configuración inicial
 * Ayuda a configurar el entorno de desarrollo
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  console.log('🚀 Configuración inicial del UML CDP Backend\n');

  // Verificar si ya existe .env
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  El archivo .env ya existe. ¿Sobrescribir? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('✅ Configuración cancelada');
      rl.close();
      return;
    }
  }

  console.log('📋 Necesitamos configurar la conexión a Supabase:\n');

  // Obtener configuración de Supabase
  const dbUrl = await question('🔗 URL de Supabase (postgresql://postgres:password@host:port/database): ');
  
  const jwtSecret = await question('🔐 JWT Secret (o presiona Enter para generar uno): ');
  const jwtRefreshSecret = await question('🔐 JWT Refresh Secret (o presiona Enter para generar uno): ');

  // Generar secrets si no se proporcionaron
  const finalJwtSecret = jwtSecret || generateRandomString(64);
  const finalJwtRefreshSecret = jwtRefreshSecret || generateRandomString(64);

  // Crear contenido del .env
  const envContent = `# Configuración del Servidor
PORT=3001
NODE_ENV=development

# Base de Datos Supabase
DB_URL=${dbUrl}

# JWT Configuration
JWT_SECRET=${finalJwtSecret}
JWT_REFRESH_SECRET=${finalJwtRefreshSecret}

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
SOCKET_CORS_ORIGIN=http://localhost:3000

# OpenAI Configuration (para IA en futuras fases)
# OPENAI_API_KEY=your-openai-api-key-here
`;

  // Escribir archivo .env
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Archivo .env creado exitosamente');
    console.log('📁 Ubicación:', envPath);
    
    console.log('\n🔧 Próximos pasos:');
    console.log('1. Verifica que la URL de Supabase sea correcta');
    console.log('2. Ejecuta: npm run seed');
    console.log('3. Ejecuta: npm run dev');
    
  } catch (error) {
    console.error('❌ Error creando archivo .env:', error.message);
  }

  rl.close();
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Ejecutar configuración
setupEnvironment().catch(console.error);