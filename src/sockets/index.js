const { Server } = require("socket.io");

const env = require("../config/env");
const SOCKET_EVENTS = require("../constants/socket-events");
const User = require("../models/User");
const { verifyToken } = require("../utils/jwt");

let io;
const restaurantEventCounters = new Map();
const serverInstanceId = Date.now().toString(36);

function getRestaurantRoom(restaurantId) {
  return `restaurant:${restaurantId}`;
}

function initializeSocketServer(server) {
  io = new Server(server, {
    cors: {
      origin: env.corsOrigin,
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const bearerHeader = socket.handshake.headers.authorization;
      const authToken =
        socket.handshake.auth?.token ||
        (bearerHeader && bearerHeader.startsWith("Bearer ")
          ? bearerHeader.split(" ")[1]
          : null);

      if (!authToken) {
        return next(new Error("Socket authentication token is required."));
      }

      const payload = verifyToken(authToken);
      const user = await User.findById(payload.sub);

      if (!user) {
        return next(new Error("Socket user could not be found."));
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
        restaurantId: payload.restaurantId || user.restaurantId
      };

      socket.join(getRestaurantRoom(socket.data.user.restaurantId));
      return next();
    } catch (error) {
      return next(new Error("Socket authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    socket.emit(SOCKET_EVENTS.CONNECTED, {
      connectionId: socket.id,
      message: "Realtime connection established.",
      recovered: Boolean(socket.recovered),
      restaurantId: socket.data.user.restaurantId,
      serverTime: new Date().toISOString()
    });
  });

  return io;
}

function nextRestaurantEventId(restaurantId) {
  const currentValue = restaurantEventCounters.get(restaurantId) || 0;
  const nextValue = currentValue + 1;
  restaurantEventCounters.set(restaurantId, nextValue);
  return `${restaurantId}:${serverInstanceId}:${nextValue}`;
}

function emitRestaurantEvent(
  restaurantId,
  eventName,
  payload,
  options = {}
) {
  if (!io) {
    return null;
  }

  const envelope = {
    eventId: nextRestaurantEventId(restaurantId),
    eventName,
    restaurantId,
    entity: payload.entity || null,
    entityId: payload.entityId || null,
    version: payload.version
      ? new Date(payload.version).toISOString()
      : new Date().toISOString(),
    occurredAt: new Date().toISOString(),
    data: payload.data || {}
  };

  const room = getRestaurantRoom(restaurantId);
  io.to(room).emit(eventName, envelope);

  for (const alias of options.aliases || []) {
    io.to(room).emit(alias, envelope);
  }

  return envelope;
}

module.exports = initializeSocketServer;
module.exports.emitRestaurantEvent = emitRestaurantEvent;
module.exports.getRestaurantRoom = getRestaurantRoom;
