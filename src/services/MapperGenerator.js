class MapperGenerator {
  constructor(config) {
    this.config = config;
  }

  generateMapper(element) {
    const entityName = element.name;
    const packagePath = this.config.packageName.replace(/\./g, '/');

    return `package ${this.config.packageName}.mapper;

import ${this.config.packageName}.dto.${entityName}DTO;
import ${this.config.packageName}.dto.Create${entityName}DTO;
import ${this.config.packageName}.dto.Update${entityName}DTO;
import ${this.config.packageName}.entity.${entityName};

import org.mapstruct.*;

/**
 * Mapper para ${entityName}
 * 
 * @author UML Code Generator
 */
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.IGNORE)
public interface ${entityName}Mapper {

    /**
     * Convierte entidad a DTO
     */
    ${entityName}DTO toDTO(${entityName} entity);

    /**
     * Convierte DTO de creación a entidad
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    ${entityName} toEntity(Create${entityName}DTO createDTO);

    /**
     * Actualiza entidad desde DTO de actualización
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateEntityFromDTO(Update${entityName}DTO updateDTO, @MappingTarget ${entityName} entity);
}`;
  }
}

module.exports = MapperGenerator;
