import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.provider';
import type { DrizzleDB } from '../../database/database.provider';
import { contactMessages } from '../../database/schema';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private notificationsService: NotificationsService,
  ) {}

  async store(body: any): Promise<any> {
    const phone = body.phone_number ?? body.phone ?? null;
    const [r] = await this.db.insert(contactMessages).values({
      name: body.name,
      email: body.email,
      phone,
      subject: body.subject ?? null,
      message: body.message,
      isRead: false,
    }).$returningId();

    const created = await this.db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, r.id),
    });

    // Emit real-time notification to Admin
    this.notificationsService.createAndEmitNotification({
      recipientGroup: 'admin',
      title: '📩 New Customer Inquiry / Complaint',
      message: `Inquiry from ${body.name} (${body.email}): "${body.subject || body.message.slice(0, 50)}"`,
      type: 'CUSTOMER_COMPLAINT',
      priority: 'HIGH',
      entityType: 'contact',
      entityId: r.id,
      referenceKey: `CONTACT_MSG_${r.id}`,
      link: '/dashboard/contact-messages',
      metadata: { contactId: r.id, email: body.email, name: body.name }
    }).catch(err => this.logger.error('Failed to emit contact notification:', err));

    return {
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: created,
    };
  }

  async index(query: any): Promise<any> {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = (query.search ?? query.q ?? '').trim().toLowerCase();

    let all = await this.db.query.contactMessages.findMany({
      orderBy: [desc(contactMessages.createdAt)],
    });

    if (search) {
      all = all.filter(m =>
        m.name?.toLowerCase().includes(search) ||
        m.email?.toLowerCase().includes(search) ||
        m.phone?.toLowerCase().includes(search) ||
        m.subject?.toLowerCase().includes(search) ||
        m.message?.toLowerCase().includes(search),
      );
    }

    const total = all.length;
    const start = (page - 1) * perPage;
    const paginated = all.slice(start, start + perPage).map(m => ({
      ...m,
      is_read: Boolean(m.isRead),
      phone_number: m.phone || '',
      created_at: m.createdAt,
      updated_at: m.updatedAt,
    }));
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      success: true,
      data: {
        data: paginated,
        messages: paginated,
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
      },
    };
  }

  async show(id: number): Promise<any> {
    const msg = await this.db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, id),
    });
    if (!msg) throw new NotFoundException('Message not found');
    return { success: true, data: msg };
  }

  async markAsRead(id: number): Promise<any> {
    const msg = await this.db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, id),
    });
    if (!msg) throw new NotFoundException('Message not found');

    await this.db.update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, id));
    const updated = await this.db.query.contactMessages.findFirst({
      where: eq(contactMessages.id, id),
    });
    return { success: true, message: 'Message marked as read', data: updated };
  }

  async destroy(id: number): Promise<any> {
    await this.db.delete(contactMessages).where(eq(contactMessages.id, id));
    return { success: true, message: 'Message deleted successfully' };
  }
}
