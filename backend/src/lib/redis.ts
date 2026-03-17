import { createClient } from "redis";

const globalForRedis = globalThis as unknown as {
    redis?: ReturnType<typeof createClient>;
};

export const redis =
    globalForRedis.redis ??
    createClient({
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
    });

if (!globalForRedis.redis) {
    globalForRedis.redis = redis;
}

redis.on("error", (err) => {
    console.error("Redis error:", err);
});

export async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}
export function redisStatusLog() {
    console.log("redis connected", {
        isOpen: redis.isOpen,
        isReady: redis.isReady,
    })
}
