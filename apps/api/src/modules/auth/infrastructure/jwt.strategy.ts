import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RequestUser } from '../../../shared/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  premium: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_ACCESS_SECRET')!,
    });
  }
  async validate(payload: JwtPayload): Promise<RequestUser> {
    return { id: payload.sub, email: payload.email, isPremium: payload.premium };
  }
}
