import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function apiResponse<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function withRouteErrorHandling<T>(
  callback: () => Promise<T>
): Promise<Response> {
  try {
    const payload = await callback();
    if (payload instanceof Response) {
      return payload;
    }
    return apiResponse(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      return apiResponse(
        {
          error: error.message,
          details: error.details ?? null
        },
        { status: error.status }
      );
    }

    if (error instanceof ZodError) {
      return apiResponse(
        {
          error: "Validation failed.",
          details: error.flatten()
        },
        { status: 400 }
      );
    }

    console.error(error);

    return apiResponse(
      {
        error: "Internal server error."
      },
      { status: 500 }
    );
  }
}
