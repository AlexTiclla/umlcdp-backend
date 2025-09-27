const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const colors = require('colors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const coloredLogger = morgan((tokens, req, res) => {
  const status = tokens.status(req, res);
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const responseTime = tokens['response-time'](req, res);
  const date = new Date().toISOString();
  
  // Colores para diferentes códigos de estado
  let coloredStatus;
  if (status >= 500) {
    coloredStatus = colors.red.bold(status); // Errores del servidor - rojo
  } else if (status >= 400) {
    coloredStatus = colors.yellow.bold(status); // Errores del cliente - amarillo
  } else if (status >= 300) {
    coloredStatus = colors.blue.bold(status); // Redirecciones - azul
  } else if (status >= 200) {
    coloredStatus = colors.green.bold(status); // Éxito - verde
  } else {
    coloredStatus = colors.white(status); // Otros - blanco
  }
  
  // Colores para métodos HTTP
  let coloredMethod;
  switch (method) {
    case 'GET':
      coloredMethod = colors.cyan(method);
      break;
    case 'POST':
      coloredMethod = colors.green(method);
      break;
    case 'PUT':
      coloredMethod = colors.yellow(method);
      break;
    case 'DELETE':
      coloredMethod = colors.red(method);
      break;
    case 'PATCH':
      coloredMethod = colors.magenta(method);
      break;
    default:
      coloredMethod = colors.white(method);
  }
  
  return `${coloredMethod} ${colors.white(url)} ${coloredStatus} ${responseTime}ms - ${colors.gray(date)}`;
});

// Configuración de Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Configuración de Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'UML CDP Backend API',
      version: '1.0.0',
      description: 'API para herramienta colaborativa de diseño de base de datos',
      contact: {
        name: 'Tu Nombre',
        email: 'tu-email@ejemplo.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'] // Rutas donde están tus endpoints
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware global
app.use(helmet());
app.use(compression());
app.use(coloredLogger);
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rutas
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/projects', require('./src/routes/projects'));
app.use('/api/diagrams', require('./src/routes/diagrams'));
app.use('/api/users', require('./src/routes/users'));

// Servir archivos estáticos
app.use('/generated', express.static('public/generated-code'));

// Manejo de Socket.io
require('./src/utils/socketHandlers')(io);

// Middleware de manejo de errores
// app.use(require('./src/middleware/errorHandler'));

// Ruta de prueba
app.get('/api', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'UML CDP Backend is running',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

// Asegurar sincronización de modelos al iniciar (crea tablas faltantes)
const { sequelize } = require('./src/models');

server.listen(PORT, async () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api`);
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados con la base de datos');
  } catch (err) {
    console.error('❌ Error sincronizando modelos:', err.message);
  }
});