import { Controller, Get, Param, Query, Post, Body, NotFoundException, Req } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Request } from 'express';
import { PagesService } from '@modules/cms-pages/pages.service';
import { MenuService } from '@modules/cms-menu/menu.service';
import { SettingsService } from '@modules/cms-settings/settings.service';
import { PrismaService } from '@core/database/prisma.service';
import { MenuLocation, PageStatus } from '@prisma/client';

@Controller('public/cms')
export class PublicCmsController {
  constructor(
    private readonly pagesService: PagesService,
    private readonly menuService: MenuService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  // ============ Pages ============

  @Get('pages/:slug')
  async getPageBySlug(@Param('slug') slug: string) {
    return this.pagesService.findBySlug(slug);
  }

  // ============ Menus ============

  @Get('menus/:location')
  async getMenuByLocation(@Param('location') location: MenuLocation) {
    return this.menuService.findMenuByLocation(location, true);
  }

  // ============ Settings ============

  @Get('settings')
  async getPublicSettings() {
    return this.settingsService.findPublicSettings();
  }

  @Get('settings/:key')
  async getSettingByKey(@Param('key') key: string) {
    return this.settingsService.getValue(key);
  }

  // ============ Contact Form ============

  @Post('contact')
  async submitContact(
    @Body()
    body: {
      name: string;
      email: string;
      phone?: string;
      subject: string;
      message: string;
    },
    @Req() req: Request,
  ) {
    return this.prisma.contactSubmission.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        subject: body.subject,
        message: body.message,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        referrer: req.get('referer'),
      },
    });
  }

  // ============ Newsletter ============

  @Post('newsletter/subscribe')
  async subscribeNewsletter(
    @Body() body: { email: string; name?: string; source?: string },
  ) {
    // Check if already subscribed
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email: body.email },
    });

    if (existing) {
      // If unsubscribed, reactivate
      if (existing.status === 'unsubscribed') {
        return this.prisma.newsletterSubscription.update({
          where: { email: body.email },
          data: {
            status: 'active',
            name: body.name || existing.name,
            source: body.source || existing.source,
            subscribedAt: new Date(),
            unsubscribedAt: null,
          },
        });
      }

      return existing;
    }

    // Generate unsubscribe token
    const unsubscribeToken = randomBytes(32).toString('hex');

    return this.prisma.newsletterSubscription.create({
      data: {
        ...body,
        unsubscribeToken,
      },
    });
  }

  @Post('newsletter/unsubscribe')
  async unsubscribeNewsletter(@Body() body: { token: string }) {
    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { unsubscribeToken: body.token },
    });

    if (!subscription) {
      throw new NotFoundException('Invalid unsubscribe token');
    }

    return this.prisma.newsletterSubscription.update({
      where: { id: subscription.id },
      data: {
        status: 'unsubscribed',
        unsubscribedAt: new Date(),
      },
    });
  }

  // ============ FAQs ============

  @Get('faqs')
  async getFaqs(@Query('category') category?: string) {
    const where: { isActive: boolean; category?: string } = { isActive: true };
    if (category) {
      where.category = category;
    }

    return this.prisma.fAQ.findMany({
      where,
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }

  @Get('faq-categories')
  async getFaqCategories() {
    const result = await this.prisma.fAQ.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: true,
    });

    return result.map((item) => ({
      category: item.category,
      count: item._count,
    }));
  }

  @Post('faqs/:id/view')
  async incrementFaqView(@Param('id') id: string) {
    return this.prisma.fAQ.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
    });
  }
}
