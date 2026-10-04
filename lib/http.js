import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const notFound = () => new HttpError(404, 'Not found');
export const unauthorized = () => new HttpError(401, 'Please sign in');

// Wrap a route handler so thrown errors become safe JSON responses.
export function route(handler) {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ error: e.issues[0]?.message || 'Invalid input' }, { status: 400 });
      }
      // Log the error type only, never request bodies or credentials.
      console.error('Unhandled route error:', e?.name, e?.code || '');
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  };
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'Invalid request body');
  }
}
