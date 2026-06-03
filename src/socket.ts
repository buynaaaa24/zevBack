import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { Conversation } from "./models/Conversation.js";

let io: Server | null = null;

function roomForConversation(conversationId: string) {
  return `conv:${conversationId}`;
}

export function initSocket(server: HttpServer, corsOrigins: string[]): Server {
  io = new Server(server, {
    cors: { origin: corsOrigins, credentials: true },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] New connection established: ${socket.id}`);

    socket.on(
      "join",
      async (
        payload: {
          conversationId: string;
          guestId?: string;
          asAdmin?: boolean;
        },
        ack?: (err: Error | null) => void,
      ) => {
        try {
          const { conversationId, guestId, asAdmin } = payload;
          console.log(`[Socket.IO] Client ${socket.id} requesting to join room for conversationId: ${conversationId}, guestId: ${guestId}, asAdmin: ${asAdmin}`);
          
          const conv = await Conversation.findById(conversationId);
          if (!conv) {
            console.warn(`[Socket.IO] Join failed: Conversation ${conversationId} not found in DB`);
            ack?.(new Error("NOT_FOUND"));
            return;
          }
          if (asAdmin) {
            await socket.join(roomForConversation(conversationId));
            console.log(`[Socket.IO] Admin client ${socket.id} joined room: ${roomForConversation(conversationId)}`);
            ack?.(null);
            return;
          }
          if (!guestId || conv.guestId !== guestId) {
            console.warn(`[Socket.IO] Join failed: guestId mismatch. Expected: ${conv.guestId}, got: ${guestId}`);
            ack?.(new Error("FORBIDDEN"));
            return;
          }
          await socket.join(roomForConversation(conversationId));
          console.log(`[Socket.IO] Guest client ${socket.id} joined room: ${roomForConversation(conversationId)}`);
          ack?.(null);
        } catch (e) {
          console.error(`[Socket.IO] Error during join for socket ${socket.id}:`, e);
          ack?.(e instanceof Error ? e : new Error("JOIN_FAILED"));
        }
      },
    );

    socket.on(
      "leave",
      async (
        payload: { conversationId?: string },
        ack?: (err: Error | null) => void,
      ) => {
        try {
          const id = payload?.conversationId?.trim();
          console.log(`[Socket.IO] Client ${socket.id} requesting to leave conversationId: ${id}`);
          if (!id) {
            console.warn(`[Socket.IO] Leave failed: Invalid conversation ID`);
            ack?.(new Error("INVALID"));
            return;
          }
          await socket.leave(roomForConversation(id));
          console.log(`[Socket.IO] Client ${socket.id} left room: ${roomForConversation(id)}`);
          ack?.(null);
        } catch (e) {
          console.error(`[Socket.IO] Error during leave for socket ${socket.id}:`, e);
          ack?.(e instanceof Error ? e : new Error("LEAVE_FAILED"));
        }
      },
    );

    socket.on("join-admin", (payload?: any, ack?: (err: Error | null) => void) => {
      socket.join("admin-notifications");
      console.log(`[Socket.IO] Admin socket ${socket.id} joined admin-notifications room`);
      ack?.(null);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}. Reason: ${reason}`);
    });
  });

  return io;
}

export function emitNewMessage(
  conversationId: string,
  message: Record<string, unknown>,
) {
  const room = roomForConversation(conversationId);
  console.log(`[Socket.IO] Emitting message:new to room: ${room}. Message ID: ${message.id || message._id || 'unknown'}`);
  io?.to(room).emit("message:new", {
    conversationId,
    message,
  });

  if (message.role === "user") {
    console.log(`[Socket.IO] Broadcasting user message to admin-notifications room. Msg ID: ${message.id || message._id}`);
    io?.to("admin-notifications").emit("admin:new-user-message", {
      conversationId,
      message,
    });
  }
}
