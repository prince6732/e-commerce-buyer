import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, like, and, or, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.provider';
import type { DrizzleDB } from '../../database/database.provider';
import { users, orders, reviews, likes } from '../../database/schema';

@Injectable()
export class UsersAdminService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async index(query: any) {
    const perPage = parseInt(query.limit ?? query.per_page ?? '10');
    const page = parseInt(query.page ?? '1');
    const search = query.search ?? '';
    const status = query.status; // 'active' | 'blocked' | undefined

    let allUsers = await this.db.query.users.findMany({
      columns: { password: false } as any,
      orderBy: [desc(users.createdAt)],
    });

    // Filter non-admin, verified users
    allUsers = allUsers.filter((u: any) => u.role !== 'Admin' && (u.isVerified === 'true' || u.emailVerifiedAt));

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      allUsers = allUsers.filter((u: any) =>
        u.name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.phoneNumber?.toLowerCase().includes(s),
      );
    }

    // Status filter
    if (status === 'active') allUsers = allUsers.filter((u: any) => u.status);
    if (status === 'blocked') allUsers = allUsers.filter((u: any) => !u.status);

    // Paginate
    const total = allUsers.length;
    const start = (page - 1) * perPage;
    const paginated = allUsers.slice(start, start + perPage).map((u: any) => ({
      ...u,
      slug: (u.slug || u.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      phone_number: u.phoneNumber ?? u.phone_number ?? null,
      profile_picture: u.profilePicture ?? u.profile_picture ?? null,
      is_verified: u.isVerified ?? u.is_verified ?? false,
      created_at: u.createdAt ?? u.created_at ?? null,
    }));

    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      res: 'success',
      users: {
        data: paginated,
        current_page: page,
        per_page: perPage,
        limit: perPage,
        total,
        last_page: lastPage,
        hasNextPage,
        has_next_page: hasNextPage,
        has_more: hasNextPage,
      },
      message: 'Users fetched successfully',
    };
  }

  private async _resolveUser(idOrSlug: string | number) {
    let userRaw: any = null;
    const numId = Number(idOrSlug);
    if (!isNaN(numId) && numId > 0 && String(idOrSlug).trim() === String(numId)) {
      userRaw = await this.db.query.users.findFirst({
        where: eq(users.id, numId),
      });
    }

    if (!userRaw) {
      const slugLower = String(idOrSlug).toLowerCase().trim();
      const allUsers = await this.db.query.users.findMany();
      userRaw = allUsers.find((u: any) => {
        const itemSlug = (u.name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        return itemSlug === slugLower || (u.email || '').toLowerCase().trim() === slugLower || (u.name || '').toLowerCase().trim() === slugLower;
      });
    }

    if (!userRaw) throw new NotFoundException('User not found');
    return userRaw;
  }

  async show(idOrSlug: string | number) {
    const userRaw = await this._resolveUser(idOrSlug);
    const id = Number(userRaw.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...user } = userRaw as any;

    const userSlug = (user.slug || user.name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Get recent orders (last 10)
    const userOrders = await this.db.query.orders.findMany({
      where: eq(orders.userId, id),
      with: { orderItems: { with: { product: true } as any } } as any,
      orderBy: [desc(orders.createdAt)],
      limit: 10,
    });

    // Get recent reviews (last 10)
    const userReviews = await this.db.query.reviews.findMany({
      where: eq(reviews.userId, id),
      with: { product: true } as any,
      orderBy: [desc(reviews.createdAt)],
      limit: 10,
    });

    // Stats
    const allOrders = await this.db.query.orders.findMany({ where: eq(orders.userId, id) });
    const allReviews = await this.db.query.reviews.findMany({ where: eq(reviews.userId, id) });
    const allLikes = await this.db.query.likes.findMany({ where: eq(likes.userId, id) });
    const totalSpent = allOrders
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total as string), 0);

    const recentOrders = userOrders.map((order: any) => ({
      id: order.id,
      order_number: order.orderNumber,
      total_amount: order.total,
      status: order.status,
      payment_status: order.paymentStatus,
      items_count: (order.orderItems ?? []).length,
      items: (order.orderItems ?? []).map((item: any) => ({
        id: item.id,
        product_name: item.product?.name ?? 'Unknown Product',
        product_image: item.product?.imageUrl ?? null,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      created_at: order.createdAt,
    }));

    const recentReviews = userReviews.map((r: any) => ({
      id: r.id,
      product_id: r.productId,
      product_name: r.product?.name ?? 'Unknown',
      product_image: r.product?.imageUrl ?? null,
      rating: r.rating,
      title: r.title,
      review_text: r.reviewText,
      is_approved: r.isApproved,
      helpful_count: r.helpfulCount,
      created_at: r.createdAt,
    }));

    // Get user's liked products (last 10)
    const userLikes = await this.db.query.likes.findMany({
      where: eq(likes.userId, id),
      with: { product: true } as any,
      orderBy: [desc(likes.createdAt)],
      limit: 10,
    });

    const likedProducts = userLikes.map((like: any) => ({
      id: like.product?.id,
      name: like.product?.name ?? 'Unknown',
      image_url: like.product?.imageUrl ?? null,
      price: 0,
    }));

    return {
      res: 'success',
      user: {
        ...user,
        slug: userSlug,
        phone_number: user.phoneNumber ?? user.phone_number ?? null,
        profile_picture: user.profilePicture ?? user.profile_picture ?? null,
        is_verified: user.isVerified ?? user.is_verified ?? false,
        created_at: user.createdAt ?? user.created_at ?? null,
      },
      stats: {
        total_orders: allOrders.length,
        total_reviews: allReviews.length,
        total_likes: allLikes.length,
        total_spent: totalSpent,
        average_order_value: allOrders.length > 0 ? totalSpent / allOrders.length : 0,
        account_status: user.status ? 'active' : 'blocked',
        is_verified: user.isVerified === 'true' || !!user.emailVerifiedAt,
        member_since: new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      },
      recent_orders: recentOrders,
      recent_reviews: recentReviews,
      liked_products: likedProducts,
      message: 'User details fetched successfully',
    };
  }

  async blockUser(idOrSlug: string | number) {
    const user = await this._resolveUser(idOrSlug);
    const id = Number(user.id);
    if (user.role === 'Admin') throw new ForbiddenException('Cannot block admin users');

    await this.db.update(users).set({ status: false }).where(eq(users.id, id));
    return {
      res: 'success',
      message: 'User has been blocked successfully',
      user: { id: user.id, name: user.name, status: false },
    };
  }

  async unblockUser(idOrSlug: string | number) {
    const user = await this._resolveUser(idOrSlug);
    const id = Number(user.id);

    await this.db.update(users).set({ status: true }).where(eq(users.id, id));
    return {
      res: 'success',
      message: 'User has been unblocked successfully',
      user: { id: user.id, name: user.name, status: true },
    };
  }

  async toggleStatus(idOrSlug: string | number) {
    const user = await this._resolveUser(idOrSlug);
    const id = Number(user.id);
    if (user.role === 'Admin' && user.status) throw new ForbiddenException('Cannot block admin users');

    const newStatus = !user.status;
    await this.db.update(users).set({ status: newStatus }).where(eq(users.id, id));

    return {
      res: 'success',
      message: newStatus ? 'User unblocked successfully' : 'User blocked successfully',
      user: { id: user.id, name: user.name, status: newStatus },
    };
  }

  async getStatistics() {
    const all = await this.db.query.users.findMany();
    const nonAdmin = all.filter(u => u.role !== 'Admin' && (u.isVerified === 'true' || u.emailVerifiedAt));

    const now = new Date();
    const totalUsers = nonAdmin.length;
    const activeUsers = nonAdmin.filter(u => u.status).length;
    const blockedUsers = nonAdmin.filter(u => !u.status).length;
    const newUsersThisMonth = nonAdmin.filter(u => {
      const d = new Date(u.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return {
      res: 'success',
      statistics: {
        total_users: totalUsers,
        active_users: activeUsers,
        blocked_users: blockedUsers,
        verified_users: totalUsers,
        new_users_this_month: newUsersThisMonth,
        verification_rate: totalUsers > 0 ? Math.round((totalUsers / totalUsers) * 100 * 10) / 10 : 0,
      },
    };
  }
}
