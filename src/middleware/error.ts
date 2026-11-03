import { Context } from "hono";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) return c.json({ error: { code: err.code, message: err.message } }, err.status as any);
  console.error(err);
  return c.json({ error: { code: "INTERNAL", message: "خطأ داخلي" } }, 500);
}
