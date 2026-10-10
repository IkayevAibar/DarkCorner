/** Thrown errors of this class become a clean JSON response instead of a 500. */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Not signed in') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(code = 'forbidden', message = 'Forbidden') {
    return new ApiError(403, code, message);
  }

  static notFound(code: string, message: string) {
    return new ApiError(404, code, message);
  }

  static conflict(code: string, message: string, details?: unknown) {
    return new ApiError(409, code, message, details);
  }
}
