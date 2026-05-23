import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from './domain-error';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest();

    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).json({
        error: exception.code,
        message: exception.message,
        path: req.url,
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string' ? { message: body, path: req.url } : { ...(body as object), path: req.url },
      );
      return;
    }
    this.logger.error('Unhandled exception', exception as Error);
    res.status(500).json({ error: 'INTERNAL', message: 'Internal server error', path: req.url });
  }
}
