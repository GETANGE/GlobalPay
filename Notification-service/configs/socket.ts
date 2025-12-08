import { Server as HTTPServer } from "http";
import logger from "../utils/logger";
import { Server as IOServer, Socket } from "socket.io";
import { getUserNotifications } from "../services/notifications.service";

let io: IOServer | null = null;

export const initSocket = (server: HTTPServer) => {
    if(io) return;
    io = new IOServer(server);
    
    io.on("connection", (socket: Socket) => {
        logger.info("A user connected:", socket.id);
        
        // rooms for getting notifications in realtime
        socket.on("my_notification", async(userId: string) => {
          socket.join(userId);
          logger.info(`Socket ${socket.id} joined room ${userId}`);
          
          // fetch all notifications for this user
          try{
            const notifications = await getUserNotifications(userId);
            
            socket.emit("notifications_list", {
              page: 1,
              limit: 10,
              total: notifications.length,
              data: notifications
            });
            
            logger.info(`📨 Sent ${notifications.length} notifications to user ${userId}`);
          } catch(error:any){
            logger.error(`❌ Failed to fetch notifications for user ${userId}:`, error);
          }
        });
    });

    io.on("disconnect", (socket: Socket) => {
        logger.info("A user disconnected:", socket.id);
    });

    io.on("error", (error: Error) => {
        logger.error("Socket error:", error);
    });
    
    logger.info(`🔌 Socket server initialized`);
};

export const emitNotification = async (userId: string, notification: any) => {
  if(!io) {
    logger.error(`Socket server not initialized; skipping emit.`);
    return;
  };
  
  io.to(userId).emit("new_notification", notification);
};