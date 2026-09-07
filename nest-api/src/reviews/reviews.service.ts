import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { reviews, products } from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { matchesSlugOrId } from '../common/utils/slug.util';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private notificationsService: NotificationsService,
  ) {}

  private async resolveProductId(productIdOrSlug: string | number): Promise<number> {
    const numId = Number(productIdOrSlug);
    if (!isNaN(numId) && numId > 0 && String(productIdOrSlug).trim() === String(numId)) {
      return numId;
    }
    const allProds = await this.db.query.products.findMany({
      columns: { id: true, name: true, itemCode: true },
    });
    const found = allProds.find((p: any) => matchesSlugOrId(p, productIdOrSlug));
    return found ? Number(found.id) : 0;
  }

  async index(productIdOrSlug: string | number, query: any): Promise<any> {
    try {
      const productId = await this.resolveProductId(productIdOrSlug);
      const perPage = Math.max(1, parseInt(query.per_page ?? query.limit ?? '10'));
      const page = Math.max(1, parseInt(query.page ?? '1'));
      const rating = query.rating ? parseInt(query.rating) : null;
      const sortBy = query.sort_by ?? 'newest';
      const search = query.search?.trim().toLowerCase();

      // 1. Fetch all approved reviews for this product for global summary stats
      const rawAllReviews = await this.db.query.reviews.findMany({
        where: and(eq(reviews.productId, productId), eq(reviews.isApproved, true)),
        with: { user: { columns: { id: true, name: true, profilePicture: true } } } as any,
      });

      const totalReviews = rawAllReviews.length;
      const averageRating = totalReviews > 0
        ? rawAllReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;
      const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of rawAllReviews) {
        if (r.rating >= 1 && r.rating <= 5) {
          ratingDistribution[r.rating] = (ratingDistribution[r.rating] ?? 0) + 1;
        }
      }

      // 2. Filter reviews by rating, keyword search, verified status, or media if provided
      let filteredReviews = [...rawAllReviews];
      if (rating) {
        filteredReviews = filteredReviews.filter(r => r.rating === rating);
      }
      if (query.verified_only === 'true' || query.verified_only === true) {
        filteredReviews = filteredReviews.filter(r => Boolean(r.isVerified));
      }
      if (query.media_only === 'true' || query.media_only === true) {
        filteredReviews = filteredReviews.filter(r => {
          if (!r.images) return false;
          if (Array.isArray(r.images)) return r.images.length > 0;
          return typeof r.images === 'string' && r.images.length > 2;
        });
      }
      if (query.text_only === 'true' || query.text_only === true) {
        filteredReviews = filteredReviews.filter(r => {
          if (!r.images) return true;
          if (Array.isArray(r.images)) return r.images.length === 0;
          return false;
        });
      }
      if (search) {
        filteredReviews = filteredReviews.filter(r => 
          (r.title && r.title.toLowerCase().includes(search)) ||
          (r.reviewText && r.reviewText.toLowerCase().includes(search)) ||
          ((r as any).user?.name && (r as any).user.name.toLowerCase().includes(search))
        );
      }

      // 3. Sort reviews
      filteredReviews.sort((a, b) => {
        switch (sortBy) {
          case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          case 'highest': return b.rating - a.rating;
          case 'lowest': return a.rating - b.rating;
          case 'helpful': return (b.helpfulCount || 0) - (a.helpfulCount || 0);
          default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      const filteredTotal = filteredReviews.length;
      const lastPage = Math.max(1, Math.ceil(filteredTotal / perPage));
      const hasNextPage = page < lastPage;

      const start = (page - 1) * perPage;
      const paginated = filteredReviews.slice(start, start + perPage);

      const normalizedData = paginated.map(r => ({
        ...r,
        id: r.id,
        user_id: r.userId,
        product_id: r.productId,
        rating: r.rating,
        review_text: r.reviewText,
        title: r.title,
        images: r.images,
        is_verified: Boolean(r.isVerified),
        is_approved: Boolean(r.isApproved),
        helpful_count: r.helpfulCount || 0,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
        user_name: (r as any).user?.name || 'Verified Customer',
        user: (r as any).user,
      }));

      return {
        res: 'success',
        reviews: {
          data: normalizedData,
          current_page: page,
          per_page: perPage,
          total: filteredTotal,
          last_page: lastPage,
          hasNextPage,
          has_next_page: hasNextPage,
          has_more: hasNextPage,
        },
        summary: {
          total_reviews: totalReviews,
          average_rating: Math.round(averageRating * 10) / 10,
          rating_distribution: ratingDistribution,
        },
      };
    } catch (e: any) {
      throw new HttpException(
        { res: 'error', message: 'Failed to fetch reviews' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async show(id: number): Promise<any> {
    const review = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, id),
      with: { user: { columns: { id: true, name: true, profilePicture: true } } } as any,
    });
    if (!review) {
      throw new HttpException(
        { res: 'error', message: 'Review not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { res: 'success', review };
  }

  async store(userId: number, body: any, imagePaths: string[] = []): Promise<any> {
    const productId = body?.product_id ? Number(body.product_id) : null;
    const rating = body?.rating ? Number(body.rating) : null;

    if (!productId || !rating || rating < 1 || rating > 5) {
      throw new HttpException(
        {
          res: 'error',
          message: 'Validation failed',
          errors: {
            ...(!productId ? { product_id: ['The product_id field is required.'] } : {}),
            ...(!rating || rating < 1 || rating > 5 ? { rating: ['The rating must be between 1 and 5.'] } : {}),
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const existing = await this.db.query.reviews.findFirst({
      where: and(eq(reviews.userId, userId), eq(reviews.productId, productId)),
    });
    if (existing) {
      throw new HttpException(
        { res: 'error', message: 'You have already reviewed this product' },
        HttpStatus.CONFLICT, // 409
      );
    }

    const product = await this.db.query.products.findFirst({ where: eq(products.id, productId) });
    if (!product) {
      throw new HttpException(
        { res: 'error', message: 'Product not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    const [r] = await this.db.insert(reviews).values({
      userId,
      productId: productId,
      rating: rating,
      reviewText: body.review_text ?? null,
      title: body.title ?? null,
      images: imagePaths,
      isVerified: false,
      isApproved: true,
      helpfulVotes: [],
      helpfulCount: 0,
    }).$returningId();

    const createdReview = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, r.id),
      with: { user: { columns: { id: true, name: true, profilePicture: true } } } as any,
    });

    const isNegative = rating <= 2;
    this.notificationsService.createAndEmitNotification({
      recipientGroup: 'admin',
      title: isNegative ? `⚠️ Low Rating Review (${rating} Stars)` : `⭐ New Product Review (${rating} Stars)`,
      message: `Review on "${product.name}" by ${(createdReview as any)?.user?.name || 'Customer'}: "${body.review_text || body.title || 'No comment'}"`,
      type: 'NEW_REVIEW',
      priority: isNegative ? 'HIGH' : 'NORMAL',
      entityType: 'product',
      entityId: productId,
      referenceKey: `REVIEW_${r.id}`,
      link: `/dashboard/products/${productId}`,
    }).catch(() => {});

    return { res: 'success', message: 'Review submitted successfully', review: createdReview };
  }

  async update(userId: number, id: number, body: any, newImagePaths: string[] = []): Promise<any> {
    const rating = body?.rating ? Number(body.rating) : null;
    if (!rating || rating < 1 || rating > 5) {
      throw new HttpException(
        {
          res: 'error',
          message: 'Validation failed',
          errors: { rating: ['The rating must be between 1 and 5.'] },
        },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const review = await this.db.query.reviews.findFirst({ where: eq(reviews.id, id) });
    if (!review) {
      throw new HttpException(
        { res: 'error', message: 'Review not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (review.userId !== userId) {
      throw new HttpException(
        { res: 'error', message: 'Unauthorized to update this review' },
        HttpStatus.FORBIDDEN, // 403
      );
    }

    let existingImages: string[] = [];
    if (Array.isArray(body.existing_images)) {
      existingImages = body.existing_images;
    } else if (typeof body.existing_images === 'string') {
      existingImages = [body.existing_images];
    } else if (body.existing_images && typeof body.existing_images === 'object') {
      existingImages = Object.values(body.existing_images);
    } else {
      existingImages = Object.keys(body)
        .filter(k => k.startsWith('existing_images'))
        .map(k => body[k]);
    }
    existingImages = existingImages.filter(img => typeof img === 'string' && img.trim().length > 0);
    const allImages = [...existingImages, ...newImagePaths].slice(0, 5);

    await this.db.update(reviews).set({
      rating: rating,
      reviewText: body.review_text ?? null,
      title: body.title ?? null,
      images: allImages,
    }).where(eq(reviews.id, id));

    const updated = await this.db.query.reviews.findFirst({
      where: eq(reviews.id, id),
      with: { user: { columns: { id: true, name: true, profilePicture: true } } } as any,
    });

    return { res: 'success', message: 'Review updated successfully', review: updated };
  }

  async destroy(userId: number, id: number): Promise<any> {
    const review = await this.db.query.reviews.findFirst({ where: eq(reviews.id, id) });
    if (!review) {
      throw new HttpException(
        { res: 'error', message: 'Review not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    if (review.userId !== userId) {
      throw new HttpException(
        { res: 'error', message: 'Unauthorized to delete this review' },
        HttpStatus.FORBIDDEN, // 403
      );
    }

    await this.db.delete(reviews).where(eq(reviews.id, id));
    return { res: 'success', message: 'Review deleted successfully' };
  }

  async toggleHelpful(userId: number, reviewId: number): Promise<any> {
    const review = await this.db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
    if (!review) {
      throw new HttpException(
        { res: 'error', message: 'Review not found' },
        HttpStatus.NOT_FOUND, // 404
      );
    }

    const votes: number[] = Array.isArray(review.helpfulVotes) ? (review.helpfulVotes as number[]) : [];
    const idx = votes.indexOf(userId);
    let action: string;

    if (idx > -1) {
      votes.splice(idx, 1);
      action = 'unmarked';
    } else {
      votes.push(userId);
      action = 'marked';
    }

    await this.db.update(reviews).set({ helpfulVotes: votes, helpfulCount: votes.length }).where(eq(reviews.id, reviewId));

    return {
      res: 'success',
      message: `Review ${action} as helpful`,
      helpful_count: votes.length,
      is_helpful: action === 'marked',
    };
  }

  async getUserReview(userId: number, productIdOrSlug: string | number): Promise<any> {
    const productId = await this.resolveProductId(productIdOrSlug);
    const review = await this.db.query.reviews.findFirst({
      where: and(eq(reviews.userId, userId), eq(reviews.productId, productId)),
      with: { user: { columns: { id: true, name: true, profilePicture: true } } } as any,
    });
    if (!review) return { res: 'success', review: null };

    const normalized = {
      ...review,
      id: review.id,
      user_id: review.userId,
      product_id: review.productId,
      rating: review.rating,
      review_text: review.reviewText,
      title: review.title,
      images: review.images,
      is_verified: Boolean(review.isVerified),
      is_approved: Boolean(review.isApproved),
      helpful_count: review.helpfulCount || 0,
      created_at: review.createdAt,
      updated_at: review.updatedAt,
      user_name: (review as any).user?.name || 'Verified Customer',
      user: (review as any).user,
    };

    return { res: 'success', review: normalized };
  }
}
