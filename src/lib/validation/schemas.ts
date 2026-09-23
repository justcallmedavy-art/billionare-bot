import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const registerSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email().max(160),
  password: passwordSchema,
  country: z.string().min(2).max(60),
  phone: z.string().max(30).default(""),
  referralCode: z.string().max(12).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(128),
  remember: z.boolean().default(true),
});

export const forexOrderSchema = z.object({
  mode: z.literal("forex"),
  demo: z.boolean(),
  symbol: z.string().min(3).max(16),
  side: z.enum(["buy", "sell"]),
  lots: z.number().positive().max(50),
  sl: z.number().nullable().optional(),
  tp: z.number().nullable().optional(),
});

export const fixedTimeOrderSchema = z.object({
  mode: z.literal("fixed-time"),
  demo: z.boolean(),
  symbol: z.string().min(3).max(16),
  direction: z.enum(["up", "down"]),
  stake: z.number().positive().max(5000),
  durationSec: z.union([z.literal(60), z.literal(300), z.literal(900), z.literal(1800), z.literal(3600)]),
});

export const orderSchema = z.discriminatedUnion("mode", [forexOrderSchema, fixedTimeOrderSchema]);

export const depositSchema = z.object({
  amount: z.number().positive().max(100000),
  method: z.enum(["demo_credit"]),
});

export const withdrawalSchema = z.object({
  amount: z.number().positive().max(100000),
  method: z.literal("demo_credit"),
  destination: z.string().max(120).default("demo"),
});

export const botCreateSchema = z.object({
  name: z.string().min(2).max(40),
  demo: z.boolean(),
  assetSymbol: z.string().min(3).max(16),
  strategyType: z.enum(["rsi_ema", "breakout", "digit_evenodd"]),
  strategyParams: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  stake: z.number().positive().max(1000),
  durationSec: z.number().int().min(60).max(3600).default(60),
  maxDailyLoss: z.number().positive().max(100000).default(100),
  maxTrades: z.number().int().min(1).max(500).default(50),
  maxConsecutiveLosses: z.number().int().min(1).max(50).default(5),
  takeProfit: z.number().positive().max(100000).optional(),
});
