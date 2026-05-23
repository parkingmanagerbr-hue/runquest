export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends DomainError {
  readonly code = 'INVALID_CREDENTIALS';
  readonly httpStatus = 401;
  constructor() { super('Invalid email or password'); }
}

export class EmailAlreadyInUseError extends DomainError {
  readonly code = 'EMAIL_IN_USE';
  readonly httpStatus = 409;
  constructor() { super('Email already in use'); }
}

export class UserNotFoundError extends DomainError {
  readonly code = 'USER_NOT_FOUND';
  readonly httpStatus = 404;
  constructor() { super('User not found'); }
}

export class PremiumRequiredError extends DomainError {
  readonly code = 'PREMIUM_REQUIRED';
  readonly httpStatus = 402;
  constructor() { super('Active premium subscription required'); }
}

export class InvalidWebhookSignatureError extends DomainError {
  readonly code = 'INVALID_WEBHOOK_SIGNATURE';
  readonly httpStatus = 401;
  constructor() { super('Invalid webhook signature'); }
}
