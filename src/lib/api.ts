import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.errors[0];
      throw new ApiError(`${first.path.join(".") || "body"}: ${first.message}`, 422);
    }
    throw e;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function handleError(e: unknown) {
  if (e instanceof ApiError) return fail(e.message, e.status);
  const err = e as Error & { status?: number };
  if (err.status) return fail(err.message, err.status);
  console.error("[api]", err);
  return fail("Something went wrong on our side. Please try again.", 500);
}
