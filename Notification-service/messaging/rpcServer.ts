import type { Channel } from "amqplib";
import logger from "../utils/logger";
import { getRabbitMQChannel } from "../configs/rabbitMQ";

export const startRPCServer = async ( queueName: string, callback: (data: any) => Promise<any> ) => {
  try {
    
    const channel = await getRabbitMQChannel();

    await channel.assertQueue(queueName, { durable: true });

    // Set prefetch to prevent overloading the worker
    await channel.prefetch(1);

    const consumerTag = await channel.consume(queueName, async (msg) => {
      if (!msg) {
        logger.error('Received null message');
        return;
      }

      try {
        // Parse incoming message
        const data = JSON.parse(msg.content.toString());
        
        // Process with event callback handler
        const reply = await callback(data);

        // Send response back to client
        channel!.sendToQueue( msg.properties.replyTo, Buffer.from(JSON.stringify({success: true, data: reply })),
          {
            correlationId: msg.properties.correlationId,
          }
        );

        // Acknowledge message only after successful processing
        channel!.ack(msg);
      } catch (error) {
        logger.error(`Error processing RPC request: ${error}`);


        if (msg.properties.replyTo) { channel!.sendToQueue( msg.properties.replyTo, Buffer.from(JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Processing failed'
            })),
            {
              correlationId: msg.properties.correlationId,
            }
          );
        }

        // Reject message (with requeue=false)
        channel!.nack(msg, false, false);
      }
    });

    logger.info(`🛰  Account RPC Server listening on queue: ${queueName}`);
    
    // Return cleanup function
    return async () => {
      if (channel) {
        await channel.cancel(consumerTag.consumerTag);
        logger.error(`RPC Server stopped listening on queue: ${queueName}`);
      }
    };

  } catch (error) {
    logger.error(`Failed to start RPC server on queue ${queueName}:`, error);
    throw error;
  }
};