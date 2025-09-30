const { GeneratedCode, Diagram } = require('../models');
const SpringBootGenerator = require('../services/SpringBootGenerator');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

class CodeGenerationController {
  /**
   * Generar código backend completo
   */
  async generateBackend(req, res) {
    try {
      const { diagramId } = req.params;
      const { language = 'spring-boot', projectName, packageName, databaseConfig } = req.body;

      // Validar que el ID sea un UUID válido
      if (!diagramId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
        return res.status(400).json({
          success: false,
          error: 'ID de diagrama inválido. Debe ser un UUID válido.',
          code: 'INVALID_UUID'
        });
      }

      // Verificar que el diagrama existe
      let diagram;
      try {
        console.log(`Buscando diagrama con ID: ${diagramId}`);
        diagram = await Diagram.findByPk(diagramId, {
          include: ['project']
        });

        if (!diagram) {
          console.log(`Diagrama no encontrado con ID: ${diagramId}`);
          return res.status(404).json({
            success: false,
            error: 'Diagrama no encontrado',
            code: 'DIAGRAM_NOT_FOUND'
          });
        }
        
        console.log(`Diagrama encontrado: ${diagram.id}, Nombre: ${diagram.name}`);
        console.log(`Contenido del diagrama: ${diagram.content ? 'Presente' : 'Ausente'}`);
        if (diagram.content) {
          console.log(`Tipo de contenido: ${typeof diagram.content}`);
          if (typeof diagram.content === 'object') {
            console.log(`Estructura del contenido: ${Object.keys(diagram.content).join(', ')}`);
            if (diagram.content.elements) {
              console.log(`Número de elementos: ${diagram.content.elements.length}`);
              diagram.content.elements.forEach((element, index) => {
                console.log(`Elemento ${index}: id=${element.id}, type=${element.type}, name=${element.name}`);
              });
            }
            if (diagram.content.links) {
              console.log(`Número de links: ${diagram.content.links.length}`);
            }
          }
        }
      } catch (error) {
        console.error('Error buscando diagrama:', error);
        return res.status(500).json({
          success: false,
          error: 'Error al buscar el diagrama',
          code: 'DATABASE_ERROR',
          details: error.message
        });
      }

      // Verificar que el diagrama tiene elementos (clases) - hacer esto antes del bloque condicional
      const elements = diagram.content.elements || diagram.content.cells || [];
      const classElements = elements.filter(element => 
        element.type && (
          element.type.includes('uml.Class') || 
          element.type.includes('Class') ||
          element.type === 'uml.Class'
        )
      );

      console.log(`Clases encontradas en el diagrama: ${classElements.length}`);
      if (classElements.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'El diagrama no contiene clases UML válidas',
          code: 'NO_CLASSES_FOUND'
        });
      }

      // Generar el código según el lenguaje especificado
      let generatedFiles = {};
      let codeStructure = {};

      if (language === 'spring-boot') {
        const generator = new SpringBootGenerator({
          projectName: projectName || 'generated-project',
          packageName: packageName || 'com.example.generated',
          databaseConfig: databaseConfig || {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            username: process.env.DB_USER,
            password: process.env.DB_PASSWORD
          }
        });

        // Verificar que el diagrama tiene contenido
        if (!diagram.content) {
          return res.status(400).json({
            success: false,
            error: 'El diagrama no tiene contenido',
            code: 'EMPTY_DIAGRAM'
          });
        }

        const result = await generator.generateProject(diagram.content);
        generatedFiles = result.files;
        codeStructure = result.structure;
      } else {
        return res.status(400).json({
          error: 'Lenguaje no soportado. Usa "spring-boot"'
        });
      }

      // Guardar el código generado en la base de datos
      const generatedCode = await GeneratedCode.create({
        diagram_id: diagramId,
        version: '1.0.0',
        language,
        code_structure: codeStructure,
        files: generatedFiles,
        is_valid: true
      });

      // Categorizar archivos por tipo
      const fileCategories = {
        entities: Object.keys(generatedFiles).filter(f => f.includes('/entity/')).length,
        repositories: Object.keys(generatedFiles).filter(f => f.includes('/repository/')).length,
        services: Object.keys(generatedFiles).filter(f => f.includes('/service/')).length,
        controllers: Object.keys(generatedFiles).filter(f => f.includes('/controller/')).length,
        dtos: Object.keys(generatedFiles).filter(f => f.includes('/dto/')).length,
        mappers: Object.keys(generatedFiles).filter(f => f.includes('/mapper/')).length,
        config: Object.keys(generatedFiles).filter(f => f.includes('/config/')).length,
        other: Object.keys(generatedFiles).filter(f => 
          !f.includes('/entity/') && !f.includes('/repository/') && 
          !f.includes('/service/') && !f.includes('/controller/') && 
          !f.includes('/dto/') && !f.includes('/mapper/') && 
          !f.includes('/config/')
        ).length
      };

