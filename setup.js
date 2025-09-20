const fs = require('fs');
const path = require('path');

const structure = [
  'src/controllers',
  'src/middleware', 
  'src/models',
  'src/routes',
  'src/services',
  'src/utils',
  'src/config',
  'public/generated-code',
  'uploads'
];

structure.forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`✅ Creado: ${dir}`);
});

console.log('�� Estructura de carpetas creada exitosamente!');