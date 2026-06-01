import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly ready: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
  ) {
    const pub = cfg.get<string>('VAPID_PUBLIC');
    const priv = cfg.get<string>('VAPID_PRIVATE');
    const sub = cfg.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@runquest.app';
    if (pub && priv) {
      webpush.setVapidDetails(sub, pub, priv);
      this.ready = true;
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
      this.ready = false;
    }
  }

  /** Send a push notification to a specific user. Silently skips if no subscription. */
  async sendToUser(userId: string, payload: { title: string; body: string; icon?: string; url?: string }) {
    if (!this.ready) return;
    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { pushSubscription: true },
    });
    if (!user?.pushSubscription) return;

    const sub = user.pushSubscription as any;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon ?? '/icon-192.png',
          badge: '/icon-192.png',
          url: payload.url ?? '/app/notifications',
        }),
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — clear it
        await (this.prisma as any).user.update({
          where: { id: userId },
          data: { pushSubscription: null },
        });
      } else {
        this.logger.error(`Push failed for ${userId}: ${err.message}`);
      }
    }
  }
}
