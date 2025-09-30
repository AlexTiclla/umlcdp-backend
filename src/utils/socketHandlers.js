const jwt = require('jsonwebtoken');
const { User, Diagram } = require('../models');

// Almacenar estados de colaboración en memoria
const collaborationState = {
  diagramUsers: new Map(), // diagramId -> Set de usuarios
  elementLocks: new Map(), // elementId -> { userId, timestamp, diagramId }
  cursorPositions: new Map(), // userId -> { position, diagramId, timestamp }
};

module.exports = (io) => {
  // Middleware de autenticación para Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Token de autenticación requerido'));
      }

      // Verificar el token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Buscar el usuario en la base de datos
      const user = await User.findByPk(decoded.userId, {
        attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'isActive']
      });

      if (!user || !user.isActive) {
        return next(new Error('Usuario no encontrado o inactivo'));
      }

      // Agregar usuario al socket
      socket.user = user;
      socket.userId = user.id;
      
      console.log(`✅ Usuario conectado: ${user.username} (${user.id})`);
      next();
    } catch (error) {
      console.error('❌ Error de autenticación Socket.io:', error.message);
      next(new Error('Token inválido'));
    }
  });

  // Funciones auxiliares
  const getUsersInDiagram = (diagramId) => {
    const room = io.sockets.adapter.rooms.get(`diagram:${diagramId}`);
    const users = [];
    
    if (room) {
      for (const socketId of room) {
        const userSocket = io.sockets.sockets.get(socketId);
        if (userSocket && userSocket.user) {
          users.push({
            id: userSocket.user.id,
            username: userSocket.user.username,
            firstName: userSocket.user.firstName,
            lastName: userSocket.user.lastName
          });
        }
      }
    }
    
    return users;
  };

  const cleanupElementLocks = (userId, diagramId) => {
    // Limpiar locks del usuario al salir
    const locksToRemove = [];
    collaborationState.elementLocks.forEach((lock, elementId) => {
      if (lock.userId === userId && lock.diagramId === diagramId) {
        locksToRemove.push(elementId);
      }
    });
    
    locksToRemove.forEach(elementId => {
      collaborationState.elementLocks.delete(elementId);
      io.to(`diagram:${diagramId}`).emit('element:unlocked', {
        elementId,
        unlockedBy: userId,
        reason: 'user_disconnected'
      });
    });
  };

  const autoUnlockExpiredLocks = () => {
    const now = Date.now();
    const LOCK_TIMEOUT = 30000; // 30 segundos
    
    collaborationState.elementLocks.forEach((lock, elementId) => {
      if (now - lock.timestamp > LOCK_TIMEOUT) {
        collaborationState.elementLocks.delete(elementId);
        io.to(`diagram:${lock.diagramId}`).emit('element:unlocked', {
          elementId,
          unlockedBy: lock.userId,
          reason: 'timeout'
        });
      }
    });
  };

  // Auto-unlock cada 30 segundos
  setInterval(autoUnlockExpiredLocks, 30000);

  // Manejo de conexiones
  io.on('connection', (socket) => {
    console.log(`🔌 Cliente conectado: ${socket.user.username}`);

    // Unir al usuario a su sala personal
    socket.join(`user:${socket.userId}`);

    // Eventos de diagrama
    socket.on('diagram:join', async (diagramId) => {
      try {
        console.log(`📊 Usuario ${socket.user.username} se unió al diagrama ${diagramId}`);
        
        // Verificar que el diagrama existe y el usuario tiene acceso
        const diagram = await Diagram.findByPk(diagramId);
        if (!diagram) {
          socket.emit('error', { message: 'Diagrama no encontrado' });
          return;
        }

        socket.join(`diagram:${diagramId}`);
        socket.currentDiagram = diagramId;
        
        // Actualizar estado de colaboración
        if (!collaborationState.diagramUsers.has(diagramId)) {
          collaborationState.diagramUsers.set(diagramId, new Set());
        }
        collaborationState.diagramUsers.get(diagramId).add(socket.userId);
        
        const connectedUsers = getUsersInDiagram(diagramId);
        
        // Notificar a otros usuarios que alguien se unió
        socket.to(`diagram:${diagramId}`).emit('userJoined', {
          user: {
            id: socket.user.id,
            username: socket.user.username,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName
          }
        });

        // 🔥 ENVIAR LISTA ACTUALIZADA A TODOS LOS USUARIOS EN EL DIAGRAMA
        io.to(`diagram:${diagramId}`).emit('usersUpdated', connectedUsers);
        console.log(`👥 Lista de usuarios actualizada enviada a ${connectedUsers.length} usuarios en diagrama ${diagramId}`);
        
        // Enviar elementos bloqueados actuales
        const lockedElements = {};
        collaborationState.elementLocks.forEach((lock, elementId) => {
          if (lock.diagramId === diagramId) {
            lockedElements[elementId] = {
              userId: lock.userId,
              timestamp: lock.timestamp
            };
          }
        });
        socket.emit('lockedElements', lockedElements);
        
      } catch (error) {
        console.error('Error en diagram:join:', error);
        socket.emit('error', { message: 'Error al unirse al diagrama' });
      }
    });

    socket.on('diagram:leave', (diagramId) => {
      console.log(`📊 Usuario ${socket.user.username} salió del diagrama ${diagramId}`);
      socket.leave(`diagram:${diagramId}`);
      
      // Limpiar estado de colaboración
      if (collaborationState.diagramUsers.has(diagramId)) {
        collaborationState.diagramUsers.get(diagramId).delete(socket.userId);
      }
      
      // Limpiar locks del usuario
      cleanupElementLocks(socket.userId, diagramId);
      
      // Notificar a otros usuarios
      socket.to(`diagram:${diagramId}`).emit('userLeft', {
        user: {
          id: socket.user.id,
          username: socket.user.username,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName
        }
      });
      
      // 🔥 ACTUALIZAR LISTA DE USUARIOS PARA TODOS
      const connectedUsers = getUsersInDiagram(diagramId);
      io.to(`diagram:${diagramId}`).emit('usersUpdated', connectedUsers);
      console.log(`👥 Lista de usuarios actualizada tras salida enviada a ${connectedUsers.length} usuarios`);
      
      socket.currentDiagram = null;
    });

    // Eventos de elementos del diagrama según Fase 2 del plan
    socket.on('diagram:element:add', async (data) => {
      try {
        const { diagramId, element } = data;
        console.log(`➕ Elemento agregado en diagrama ${diagramId} por ${socket.user.username}`);

        if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
          socket.emit('error', { message: 'No estás conectado a este diagrama' });
          return;
        }

        // Validar elemento
        if (!element || !element.id) {
          socket.emit('error', { message: 'Elemento inválido' });
          return;
        }

        const elementWithUser = {
          ...element,
          createdBy: socket.user.id,
          createdAt: new Date().toISOString()
        };

        // Verificar que el diagrama existe
        const diagram = await Diagram.findByPk(diagramId);
        if (!diagram) {
          socket.emit('error', { message: 'Diagrama no encontrado' });
          return;
        }

        // Broadcast según Fase 2 - evento 'elementAdded'
        socket.to(`diagram:${diagramId}`).emit('elementAdded', {
          element: elementWithUser,
          user: socket.user
        });

        // Confirmar al usuario que envió
        socket.emit('elementAddedConfirm', {
          elementId: element.id,
          success: true
        });

      } catch (error) {
        console.error('Error en diagram:element:add:', error);
        socket.emit('error', { message: 'Error agregando elemento' });
      }
    });

    socket.on('diagram:element:update', async (data) => {
      try {
        const { diagramId, elementId, changes } = data;
        console.log(`✏️ Elemento ${elementId} actualizado en diagrama ${diagramId} por ${socket.user.username}`);

        if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
          socket.emit('error', { message: 'No estás conectado a este diagrama' });
          return;
        }

        // Validar datos
        if (!elementId || !changes) {
          socket.emit('error', { message: 'Datos de actualización inválidos' });
          return;
        }

        // Verificar que el elemento no esté bloqueado por otro usuario
        const lock = collaborationState.elementLocks.get(elementId);
        if (lock && lock.userId !== socket.userId) {
          socket.emit('error', {
            message: 'Elemento bloqueado por otro usuario',
            elementId,
            lockedBy: lock.userId
          });
          return;
        }

        // Verificar que el diagrama existe
        const diagram = await Diagram.findByPk(diagramId);
        if (!diagram) {
          socket.emit('error', { message: 'Diagrama no encontrado' });
          return;
        }

        const updateData = {
          elementId,
          changes,
          updatedBy: socket.user.id,
          updatedAt: new Date().toISOString()
        };

        // Broadcast según Fase 2 - evento 'elementUpdated'
        socket.to(`diagram:${diagramId}`).emit('elementUpdated', {
          ...updateData,
          user: socket.user
        });

        // Confirmar al usuario que envió
        socket.emit('elementUpdatedConfirm', {
          elementId,
          success: true
        });

      } catch (error) {
        console.error('Error en diagram:element:update:', error);
        socket.emit('error', { message: 'Error actualizando elemento' });
      }
    });

    socket.on('diagram:element:delete', async (data) => {
      try {
        const { diagramId, elementId } = data;
        console.log(`🗑️ Elemento ${elementId} eliminado en diagrama ${diagramId} por ${socket.user.username}`);

        if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
          socket.emit('error', { message: 'No estás conectado a este diagrama' });
          return;
        }

        // Validar datos
        if (!elementId) {
          socket.emit('error', { message: 'ID de elemento requerido' });
          return;
        }

        // Verificar que el elemento no esté bloqueado por otro usuario
        const lock = collaborationState.elementLocks.get(elementId);
        if (lock && lock.userId !== socket.userId) {
          socket.emit('error', {
            message: 'Elemento bloqueado por otro usuario',
            elementId,
            lockedBy: lock.userId
          });
          return;
        }

        // Verificar que el diagrama existe
        const diagram = await Diagram.findByPk(diagramId);
        if (!diagram) {
          socket.emit('error', { message: 'Diagrama no encontrado' });
          return;
        }

        // Limpiar lock si existe
        collaborationState.elementLocks.delete(elementId);

        // Broadcast según Fase 2 - evento 'elementDeleted'
        socket.to(`diagram:${diagramId}`).emit('elementDeleted', {
          elementId,
          deletedBy: socket.user.id,
          deletedAt: new Date().toISOString(),
          user: socket.user
        });

        // Confirmar al usuario que envió
        socket.emit('elementDeletedConfirm', {
          elementId,
          success: true
        });

      } catch (error) {
        console.error('Error en diagram:element:delete:', error);
        socket.emit('error', { message: 'Error eliminando elemento' });
      }
    });

    // Sistema de bloqueo mejorado según Fase 2
    socket.on('element:lock', (data) => {
      const { diagramId, elementId } = data;
      
      if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
        socket.emit('error', { message: 'No estás conectado a este diagrama' });
        return;
      }

      // Verificar si ya está bloqueado
      const existingLock = collaborationState.elementLocks.get(elementId);
      if (existingLock && existingLock.userId !== socket.userId) {
        socket.emit('elementLockFailed', {
          elementId,
          reason: 'already_locked',
          lockedBy: existingLock.userId
        });
        return;
      }

      // Crear o renovar el bloqueo
      collaborationState.elementLocks.set(elementId, {
        userId: socket.userId,
        diagramId,
        timestamp: Date.now()
      });

      console.log(`🔒 Elemento ${elementId} bloqueado por ${socket.user.username}`);
      
      // Broadcast según Fase 2 - evento 'elementLocked'
      socket.to(`diagram:${diagramId}`).emit('elementLocked', {
        elementId,
        lockedBy: socket.user.id,
        user: socket.user,
        timestamp: new Date().toISOString()
      });

      socket.emit('elementLockSuccess', { elementId });
    });

    socket.on('element:unlock', (data) => {
      const { diagramId, elementId } = data;
      
      if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
        socket.emit('error', { message: 'No estás conectado a este diagrama' });
        return;
      }

      const lock = collaborationState.elementLocks.get(elementId);
      if (!lock || lock.userId !== socket.userId) {
        socket.emit('error', { 
          message: 'No puedes desbloquear este elemento',
          elementId 
        });
        return;
      }

      collaborationState.elementLocks.delete(elementId);
      console.log(`🔓 Elemento ${elementId} desbloqueado por ${socket.user.username}`);
      
      // Broadcast según Fase 2 - evento 'elementUnlocked'
      socket.to(`diagram:${diagramId}`).emit('elementUnlocked', {
        elementId,
        unlockedBy: socket.user.id,
        user: socket.user,
        timestamp: new Date().toISOString()
      });
    });

    // Cursor compartido mejorado según Fase 2
    socket.on('cursor:move', (data) => {
      const { diagramId, position } = data;
      
      if (!socket.currentDiagram || socket.currentDiagram !== diagramId) {
        return; // Silencioso para cursor
      }
      
      // Actualizar posición en estado
      collaborationState.cursorPositions.set(socket.userId, {
        position,
        diagramId,
        timestamp: Date.now()
      });
      
      // Broadcast throttled cursor movement
      socket.to(`diagram:${diagramId}`).emit('cursorMoved', {
        userId: socket.user.id,
        username: socket.user.username,
        firstName: socket.user.firstName,
        position,
        timestamp: new Date().toISOString()
      });
    });

    // Manejo de desconexión mejorado
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Usuario desconectado: ${socket.user.username} - Razón: ${reason}`);
      
      // Limpiar de todos los diagramas
      if (socket.currentDiagram) {
        cleanupElementLocks(socket.userId, socket.currentDiagram);
        
        // Actualizar estado de colaboración
        if (collaborationState.diagramUsers.has(socket.currentDiagram)) {
          collaborationState.diagramUsers.get(socket.currentDiagram).delete(socket.userId);
        }
        
        // Notificar a usuarios en el diagrama actual
        const connectedUsers = getUsersInDiagram(socket.currentDiagram);
        io.to(`diagram:${socket.currentDiagram}`).emit('usersUpdated', connectedUsers);
        console.log(`👥 Lista de usuarios actualizada tras desconexión enviada a ${connectedUsers.length} usuarios`);
      }
      
      // Limpiar cursor
      collaborationState.cursorPositions.delete(socket.userId);
      
      // Notificar a todas las salas de diagramas
      socket.rooms.forEach(room => {
        if (room.startsWith('diagram:')) {
          const diagramId = room.replace('diagram:', '');
          cleanupElementLocks(socket.userId, diagramId);
          
          socket.to(room).emit('userLeft', {
            user: {
              id: socket.user.id,
              username: socket.user.username,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName
            }
          });
        }
      });
    });

    // Eventos de error
    socket.on('error', (error) => {
      console.error(`❌ Error en socket ${socket.user.username}:`, error);
    });

    // Eventos de ping/pong para mantener conexión
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  console.log('🔌 Socket.io configurado con autenticación JWT y colaboración avanzada');
};
