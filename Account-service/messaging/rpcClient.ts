import type { Channel } from "amqplib";
import { connectToRabbitMQ } from "../utils/RabbitMQ";
import { randomUUIDv7 } from "bun";
import logger from "../utils/logger";

let channel: Channel;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second initial delay

export const sendRPCRequest = async ( routingKey: string, message: any, timeoutMs = 5000, retries = MAX_RETRIES ): Promise<any> => {
    try {
        if (!channel) {
            channel = await connectToRabbitMQ();
        }

        const correlationId = randomUUIDv7();
        const replyQueue = await channel.assertQueue("", { exclusive: true });

        logger.info(`🛰 RPC Request sent to queue: ${routingKey}`);

        return new Promise(async (resolve, reject) => {
            const timer = setTimeout(() => {
                cleanup(replyQueue.queue);
                reject(new Error(`RPC request timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            const cleanup = (queue: string) => {
                clearTimeout(timer);
                channel.deleteQueue(queue).catch(() => {
                    logger.error(`${queue} deleted successfully`)
                });
            };

            const consumerTag:any = await channel.consume( replyQueue.queue, (msg) => {
                    if (!msg) {
                        return reject(new Error("Received null message"));
                    }

                    if (msg.properties.correlationId === correlationId) {
                        cleanup(replyQueue.queue);
                        try {
                            const response = JSON.parse(msg.content.toString());
                            logger.info(`📬 RPC Response received from ${routingKey}`);
                            resolve(response);
                        } catch (err) {
                            reject(new Error("Failed to parse RPC response"));
                        }
                    }
                },
                { noAck: true }
            );

            try {
                channel.publish("", routingKey, Buffer.from(JSON.stringify(message)), {
                        correlationId,
                        replyTo: replyQueue.queue,
                    }
                );
            } catch (err) {
                cleanup(replyQueue.queue);
                channel.cancel(consumerTag).catch(() => {});
                throw err;
            }
        });
    } catch (err) {
        logger.error(`RPC request failed (${retries} retries left):`, err);

        if (retries > 0) {
            const delay = calculateExponentialBackoff(retries);
            logger.warn(`Retrying in ${delay}ms...`);

            await new Promise((res) => setTimeout(res, delay));
            return sendRPCRequest(routingKey, message, timeoutMs, retries - 1);
        }

        throw new Error(`RPC request failed after ${MAX_RETRIES} attempts`);
    }
};

const calculateExponentialBackoff = (retriesLeft: number) => {
    return INITIAL_RETRY_DELAY_MS * Math.pow(2, MAX_RETRIES - retriesLeft);
};