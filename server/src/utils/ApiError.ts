/** An error that is safe to surface to the client. Anything else becomes a generic 500. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'The request could not be processed.', details?: unknown) {
    return new ApiError(400, message, 'bad_request', details);
  }
  static unauthorized(message = 'You need to sign in to continue.') {
    return new ApiError(401, message, 'unauthorized');
  }
  static forbidden(message = 'You do not have access to this resource.') {
    return new ApiError(403, message, 'forbidden');
  }
  static notFound(message = 'That resource does not exist.') {
    return new ApiError(404, message, 'not_found');
  }
  static conflict(message = 'That resource already exists.') {
    return new ApiError(409, message, 'conflict');
  }
  static payloadTooLarge(message = 'That file is too large.') {
    return new ApiError(413, message, 'payload_too_large');
  }
}