      res.json({
        success: true,
        generatedCodeId: generatedCode.id,
        structure: codeStructure,
        fileCount: Object.keys(generatedFiles).length,
        fileCategories,
        classesFound: classElements.length,
        downloadUrl: `/api/code-generation/${generatedCode.id}/download`,
        message: `Código Spring Boot generado exitosamente para ${classElements.length} clases`
      });

    } catch (error) {
      console.error('Error generando código:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * Descargar proyecto generado como ZIP
   */
  async downloadProject(req, res) {
    try {
      const { generatedCodeId } = req.params;
      
      console.log(`Iniciando descarga de proyecto con ID: ${generatedCodeId}`);
      console.log(`Usuario autenticado: ${req.user ? req.user.username : 'No autenticado'}`);
      
      // Verificar que el usuario está autenticado
      if (!req.user) {
        console.log('Error: Usuario no autenticado al intentar descargar proyecto');
        return res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
      }

      console.log(`Buscando código generado con ID: ${generatedCodeId}`);
      const generatedCode = await GeneratedCode.findByPk(generatedCodeId, {
        include: [{
          model: Diagram,
          as: 'diagram',
          include: ['project']
        }]
      });

      if (!generatedCode) {
        console.log(`Código generado no encontrado con ID: ${generatedCodeId}`);
        return res.status(404).json({
          success: false,
          error: 'Código generado no encontrado',
          code: 'CODE_NOT_FOUND'
        });
      }
      
      console.log(`Código generado encontrado: ${generatedCode.id}, Lenguaje: ${generatedCode.language}`);
      console.log(`Archivos a incluir: ${Object.keys(generatedCode.files).length}`);

      const projectName = generatedCode.code_structure?.projectName || 'generated-project';
      console.log(`Nombre del proyecto: ${projectName}`);
      
      try {
        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${projectName}.zip"`);
        
        console.log('Headers configurados para descarga ZIP');

        // Crear el archivo ZIP
        const archive = archiver('zip', {
          zlib: { level: 9 }
        });

        // Manejar errores del archiver
        archive.on('error', (err) => {
          console.error('Error creando ZIP:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Error creando archivo ZIP',
              details: err.message
            });
          }
        });

        // Manejar eventos del archiver
        archive.on('progress', (progress) => {
          console.log(`Progreso de ZIP: ${progress.entries.processed}/${progress.entries.total} archivos`);
        });

        // Pipe del archive al response
        archive.pipe(res);

        // Agregar archivos al ZIP
        const files = generatedCode.files;
        Object.keys(files).forEach(filePath => {
          console.log(`Agregando archivo al ZIP: ${filePath}`);
          archive.append(files[filePath], { name: filePath });
        });

        console.log('Finalizando archivo ZIP...');
        // Finalizar el archivo
        await archive.finalize();
        console.log('Descarga de ZIP completada exitosamente');
      } catch (zipError) {
        console.error('Error creando o enviando ZIP:', zipError);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error creando o enviando archivo ZIP',
            details: zipError.message
          });
        }
      }
    } catch (error) {
      console.error('Error descargando proyecto:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          details: error.message
        });
      }
    }
  }

  /**
   * Obtener historial de código generado para un diagrama
   */
  async getGeneratedCodeHistory(req, res) {
    try {
      const { diagramId } = req.params;

      const generatedCodes = await GeneratedCode.findAll({
        where: { diagram_id: diagramId },
        order: [['created_at', 'DESC']],
        attributes: ['id', 'version', 'language', 'is_valid', 'created_at', 'code_structure']
      });

      res.json({
        success: true,
        history: generatedCodes
      });

    } catch (error) {
      console.error('Error obteniendo historial:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * Obtener detalles de código generado específico
   */
  async getGeneratedCodeDetails(req, res) {
    try {
      const { generatedCodeId } = req.params;

      const generatedCode = await GeneratedCode.findByPk(generatedCodeId, {
        include: [{
          model: Diagram,
          as: 'diagram',
          attributes: ['id', 'name', 'description']
        }]
      });

      if (!generatedCode) {
        return res.status(404).json({
          error: 'Código generado no encontrado'
        });
      }

      res.json({
        success: true,
        generatedCode: {
          id: generatedCode.id,
          version: generatedCode.version,
          language: generatedCode.language,
          structure: generatedCode.code_structure,
          isValid: generatedCode.is_valid,
          compilationErrors: generatedCode.compilation_errors,
          createdAt: generatedCode.created_at,
          diagram: generatedCode.diagram,
          fileList: Object.keys(generatedCode.files)
        }
      });

    } catch (error) {
      console.error('Error obteniendo detalles:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * Eliminar código generado
   */
  async deleteGeneratedCode(req, res) {
    try {
      const { generatedCodeId } = req.params;

      const deleted = await GeneratedCode.destroy({
        where: { id: generatedCodeId }
      });

      if (!deleted) {
        return res.status(404).json({
          error: 'Código generado no encontrado'
        });
      }

      res.json({
        success: true,
        message: 'Código generado eliminado correctamente'
      });

    } catch (error) {
      console.error('Error eliminando código:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * Obtener archivo específico del código generado
   */
  async getGeneratedFile(req, res) {
    try {
      const { generatedCodeId, filePath } = req.params;

      const generatedCode = await GeneratedCode.findByPk(generatedCodeId);

      if (!generatedCode) {
        return res.status(404).json({
          error: 'Código generado no encontrado'
        });
      }

      const decodedFilePath = decodeURIComponent(filePath);
      const fileContent = generatedCode.files[decodedFilePath];

      if (!fileContent) {
        return res.status(404).json({
          error: 'Archivo no encontrado'
        });
      }

      // Determinar el tipo de contenido
      let contentType = 'text/plain';
      if (decodedFilePath.endsWith('.java')) {
        contentType = 'text/x-java-source';
      } else if (decodedFilePath.endsWith('.xml')) {
        contentType = 'application/xml';
      } else if (decodedFilePath.endsWith('.properties')) {
        contentType = 'text/plain';
      } else if (decodedFilePath.endsWith('.yml') || decodedFilePath.endsWith('.yaml')) {
        contentType = 'text/yaml';
      }

      res.setHeader('Content-Type', contentType);
      res.send(fileContent);

    } catch (error) {
      console.error('Error obteniendo archivo:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }
}

module.exports = new CodeGenerationController();
