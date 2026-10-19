import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };
export const db = g.prisma ?? new PrismaClient({ log: process.env.PRISMA_QUERY_LOG === "1" ? ["query"] : [] });
if (process.env.NODE_ENV !== "production") g.prisma = db;
