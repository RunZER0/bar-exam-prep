import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, spacedRepetitionCards } from '@/lib/db/schema';
import { eq, and, lte, desc } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';
import { 
  calculateNextReview, 
  getDueCards, 
  calculateStudyStats,
  createSpacedRepetitionCard,
  type SpacedRepetitionCard 
} from '@/lib/services/spaced-repetition';

/**
 * GET /api/tutor/review
 * Fetch due spaced repetition cards
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unitId = searchParams.get('unitId');

    const today = new Date().toISOString().split('T')[0];

    // Query cards
    let query = db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.userId, user.id),
        eq(spacedRepetitionCards.isActive, true),
        lte(spacedRepetitionCards.nextReviewDate, today)
      ))
      .orderBy(spacedRepetitionCards.nextReviewDate)
      .limit(limit);

    const cards = await query;

    // Filter by unit if specified
    let filteredCards = cards;
    if (unitId) {
      filteredCards = cards.filter(c => c.unitId === unitId);
    }

    // Get stats
    const allCards = await db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.userId, user.id),
        eq(spacedRepetitionCards.isActive, true)
      ));

    const cardData = allCards.map(c => ({
      id: c.id,
      userId: c.userId,
      contentType: c.contentType as SpacedRepetitionCard['contentType'],
      contentId: c.contentId,
      title: c.title,
      content: c.content,
      unitId: c.unitId || undefined,
      easinessFactor: c.easinessFactor,
      interval: c.interval,
      repetitions: c.repetitions,
      nextReviewDate: c.nextReviewDate,
      lastReviewDate: c.lastReviewDate || undefined,
      lastQuality: c.lastQuality || undefined,
      totalReviews: c.totalReviews,
      correctReviews: c.correctReviews,
    }));

    const stats = calculateStudyStats(cardData);

    return NextResponse.json({
      cards: filteredCards,
      stats,
      totalDue: filteredCards.length,
    });
  } catch (error) {
    console.error('Error fetching review cards:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review cards' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tutor/review
 * Create a new spaced repetition card
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { contentType, contentId, title, content, unitId } = body;

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if card already exists
    const [existingCard] = await db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.userId, user.id),
        eq(spacedRepetitionCards.contentId, contentId),
        eq(spacedRepetitionCards.contentType, contentType)
      ))
      .limit(1);

    if (existingCard) {
      // Reactivate if inactive
      if (!existingCard.isActive) {
        const today = new Date().toISOString().split('T')[0];
        await db.update(spacedRepetitionCards)
          .set({ isActive: true, nextReviewDate: today })
          .where(eq(spacedRepetitionCards.id, existingCard.id));
      }
      return NextResponse.json({ card: existingCard, existing: true });
    }

    // Create new card
    const today = new Date().toISOString().split('T')[0];
    const [newCard] = await db.insert(spacedRepetitionCards).values({
      userId: user.id,
      contentType,
      contentId,
      title,
      content,
      unitId,
      easinessFactor: 250, // 2.5 default
      interval: 1,
      repetitions: 0,
      nextReviewDate: today,
      totalReviews: 0,
      correctReviews: 0,
      isActive: true,
    }).returning();

    return NextResponse.json({ card: newCard, existing: false });
  } catch (error) {
    console.error('Error creating review card:', error);
    return NextResponse.json(
      { error: 'Failed to create review card' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tutor/review
 * Submit a review result and update card scheduling
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const body = await req.json();
    const { cardId, quality } = body; // quality: 0-5

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get card
    const [card] = await db.select().from(spacedRepetitionCards)
      .where(and(
        eq(spacedRepetitionCards.id, cardId),
        eq(spacedRepetitionCards.userId, user.id)
      ))
      .limit(1);

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Calculate next review
    const cardData: SpacedRepetitionCard = {
      id: card.id,
      userId: card.userId,
      contentType: card.contentType as SpacedRepetitionCard['contentType'],
      contentId: card.contentId,
      title: card.title,
      content: card.content,
      unitId: card.unitId || undefined,
      easinessFactor: card.easinessFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      nextReviewDate: card.nextReviewDate,
      lastReviewDate: card.lastReviewDate || undefined,
      lastQuality: card.lastQuality || undefined,
      totalReviews: card.totalReviews,
      correctReviews: card.correctReviews,
    };

    const result = calculateNextReview(cardData, quality);
    const today = new Date().toISOString().split('T')[0];
    const isCorrect = quality >= 3;

    // Update card
    const [updatedCard] = await db.update(spacedRepetitionCards)
      .set({
        easinessFactor: result.newEasinessFactor,
        interval: result.newInterval,
        repetitions: result.newRepetitions,
        nextReviewDate: result.nextReviewDate,
        lastReviewDate: today,
        lastQuality: quality,
        totalReviews: card.totalReviews + 1,
        correctReviews: isCorrect ? card.correctReviews + 1 : card.correctReviews,
        updatedAt: new Date(),
      })
      .where(eq(spacedRepetitionCards.id, cardId))
      .returning();

    return NextResponse.json({
      success: true,
      card: updatedCard,
      nextReview: {
        date: result.nextReviewDate,
        interval: result.newInterval,
        easinessFactor: result.newEasinessFactor / 100,
      },
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tutor/review
 * Deactivate a spaced repetition card
 */
export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyIdToken(token);
    
    const { searchParams } = new URL(req.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return NextResponse.json({ error: 'Card ID required' }, { status: 400 });
    }

    // Get user
    const [user] = await db.select().from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Deactivate card (soft delete)
    await db.update(spacedRepetitionCards)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(spacedRepetitionCards.id, cardId),
        eq(spacedRepetitionCards.userId, user.id)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review card:', error);
    return NextResponse.json(
      { error: 'Failed to delete review card' },
      { status: 500 }
    );
  }
}
