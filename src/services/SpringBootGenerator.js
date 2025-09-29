class SpringBootGenerator {
  constructor(config) {
    this.config = {
      projectName: config.projectName || 'generated-project',
      packageName: config.packageName || 'com.example.generated',
      databaseConfig: config.databaseConfig || {},
      springBootVersion: '3.2.0',
      javaVersion: '17'
    };
  }

  async generateProject(diagramContent) {
    try {
      // Parsear el contenido del diagrama
      const elements = this.parseDiagramElements(diagramContent);
      const relationships = this.parseDiagramRelationships(diagramContent);

      // Generar estructura del proyecto
      const structure = this.generateProjectStructure(elements, relationships);

      // Generar archivos
      const files = {};

      // Archivos de configuración
      files['pom.xml'] = this.generatePomXml();
      files['src/main/resources/application.properties'] = this.generateApplicationProperties();
      files['README.md'] = this.generateReadme();
      files['Dockerfile'] = this.generateDockerfile();
      files['.gitignore'] = this.generateGitignore();

      // Archivo principal de la aplicación
      const mainClassName = this.toPascalCase(this.config.projectName.replace(/-/g, '')) + 'Application';
      files[`src/main/java/${this.packageToPath()}/${mainClassName}.java`] = this.generateMainApplication();

      // Configuraciones
      files[`src/main/java/${this.packageToPath()}/config/DatabaseConfig.java`] = this.generateDatabaseConfig();
      files[`src/main/java/${this.packageToPath()}/config/SwaggerConfig.java`] = this.generateSwaggerConfig();

      // Generar entidades
      elements.forEach(element => {
        const entityFiles = this.generateEntity(element, relationships, elements);
        Object.assign(files, entityFiles);
      });

      // Generar DTOs
      elements.forEach(element => {
        const dtoFiles = this.generateDTOs(element);
        Object.assign(files, dtoFiles);
      });

      // Generar repositorios
      elements.forEach(element => {
        const repoFile = this.generateRepository(element);
        Object.assign(files, repoFile);
      });

      // Generar servicios
      elements.forEach(element => {
        const serviceFiles = this.generateService(element);
        Object.assign(files, serviceFiles);
      });

      // Generar controladores
      elements.forEach(element => {
        const controllerFile = this.generateController(element);
        Object.assign(files, controllerFile);
      });

      // Generar mappers
      const MapperGenerator = require('./MapperGenerator');
      const mapperGenerator = new MapperGenerator(this.config);
      elements.forEach(element => {
        files[`src/main/java/${this.packageToPath()}/mapper/${element.name}Mapper.java`] = mapperGenerator.generateMapper(element);
      });

      // Generar manejador global de excepciones
      files[`src/main/java/${this.packageToPath()}/exception/GlobalExceptionHandler.java`] = this.generateGlobalExceptionHandler();

      // Generar clases de respuesta
      files[`src/main/java/${this.packageToPath()}/dto/response/ApiResponse.java`] = this.generateApiResponse();

      console.log('=== GENERACIÓN COMPLETADA ===');
      console.log(`Entidades procesadas: ${elements.length}`);
      console.log(`Archivos generados: ${Object.keys(files).length}`);
      console.log('Lista de archivos generados:');
      Object.keys(files).forEach(filePath => {
        console.log(`- ${filePath}`);
      });

      return {
        structure,
        files
      };

    } catch (error) {
      console.error('Error generating Spring Boot project:', error);
      throw error;
    }
  }

  parseDiagramElements(diagramContent) {
    console.log('Parsing diagram content:', JSON.stringify(diagramContent, null, 2));
    
    if (!diagramContent) {
      console.log('No diagram content provided');
      return [];
    }

    // El contenido puede venir en formato nuevo (elements) o legacy (cells)
    const elements = diagramContent.elements || diagramContent.cells || [];
    console.log(`Found ${elements.length} elements to parse`);

    const parsedElements = elements
      .filter(element => {
        const isClass = element.type && (
          element.type.includes('uml.Class') || 
          element.type.includes('Class') ||
          element.type === 'uml.Class'
        );
        console.log(`Element ${element.id}: type=${element.type}, isClass=${isClass}`);
        return isClass;
      })
      .map(element => {
        const parsedElement = {
          id: element.id,
          name: this.sanitizeClassName(element.name || 'UnnamedClass'),
          attributes: element.attributes || [],
          methods: element.methods || [],
          isInterface: element.name && element.name.includes('<<interface>>'),
          isAbstract: element.name && element.name.includes('<<abstract>>')
        };
        console.log('Parsed element:', parsedElement);
        return parsedElement;
      });

    console.log(`Successfully parsed ${parsedElements.length} class elements`);
    return parsedElements;
  }

  parseDiagramRelationships(diagramContent) {
    console.log('Parsing diagram relationships');
    
    if (!diagramContent) {
      console.log('No diagram content provided for relationships');
      return [];
    }

    // El contenido puede venir en formato nuevo (links) o legacy (cells con Links)
    const links = diagramContent.links || 
                  (diagramContent.cells && diagramContent.cells.filter(cell => cell.type && cell.type.includes('Link'))) || 
                  [];
    
    console.log(`Found ${links.length} links to parse`);

    const parsedRelationships = links.map(link => {
      const relationship = {
        id: link.id,
        type: link.type,
        source: link.source?.id || link.source,
        target: link.target?.id || link.target,
        sourceMultiplicity: this.extractMultiplicity(link.labels, 0),
        targetMultiplicity: this.extractMultiplicity(link.labels, 1)
      };
      console.log('Parsed relationship:', relationship);
      return relationship;
    });

    console.log(`Successfully parsed ${parsedRelationships.length} relationships`);
    return parsedRelationships;
  }

  extractMultiplicity(labels, index) {
    if (!labels || !labels[index]) return '1';
    return labels[index].attrs?.text?.text || '1';
  }

  sanitizeClassName(name) {
    return name
      .replace(/<<interface>>\n|<<abstract>>\n/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .replace(/^[0-9]/, 'Entity$&') // Si empieza con número
      || 'Entity';
  }

  packageToPath() {
    return this.config.packageName.replace(/\./g, '/');
  }

  generateProjectStructure(elements, relationships) {
    return {
      projectName: this.config.projectName,
      packageName: this.config.packageName,
      entities: elements.map(e => e.name),
      relationships: relationships.length,
      springBootVersion: this.config.springBootVersion,
      javaVersion: this.config.javaVersion
    };
  }

  generatePomXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>${this.config.springBootVersion}</version>
        <relativePath/>
    </parent>

    <groupId>${this.config.packageName}</groupId>
    <artifactId>${this.config.projectName}</artifactId>
    <version>1.0.0</version>
    <name>${this.config.projectName}</name>
    <description>Generated Spring Boot project from UML diagram</description>

    <properties>
        <java.version>${this.config.javaVersion}</java.version>
        <mapstruct.version>1.5.5.Final</mapstruct.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>

        <!-- Base de datos PostgreSQL -->
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        
        <!-- HikariCP connection pool (incluido en spring-boot-starter-data-jpa) -->
        <dependency>
            <groupId>com.zaxxer</groupId>
            <artifactId>HikariCP</artifactId>
        </dependency>

        <!-- MapStruct para mapeo de DTOs -->
        <dependency>
            <groupId>org.mapstruct</groupId>
            <artifactId>mapstruct</artifactId>
            <version>\${mapstruct.version}</version>
        </dependency>

        <!-- Swagger/OpenAPI -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.2.0</version>
        </dependency>

        <!-- Desarrollo -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-devtools</artifactId>
            <scope>runtime</scope>
            <optional>true</optional>
        </dependency>

        <!-- Testing -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        
        <dependency>
            <groupId>com.h2database</groupId>
            <artifactId>h2</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
            
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.11.0</version>
                <configuration>
                    <source>\${java.version}</source>
                    <target>\${java.version}</target>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.mapstruct</groupId>
                            <artifactId>mapstruct-processor</artifactId>
                            <version>\${mapstruct.version}</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;
  }

  generateApplicationProperties() {
    return `# Configuración del servidor
server.port=8080
server.servlet.context-path=/api

# Configuración de la base de datos - Supabase PostgreSQL
# jdbc:postgresql://aws-1-us-east-2.pooler.supabase.com:5432/postgres?user=postgres.vrfokwwheuomvygwzvit&password=postgres
spring.datasource.url=jdbc:postgresql://aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require
spring.datasource.username=postgres.vrfokwwheuomvygwzvit
spring.datasource.password=postgres
spring.datasource.driver-class-name=org.postgresql.Driver

# Configuración adicional para Supabase
spring.datasource.hikari.connection-timeout=20000
spring.datasource.hikari.maximum-pool-size=10

# JPA/Hibernate - Configuración para crear tablas automáticamente
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=true
spring.jpa.format-sql=true
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.properties.hibernate.default_schema=public
spring.jpa.properties.hibernate.jdbc.lob.non_contextual_creation=true
spring.jpa.generate-ddl=true
spring.jpa.defer-datasource-initialization=true

# Configuración adicional para inicialización de esquema
spring.sql.init.mode=always
spring.sql.init.continue-on-error=false

# Jackson
spring.jackson.serialization.write-dates-as-timestamps=false
spring.jackson.time-zone=America/La_Paz

# Swagger/OpenAPI
springdoc.api-docs.path=/api-docs
springdoc.swagger-ui.path=/swagger-ui.html
springdoc.swagger-ui.operations-sorter=method

# Logging
logging.level.${this.config.packageName}=DEBUG
logging.level.org.springframework.web=INFO
logging.level.org.hibernate.SQL=DEBUG
logging.level.org.hibernate.type.descriptor.sql.BasicBinder=TRACE

# Configuración de CORS
cors.allowed-origins=http://localhost:3000,http://localhost:3001
cors.allowed-methods=GET,POST,PUT,DELETE,OPTIONS
cors.allowed-headers=*
cors.allow-credentials=true

# Configuración de archivos
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB`;
  }

  generateMainApplication() {
    const className = this.toPascalCase(this.config.projectName.replace(/-/g, '')) + 'Application';
    return `package ${this.config.packageName};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
// import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Aplicación principal generada automáticamente desde diagrama UML
 * 
 * @author UML Code Generator
 * @version 1.0.0
 */
@SpringBootApplication
// @EnableJpaAuditing
public class ${className} {

    public static void main(String[] args) {
        SpringApplication.run(${className}.class, args);
        System.out.println("🚀 Aplicación ${this.config.projectName} iniciada correctamente");
        System.out.println("📊 Swagger UI: http://localhost:8080/api/swagger-ui.html");
        System.out.println("📋 API Docs: http://localhost:8080/api/api-docs");
    }
}`;
  }

  generateEntity(element, relationships, elements) {
    const files = {};
    const entityName = element.name;
    const packagePath = this.packageToPath();
    
    // Generar las relaciones JPA
    const entityRelations = this.generateEntityRelations(element, relationships, elements);
    
    const content = `package ${this.config.packageName}.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.HashSet;
import java.util.Objects;

/**
 * Entidad ${entityName} generada desde diagrama UML
 * 
 * @author UML Code Generator
 */
@Entity
@Table(name = "${this.toSnakeCase(entityName)}")
@EntityListeners(AuditingEntityListener.class)
public class ${entityName} {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

${this.generateEntityAttributes(element.attributes)}

${entityRelations}

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Constructores
    public ${entityName}() {}

${this.generateEntityConstructor(entityName, element.attributes)}

    // Getters y Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

${this.generateEntityGettersSetters(element.attributes)}

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

${this.generateEntityRelationGettersSetters(element, relationships, elements)}

    // equals, hashCode y toString
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${entityName} entity = (${entityName}) o;
        return Objects.equals(id, entity.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "${entityName}{" +
                "id=" + id +
${this.generateToStringAttributes(element.attributes)}
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}`;

    files[`src/main/java/${packagePath}/entity/${entityName}.java`] = content;
    return files;
  }

  generateEntityAttributes(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const columnName = this.toSnakeCase(parsed.name);
      const validations = this.generateValidations(parsed);

      return `    ${validations}
    @Column(name = "${columnName}")
    private ${javaType} ${parsed.name};
`;
    }).join('\n');
  }

  generateEntityRelations(element, relationships, allElements) {
    const relations = relationships.filter(rel => 
      rel.source === element.id || rel.target === element.id
    );

    return relations.map(rel => {
      const isSource = rel.source === element.id;
      const multiplicity = isSource ? rel.targetMultiplicity : rel.sourceMultiplicity;
      const relatedEntityId = isSource ? rel.target : rel.source;
      
      // Buscar el nombre real de la entidad relacionada
      const relatedEntity = allElements.find(e => e.id === relatedEntityId);
      const relatedEntityName = relatedEntity ? relatedEntity.name : `RelatedEntity${relatedEntityId}`;
      
      return this.generateJPARelation(rel.type, multiplicity, relatedEntityName, isSource);
    }).join('\n');
  }

  generateJPARelation(relationType, multiplicity, relatedEntityName, isSource) {
    const fieldName = this.toCamelCase(relatedEntityName);
    
    if (multiplicity === '*' || multiplicity.includes('*')) {
      // Relación de uno a muchos o muchos a muchos
      return `    @OneToMany(mappedBy = "${this.toCamelCase(relatedEntityName)}", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Set<${relatedEntityName}> ${fieldName}s = new HashSet<>();
`;
    } else {
      // Relación de uno a uno o muchos a uno
      return `    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "${this.toSnakeCase(relatedEntityName)}_id")
    private ${relatedEntityName} ${fieldName};
`;
    }
  }

  generateEntityRelationGettersSetters(element, relationships, elements) {
    const relations = relationships.filter(rel => 
      rel.source === element.id || rel.target === element.id
    );

    return relations.map(rel => {
      const isSource = rel.source === element.id;
      const multiplicity = isSource ? rel.targetMultiplicity : rel.sourceMultiplicity;
      const relatedEntityId = isSource ? rel.target : rel.source;
      
      // Buscar el nombre real de la entidad relacionada
      const relatedEntity = elements.find(e => e.id === relatedEntityId);
      const relatedEntityName = relatedEntity ? relatedEntity.name : `RelatedEntity${relatedEntityId}`;
      const fieldName = this.toCamelCase(relatedEntityName);
      
      if (multiplicity === '*' || multiplicity.includes('*')) {
        // Getter y setter para colecciones
        return `    public Set<${relatedEntityName}> get${this.toPascalCase(fieldName)}s() {
        return ${fieldName}s;
    }

    public void set${this.toPascalCase(fieldName)}s(Set<${relatedEntityName}> ${fieldName}s) {
        this.${fieldName}s = ${fieldName}s;
    }

    public void add${this.toPascalCase(fieldName)}(${relatedEntityName} ${fieldName}) {
        this.${fieldName}s.add(${fieldName});
    }

    public void remove${this.toPascalCase(fieldName)}(${relatedEntityName} ${fieldName}) {
        this.${fieldName}s.remove(${fieldName});
    }`;
      } else {
        // Getter y setter para objetos individuales
        return `    public ${relatedEntityName} get${this.toPascalCase(fieldName)}() {
        return ${fieldName};
    }

    public void set${this.toPascalCase(fieldName)}(${relatedEntityName} ${fieldName}) {
        this.${fieldName} = ${fieldName};
    }`;
      }
    }).join('\n\n');
  }

  parseAttribute(attrStr) {
    const match = attrStr.match(/^([+\-#~])?(\w+)(?:\s*:\s*(.+))?$/);
    if (!match) return null;

    return {
      visibility: match[1] || '+',
      name: match[2],
      type: match[3]?.trim() || 'String'
    };
  }

  generateValidations(parsed) {
    const validations = [];
    
    if (parsed.type === 'String') {
      validations.push('@NotBlank(message = "' + parsed.name + ' no puede estar vacío")');
      validations.push('@Size(max = 255, message = "' + parsed.name + ' no puede exceder 255 caracteres")');
    } else if (parsed.type === 'int' || parsed.type === 'Integer') {
      validations.push('@NotNull(message = "' + parsed.name + ' es requerido")');
    }

    return validations.join('\n    ');
  }

  mapUMLTypeToJava(umlType) {
    const typeMap = {
      'String': 'String',
      'int': 'Integer',
      'Integer': 'Integer',
      'long': 'Long',
      'Long': 'Long',
      'float': 'Float',
      'Float': 'Float',
      'double': 'Double',
      'Double': 'Double',
      'boolean': 'Boolean',
      'Boolean': 'Boolean',
      'Date': 'LocalDateTime',
      'DateTime': 'LocalDateTime',
      'LocalDateTime': 'LocalDateTime',
      'BigDecimal': 'BigDecimal',
      'List': 'List',
      'Set': 'Set'
    };

    return typeMap[umlType] || 'String';
  }

  generateEntityConstructor(entityName, attributes) {
    const params = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      const javaType = this.mapUMLTypeToJava(parsed.type);
      return `${javaType} ${parsed.name}`;
    }).filter(p => p).join(', ');

    const assignments = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return `        this.${parsed.name} = ${parsed.name};`;
    }).filter(a => a).join('\n');

    return `    public ${entityName}(${params}) {
${assignments}
    }`;
  }

  generateEntityGettersSetters(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const capitalizedName = this.toPascalCase(parsed.name);

      return `    public ${javaType} get${capitalizedName}() {
        return ${parsed.name};
    }

    public void set${capitalizedName}(${javaType} ${parsed.name}) {
        this.${parsed.name} = ${parsed.name};
    }`;
    }).join('\n\n');
  }

  generateToStringAttributes(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return `                ", ${parsed.name}=" + ${parsed.name} +`;
    }).join('\n');
  }

  toPascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  // Continuación en la siguiente parte...
  generateDTOs(element) {
    const files = {};
    const entityName = element.name;
    const packagePath = this.packageToPath();

    // DTO principal
    files[`src/main/java/${packagePath}/dto/${entityName}DTO.java`] = this.generateMainDTO(element);
    
    // DTO para creación
    files[`src/main/java/${packagePath}/dto/Create${entityName}DTO.java`] = this.generateCreateDTO(element);
    
    // DTO para actualización
    files[`src/main/java/${packagePath}/dto/Update${entityName}DTO.java`] = this.generateUpdateDTO(element);

    return files;
  }

  generateMainDTO(element) {
    const entityName = element.name;
    
    return `package ${this.config.packageName}.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * DTO para ${entityName}
 * 
 * @author UML Code Generator
 */
@Schema(description = "DTO de ${entityName}")
public class ${entityName}DTO {

    @Schema(description = "ID único del ${entityName}", example = "1")
    private Long id;

${this.generateDTOAttributes(element.attributes)}

    @Schema(description = "Fecha de creación")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    @Schema(description = "Fecha de última actualización")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;

    // Constructores
    public ${entityName}DTO() {}

${this.generateDTOConstructor(entityName, element.attributes)}

    // Getters y Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

${this.generateDTOGettersSetters(element.attributes)}

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ${entityName}DTO that = (${entityName}DTO) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "${entityName}DTO{" +
                "id=" + id +
${this.generateToStringAttributes(element.attributes)}
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}`;
  }

  generateCreateDTO(element) {
    const entityName = element.name;
    
    return `package ${this.config.packageName}.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Objects;

/**
 * DTO para crear ${entityName}
 * 
 * @author UML Code Generator
 */
@Schema(description = "DTO para crear ${entityName}")
public class Create${entityName}DTO {

${this.generateCreateDTOAttributes(element.attributes)}

    // Constructores
    public Create${entityName}DTO() {}

${this.generateCreateDTOConstructor(entityName, element.attributes)}

    // Getters y Setters
${this.generateDTOGettersSetters(element.attributes)}

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Create${entityName}DTO that = (Create${entityName}DTO) o;
        return ${this.generateEqualsComparison(element.attributes)};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${this.generateHashCodeFields(element.attributes)});
    }

    @Override
    public String toString() {
        return "Create${entityName}DTO{" +
${this.generateToStringAttributes(element.attributes)}
                '}';
    }
}`;
  }

  generateUpdateDTO(element) {
    const entityName = element.name;
    
    return `package ${this.config.packageName}.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Objects;

/**
 * DTO para actualizar ${entityName}
 * 
 * @author UML Code Generator
 */
@Schema(description = "DTO para actualizar ${entityName}")
public class Update${entityName}DTO {

${this.generateUpdateDTOAttributes(element.attributes)}

    // Constructores
    public Update${entityName}DTO() {}

${this.generateUpdateDTOConstructor(entityName, element.attributes)}

    // Getters y Setters
${this.generateDTOGettersSetters(element.attributes)}

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Update${entityName}DTO that = (Update${entityName}DTO) o;
        return ${this.generateEqualsComparison(element.attributes)};
    }

    @Override
    public int hashCode() {
        return Objects.hash(${this.generateHashCodeFields(element.attributes)});
    }

    @Override
    public String toString() {
        return "Update${entityName}DTO{" +
${this.generateToStringAttributes(element.attributes)}
                '}';
    }
}`;
  }

  generateDTOAttributes(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const description = `Descripción de ${parsed.name}`;
      
      return `    @Schema(description = "${description}")
    private ${javaType} ${parsed.name};
`;
    }).join('\n');
  }

  generateCreateDTOAttributes(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const validations = this.generateValidations(parsed);
      const description = `${parsed.name} para el nuevo ${parsed.name}`;
      
      return `    ${validations}
    @Schema(description = "${description}", required = true)
    private ${javaType} ${parsed.name};
`;
    }).join('\n');
  }

  generateUpdateDTOAttributes(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const description = `${parsed.name} actualizado`;
      
      return `    @Schema(description = "${description}")
    private ${javaType} ${parsed.name};
`;
    }).join('\n');
  }

  generateDTOConstructor(entityName, attributes) {
    const params = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      const javaType = this.mapUMLTypeToJava(parsed.type);
      return `${javaType} ${parsed.name}`;
    }).filter(p => p).join(', ');

    const assignments = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return `        this.${parsed.name} = ${parsed.name};`;
    }).filter(a => a).join('\n');

    return `    public ${entityName}DTO(${params}) {
${assignments}
    }`;
  }

  generateCreateDTOConstructor(entityName, attributes) {
    const params = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      const javaType = this.mapUMLTypeToJava(parsed.type);
      return `${javaType} ${parsed.name}`;
    }).filter(p => p).join(', ');

    const assignments = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return `        this.${parsed.name} = ${parsed.name};`;
    }).filter(a => a).join('\n');

    return `    public Create${entityName}DTO(${params}) {
${assignments}
    }`;
  }

  generateUpdateDTOConstructor(entityName, attributes) {
    return this.generateCreateDTOConstructor(entityName, attributes).replace(/Create/g, 'Update');
  }

  generateDTOGettersSetters(attributes) {
    return attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const javaType = this.mapUMLTypeToJava(parsed.type);
      const capitalizedName = this.toPascalCase(parsed.name);

      return `    public ${javaType} get${capitalizedName}() {
        return ${parsed.name};
    }

    public void set${capitalizedName}(${javaType} ${parsed.name}) {
        this.${parsed.name} = ${parsed.name};
    }`;
    }).join('\n\n');
  }

  generateEqualsComparison(attributes) {
    const comparisons = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return `Objects.equals(${parsed.name}, that.${parsed.name})`;
    }).filter(c => c);

    return comparisons.join(' && ');
  }

  generateHashCodeFields(attributes) {
    const fields = attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';
      return parsed.name;
    }).filter(f => f);

    return fields.join(', ');
  }

  generateRepository(element) {
    const files = {};
    const entityName = element.name;
    const packagePath = this.packageToPath();

    const content = `package ${this.config.packageName}.repository;

import ${this.config.packageName}.entity.${entityName};
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio para ${entityName}
 * 
 * @author UML Code Generator
 */
@Repository
public interface ${entityName}Repository extends JpaRepository<${entityName}, Long> {

    /**
     * Buscar ${entityName} por estado activo
     */
    @Query("SELECT e FROM ${entityName} e WHERE e.id = :id")
    Optional<${entityName}> findByIdActive(@Param("id") Long id);

    /**
     * Buscar todos los ${entityName} con paginación
     */
    Page<${entityName}> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Buscar ${entityName} creados en un rango de fechas
     */
    @Query("SELECT e FROM ${entityName} e WHERE e.createdAt BETWEEN :startDate AND :endDate ORDER BY e.createdAt DESC")
    List<${entityName}> findByCreatedAtBetween(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    /**
     * Contar ${entityName} por estado
     */
    @Query("SELECT COUNT(e) FROM ${entityName} e")
    long countTotal();

${this.generateCustomRepositoryQueries(element)}
}`;

    files[`src/main/java/${packagePath}/repository/${entityName}Repository.java`] = content;
    return files;
  }

  generateCustomRepositoryQueries(element) {
    // Generar queries personalizados basados en los atributos
    return element.attributes.map(attr => {
      const parsed = this.parseAttribute(attr);
      if (!parsed) return '';

      const capitalizedName = this.toPascalCase(parsed.name);
      const javaType = this.mapUMLTypeToJava(parsed.type);

      if (javaType === 'String') {
        return `    /**
     * Buscar ${element.name} por ${parsed.name}
     */
    Optional<${element.name}> findBy${capitalizedName}(${javaType} ${parsed.name});

    /**
     * Buscar ${element.name} que contengan texto en ${parsed.name}
     */
    @Query("SELECT e FROM ${element.name} e WHERE LOWER(e.${parsed.name}) LIKE LOWER(CONCAT('%', :${parsed.name}, '%'))")
    List<${element.name}> findBy${capitalizedName}ContainingIgnoreCase(@Param("${parsed.name}") String ${parsed.name});`;
      } else {
        return `    /**
     * Buscar ${element.name} por ${parsed.name}
     */
    List<${element.name}> findBy${capitalizedName}(${javaType} ${parsed.name});`;
      }
    }).join('\n\n');
  }

  generateService(element) {
    const files = {};
    const entityName = element.name;
    const packagePath = this.packageToPath();

    // Interfaz del servicio
    files[`src/main/java/${packagePath}/service/${entityName}Service.java`] = this.generateServiceInterface(element);
    
    // Implementación del servicio
    files[`src/main/java/${packagePath}/service/impl/${entityName}ServiceImpl.java`] = this.generateServiceImplementation(element);

    return files;
  }

  generateServiceInterface(element) {
    const entityName = element.name;
    
    return `package ${this.config.packageName}.service;

import ${this.config.packageName}.dto.${entityName}DTO;
import ${this.config.packageName}.dto.Create${entityName}DTO;
import ${this.config.packageName}.dto.Update${entityName}DTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

/**
 * Servicio para ${entityName}
 * 
 * @author UML Code Generator
 */
public interface ${entityName}Service {

    /**
     * Crear un nuevo ${entityName}
     */
    ${entityName}DTO create(Create${entityName}DTO create${entityName}DTO);

    /**
     * Obtener ${entityName} por ID
     */
    Optional<${entityName}DTO> findById(Long id);

    /**
     * Obtener todos los ${entityName} con paginación
     */
    Page<${entityName}DTO> findAll(Pageable pageable);

    /**
     * Obtener todos los ${entityName}
     */
    List<${entityName}DTO> findAll();

    /**
     * Actualizar ${entityName}
     */
    Optional<${entityName}DTO> update(Long id, Update${entityName}DTO update${entityName}DTO);

    /**
     * Eliminar ${entityName}
     */
    boolean delete(Long id);

    /**
     * Verificar si existe ${entityName}
     */
    boolean existsById(Long id);

    /**
     * Contar total de ${entityName}
     */
    long count();

${this.generateCustomServiceMethods(element)}
}`;
  }

  generateServiceImplementation(element) {
    const entityName = element.name;
    
    return `package ${this.config.packageName}.service.impl;

import ${this.config.packageName}.dto.${entityName}DTO;
import ${this.config.packageName}.dto.Create${entityName}DTO;
import ${this.config.packageName}.dto.Update${entityName}DTO;
import ${this.config.packageName}.entity.${entityName};
import ${this.config.packageName}.repository.${entityName}Repository;
import ${this.config.packageName}.service.${entityName}Service;
import ${this.config.packageName}.mapper.${entityName}Mapper;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Implementación del servicio para ${entityName}
 * 
 * @author UML Code Generator
 */
@Service
@Transactional
public class ${entityName}ServiceImpl implements ${entityName}Service {

    private final ${entityName}Repository ${this.toCamelCase(entityName)}Repository;
    private final ${entityName}Mapper ${this.toCamelCase(entityName)}Mapper;

    @Autowired
    public ${entityName}ServiceImpl(${entityName}Repository ${this.toCamelCase(entityName)}Repository, ${entityName}Mapper ${this.toCamelCase(entityName)}Mapper) {
        this.${this.toCamelCase(entityName)}Repository = ${this.toCamelCase(entityName)}Repository;
        this.${this.toCamelCase(entityName)}Mapper = ${this.toCamelCase(entityName)}Mapper;
    }

    @Override
    public ${entityName}DTO create(Create${entityName}DTO create${entityName}DTO) {
        ${entityName} entity = ${this.toCamelCase(entityName)}Mapper.toEntity(create${entityName}DTO);
        ${entityName} saved = ${this.toCamelCase(entityName)}Repository.save(entity);
        return ${this.toCamelCase(entityName)}Mapper.toDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<${entityName}DTO> findById(Long id) {
        return ${this.toCamelCase(entityName)}Repository.findById(id)
                .map(${this.toCamelCase(entityName)}Mapper::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<${entityName}DTO> findAll(Pageable pageable) {
        return ${this.toCamelCase(entityName)}Repository.findAll(pageable)
                .map(${this.toCamelCase(entityName)}Mapper::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<${entityName}DTO> findAll() {
        return ${this.toCamelCase(entityName)}Repository.findAll()
                .stream()
                .map(${this.toCamelCase(entityName)}Mapper::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<${entityName}DTO> update(Long id, Update${entityName}DTO update${entityName}DTO) {
        return ${this.toCamelCase(entityName)}Repository.findById(id)
                .map(entity -> {
                    ${this.toCamelCase(entityName)}Mapper.updateEntityFromDTO(update${entityName}DTO, entity);
                    ${entityName} updated = ${this.toCamelCase(entityName)}Repository.save(entity);
                    return ${this.toCamelCase(entityName)}Mapper.toDTO(updated);
                });
    }

    @Override
    public boolean delete(Long id) {
        if (${this.toCamelCase(entityName)}Repository.existsById(id)) {
            ${this.toCamelCase(entityName)}Repository.deleteById(id);
            return true;
        }
        return false;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean existsById(Long id) {
        return ${this.toCamelCase(entityName)}Repository.existsById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public long count() {
        return ${this.toCamelCase(entityName)}Repository.count();
    }

${this.generateCustomServiceImplementations(element)}
}`;
  }

  generateCustomServiceMethods(element) {
    // Generar métodos personalizados basados en atributos
    return '';
  }

  generateCustomServiceImplementations(element) {
    // Generar implementaciones de métodos personalizados
    return '';
  }

  generateController(element) {
    const files = {};
    const entityName = element.name;
    const packagePath = this.packageToPath();

    const content = `package ${this.config.packageName}.controller;

import ${this.config.packageName}.dto.${entityName}DTO;
import ${this.config.packageName}.dto.Create${entityName}DTO;
import ${this.config.packageName}.dto.Update${entityName}DTO;
import ${this.config.packageName}.dto.response.ApiResponse;
import ${this.config.packageName}.service.${entityName}Service;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controlador REST para ${entityName}
 * 
 * @author UML Code Generator
 */
@RestController
@RequestMapping("/api/${this.toKebabCase(entityName)}s")
@Tag(name = "${entityName}", description = "API para gestión de ${entityName}")
@CrossOrigin(origins = "*")
public class ${entityName}Controller {

    private final ${entityName}Service ${this.toCamelCase(entityName)}Service;

    @Autowired
    public ${entityName}Controller(${entityName}Service ${this.toCamelCase(entityName)}Service) {
        this.${this.toCamelCase(entityName)}Service = ${this.toCamelCase(entityName)}Service;
    }

    @Operation(summary = "Crear nuevo ${entityName}", description = "Crea un nuevo ${entityName} en el sistema")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "${entityName} creado exitosamente"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Datos inválidos"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Error interno del servidor")
    })
    @PostMapping
    public ResponseEntity<ApiResponse<${entityName}DTO>> create(
            @Parameter(description = "Datos del nuevo ${entityName}")
            @Valid @RequestBody Create${entityName}DTO create${entityName}DTO) {
        try {
            ${entityName}DTO created = ${this.toCamelCase(entityName)}Service.create(create${entityName}DTO);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success(created, "${entityName} creado exitosamente"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error("Error al crear ${entityName}: " + e.getMessage()));
        }
    }

    @Operation(summary = "Obtener ${entityName} por ID", description = "Obtiene un ${entityName} específico por su ID")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "${entityName} encontrado"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "${entityName} no encontrado")
    })
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<${entityName}DTO>> findById(
            @Parameter(description = "ID del ${entityName}")
            @PathVariable Long id) {
        return ${this.toCamelCase(entityName)}Service.findById(id)
                .map(${this.toCamelCase(entityName)} -> ResponseEntity.ok(ApiResponse.success(${this.toCamelCase(entityName)}, "${entityName} encontrado")))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("${entityName} no encontrado con ID: " + id)));
    }

    @Operation(summary = "Obtener todos los ${entityName}s", description = "Obtiene una lista paginada de todos los ${entityName}s")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Lista de ${entityName}s obtenida exitosamente")
    })
    @GetMapping
    public ResponseEntity<ApiResponse<Page<${entityName}DTO>>> findAll(
            @Parameter(description = "Número de página (0-based)")
            @RequestParam(defaultValue = "0") int page,
            @Parameter(description = "Tamaño de página")
            @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Campo para ordenar")
            @RequestParam(defaultValue = "id") String sortBy,
            @Parameter(description = "Dirección de ordenamiento")
            @RequestParam(defaultValue = "asc") String sortDir) {
        
        Sort sort = Sort.by(Sort.Direction.fromString(sortDir), sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        
        Page<${entityName}DTO> result = ${this.toCamelCase(entityName)}Service.findAll(pageable);
        return ResponseEntity.ok(ApiResponse.success(result, "Lista de ${entityName}s obtenida exitosamente"));
    }

    @Operation(summary = "Obtener todos los ${entityName}s sin paginación", description = "Obtiene una lista completa de todos los ${entityName}s")
    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<${entityName}DTO>>> findAllWithoutPagination() {
        List<${entityName}DTO> result = ${this.toCamelCase(entityName)}Service.findAll();
        return ResponseEntity.ok(ApiResponse.success(result, "Lista completa de ${entityName}s obtenida"));
    }

    @Operation(summary = "Actualizar ${entityName}", description = "Actualiza un ${entityName} existente")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "${entityName} actualizado exitosamente"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "${entityName} no encontrado"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Datos inválidos")
    })
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<${entityName}DTO>> update(
            @Parameter(description = "ID del ${entityName}")
            @PathVariable Long id,
            @Parameter(description = "Datos actualizados del ${entityName}")
            @Valid @RequestBody Update${entityName}DTO update${entityName}DTO) {
        
        return ${this.toCamelCase(entityName)}Service.update(id, update${entityName}DTO)
                .map(updated -> ResponseEntity.ok(ApiResponse.success(updated, "${entityName} actualizado exitosamente")))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(ApiResponse.error("${entityName} no encontrado con ID: " + id)));
    }

    @Operation(summary = "Eliminar ${entityName}", description = "Elimina un ${entityName} del sistema")
    @ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "${entityName} eliminado exitosamente"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "${entityName} no encontrado")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @Parameter(description = "ID del ${entityName}")
            @PathVariable Long id) {
        
        if (${this.toCamelCase(entityName)}Service.delete(id)) {
            return ResponseEntity.ok(ApiResponse.success(null, "${entityName} eliminado exitosamente"));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error("${entityName} no encontrado con ID: " + id));
        }
    }

    @Operation(summary = "Verificar existencia de ${entityName}", description = "Verifica si existe un ${entityName} con el ID especificado")
    @GetMapping("/{id}/exists")
    public ResponseEntity<ApiResponse<Boolean>> exists(
            @Parameter(description = "ID del ${entityName}")
            @PathVariable Long id) {
        
        boolean exists = ${this.toCamelCase(entityName)}Service.existsById(id);
        return ResponseEntity.ok(ApiResponse.success(exists, 
                exists ? "${entityName} existe" : "${entityName} no existe"));
    }

    @Operation(summary = "Contar ${entityName}s", description = "Obtiene el número total de ${entityName}s en el sistema")
    @GetMapping("/count")
    public ResponseEntity<ApiResponse<Long>> count() {
        long count = ${this.toCamelCase(entityName)}Service.count();
        return ResponseEntity.ok(ApiResponse.success(count, "Conteo de ${entityName}s obtenido"));
    }

${this.generateCustomControllerMethods(element)}
}`;

    files[`src/main/java/${packagePath}/controller/${entityName}Controller.java`] = content;
    return files;
  }

  generateCustomControllerMethods(element) {
    // Generar métodos personalizados del controlador
    return '';
  }

  toKebabCase(str) {
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
  }

  // Métodos para generar archivos adicionales...
  generateDatabaseConfig() {
    return `package ${this.config.packageName}.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Configuración de base de datos
 * 
 * @author UML Code Generator
 */
@Configuration
@EnableJpaRepositories(basePackages = "${this.config.packageName}.repository")
@EnableJpaAuditing
@EnableTransactionManagement
public class DatabaseConfig {
    // Configuración adicional de base de datos si es necesaria
}`;
  }

  generateSwaggerConfig() {
    return `package ${this.config.packageName}.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuración de Swagger/OpenAPI
 * 
 * @author UML Code Generator
 */
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("${this.config.projectName} API")
                        .version("1.0.0")
                        .description("API generada automáticamente desde diagrama UML")
                        .contact(new Contact()
                                .name("UML Code Generator")
                                .email("developer@example.com")
                                .url("https://example.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")));
    }
}`;
  }

  generateGlobalExceptionHandler() {
    return `package ${this.config.packageName}.exception;

import ${this.config.packageName}.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * Manejador global de excepciones
 * 
 * @author UML Code Generator
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationExceptions(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        return ResponseEntity.badRequest()
                .body(ApiResponse.error("Errores de validación", errors));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<Void>> handleRuntimeException(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Error interno del servidor: " + ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Error inesperado: " + ex.getMessage()));
    }
}`;
  }

  generateApiResponse() {
    return `package ${this.config.packageName}.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

/**
 * Respuesta estándar de la API
 * 
 * @author UML Code Generator
 */
@Schema(description = "Respuesta estándar de la API")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    @Schema(description = "Indica si la operación fue exitosa")
    private boolean success;

    @Schema(description = "Mensaje descriptivo del resultado")
    private String message;

    @Schema(description = "Datos de la respuesta")
    private T data;

    @Schema(description = "Datos adicionales en caso de error")
    private Object error;

    @Schema(description = "Timestamp de la respuesta")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime timestamp;

    // Constructores
    public ApiResponse() {
        this.timestamp = LocalDateTime.now();
    }

    public ApiResponse(boolean success, String message, T data) {
        this();
        this.success = success;
        this.message = message;
        this.data = data;
    }

    public ApiResponse(boolean success, String message, T data, Object error) {
        this(success, message, data);
        this.error = error;
    }

    // Métodos estáticos para crear respuestas
    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(true, message, data);
    }

    public static <T> ApiResponse<T> success(T data) {
        return success(data, "Operación exitosa");
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, message, null);
    }

    public static <T> ApiResponse<T> error(String message, Object error) {
        return new ApiResponse<>(false, message, null, error);
    }

    // Getters y Setters
    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public Object getError() {
        return error;
    }

    public void setError(Object error) {
        this.error = error;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}`;
  }

  generateReadme() {
    return `# ${this.config.projectName}

Proyecto Spring Boot generado automáticamente desde diagrama UML.

## Tecnologías

- Java ${this.config.javaVersion}
- Spring Boot ${this.config.springBootVersion}
- Spring Data JPA
- PostgreSQL
- Maven
- Swagger/OpenAPI

## Configuración

### Requisitos

- Java ${this.config.javaVersion}+
- Maven 3.6+
- PostgreSQL 12+

### Base de datos

Crea una base de datos en PostgreSQL y configura las credenciales en \`application.properties\`:

\`\`\`properties
spring.datasource.url=jdbc:postgresql://localhost:5432/tu_base_datos
spring.datasource.username=tu_usuario
spring.datasource.password=tu_contraseña
\`\`\`

### Ejecución

\`\`\`bash
# Compilar el proyecto
mvn clean compile

# Ejecutar tests
mvn test

# Ejecutar la aplicación
mvn spring-boot:run
\`\`\`

### Docker

\`\`\`bash
# Construir imagen
docker build -t ${this.config.projectName} .

# Ejecutar contenedor
docker run -p 8080:8080 ${this.config.projectName}
\`\`\`

## Endpoints

La aplicación estará disponible en: \`http://localhost:8080/api\`

### Documentación

- Swagger UI: \`http://localhost:8080/api/swagger-ui.html\`
- API Docs: \`http://localhost:8080/api/api-docs\`

## Estructura del proyecto

\`\`\`
src/
├── main/
│   ├── java/${this.packageToPath()}/
│   │   ├── entity/          # Entidades JPA
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── repository/      # Repositorios
│   │   ├── service/         # Servicios de negocio
│   │   ├── controller/      # Controladores REST
│   │   ├── config/          # Configuraciones
│   │   └── exception/       # Manejo de excepciones
│   └── resources/
│       └── application.properties
└── test/
    └── java/                # Tests unitarios
\`\`\`

## Funcionalidades

- CRUD completo para todas las entidades
- Validación de datos
- Paginación y ordenamiento
- Documentación automática con Swagger
- Manejo de errores
- Auditoría de entidades (created_at, updated_at)

## Desarrollo

Este proyecto fue generado automáticamente desde un diagrama UML. 
Puedes modificar y extender las funcionalidades según tus necesidades.

### Agregar nuevas entidades

1. Crea la entidad en el paquete \`entity\`
2. Crea el repositorio correspondiente
3. Implementa el servicio y controlador
4. Actualiza la documentación

## Contacto

Generado por UML Code Generator
`;
  }

  generateDockerfile() {
    return `# Dockerfile generado automáticamente
FROM openjdk:${this.config.javaVersion}-jdk-slim

# Información del proyecto
LABEL maintainer="UML Code Generator"
LABEL version="1.0.0"
LABEL description="${this.config.projectName} - Generado desde UML"

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de Maven
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .

# Descargar dependencias
RUN ./mvnw dependency:go-offline -B

# Copiar código fuente
COPY src src

# Compilar aplicación
RUN ./mvnw clean package -DskipTests

# Exponer puerto
EXPOSE 8080

# Comando de ejecución
CMD ["java", "-jar", "target/${this.config.projectName}-1.0.0.jar"]

# Variables de entorno
ENV SPRING_PROFILES_ACTIVE=production
ENV JAVA_OPTS="-Xmx512m -Xms256m"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/api/actuator/health || exit 1`;
  }

  generateGitignore() {
    return `# Compiled class files
*.class

# Log files
*.log

# BlueJ files
*.ctxt

# Mobile Tools for Java (J2ME)
.mtj.tmp/

# Package Files
*.jar
*.war
*.nar
*.ear
*.zip
*.tar.gz
*.rar

# Virtual machine crash logs
hs_err_pid*
replay_pid*

# Maven
target/
pom.xml.tag
pom.xml.releaseBackup
pom.xml.versionsBackup
pom.xml.next
release.properties
dependency-reduced-pom.xml
buildNumber.properties
.mvn/timing.properties
.mvn/wrapper/maven-wrapper.jar

# IDE
.idea/
*.iws
*.iml
*.ipr
.vscode/
.settings/
.project
.classpath

# OS
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Spring Boot
*.original
.factorypath

# Logs
logs/
*.log

# Database
*.db
*.sqlite

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Generated files
generated/
dist/
build/`;
  }
}

module.exports = SpringBootGenerator;
