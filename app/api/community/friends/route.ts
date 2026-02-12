import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userFriends, friendSuggestions, users, userProgress, studyRooms, roomMembers } from '@/lib/db/schema';
import { eq, and, or, desc, sql, ne, count } from 'drizzle-orm';
import { verifyIdToken } from '@/lib/firebase/admin';

// GET - Fetch friends list and suggestions
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'friends' | 'suggestions' | 'pending' | 'all'

    let response: {
      friends?: any[];
      suggestions?: any[];
      pendingRequests?: any[];
      sentRequests?: any[];
    } = {};

    // Fetch accepted friends
    if (!type || type === 'friends' || type === 'all') {
      const friendships = await db
        .select()
        .from(userFriends)
        .where(and(
          or(
            eq(userFriends.userId, userId),
            eq(userFriends.friendId, userId)
          ),
          eq(userFriends.status, 'accepted')
        ));

      const friendsWithDetails = await Promise.all(
        friendships.map(async (friendship) => {
          const friendUserId = friendship.userId === userId 
            ? friendship.friendId 
            : friendship.userId;
          
          const [user] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
            })
            .from(users)
            .where(eq(users.id, friendUserId))
            .limit(1);

          return {
            friendshipId: friendship.id,
            friendId: friendUserId,
            displayName: user?.displayName || 'Unknown',
            photoURL: user?.photoURL,
            matchScore: friendship.matchScore || 0,
            sharedInterests: friendship.sharedInterests as string[] || [],
            connectedAt: friendship.updatedAt,
          };
        })
      );

      response.friends = friendsWithDetails;
    }

    // Fetch AI-curated suggestions
    if (!type || type === 'suggestions' || type === 'all') {
      // First check for existing suggestions
      let suggestions = await db
        .select()
        .from(friendSuggestions)
        .where(and(
          eq(friendSuggestions.userId, userId),
          eq(friendSuggestions.status, 'pending')
        ))
        .orderBy(desc(friendSuggestions.matchScore))
        .limit(10);

      // If no suggestions exist, generate them based on AI matching
      if (suggestions.length === 0) {
        suggestions = await generateAISuggestions(userId);
      }

      const suggestionsWithDetails = await Promise.all(
        suggestions.map(async (suggestion) => {
          const [user] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
            })
            .from(users)
            .where(eq(users.id, suggestion.suggestedUserId))
            .limit(1);

          // Count mutual friends
          const mutualCount = await countMutualFriends(userId, suggestion.suggestedUserId);

          return {
            id: suggestion.id,
            userId: suggestion.suggestedUserId,
            displayName: user?.displayName || 'Unknown',
            photoURL: user?.photoURL,
            matchScore: suggestion.matchScore || 0,
            reasons: suggestion.reasons as string[] || [],
            mutualFriends: mutualCount,
          };
        })
      );

      response.suggestions = suggestionsWithDetails;
    }

    // Fetch pending friend requests (received)
    if (!type || type === 'pending' || type === 'all') {
      const pendingRequests = await db
        .select()
        .from(userFriends)
        .where(and(
          eq(userFriends.friendId, userId),
          eq(userFriends.status, 'pending')
        ));

      const pendingWithDetails = await Promise.all(
        pendingRequests.map(async (request) => {
          const [user] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
            })
            .from(users)
            .where(eq(users.id, request.userId))
            .limit(1);

          return {
            requestId: request.id,
            fromUserId: request.userId,
            displayName: user?.displayName || 'Unknown',
            photoURL: user?.photoURL,
            requestedAt: request.createdAt,
          };
        })
      );

      response.pendingRequests = pendingWithDetails;
    }

    // Fetch sent requests
    if (type === 'all') {
      const sentRequests = await db
        .select()
        .from(userFriends)
        .where(and(
          eq(userFriends.userId, userId),
          eq(userFriends.status, 'pending')
        ));

      const sentWithDetails = await Promise.all(
        sentRequests.map(async (request) => {
          const [user] = await db
            .select({
              displayName: users.displayName,
              photoURL: users.photoURL,
            })
            .from(users)
            .where(eq(users.id, request.friendId))
            .limit(1);

          return {
            requestId: request.id,
            toUserId: request.friendId,
            displayName: user?.displayName || 'Unknown',
            photoURL: user?.photoURL,
            requestedAt: request.createdAt,
          };
        })
      );

      response.sentRequests = sentWithDetails;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

// POST - Send, accept, reject friend requests
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await req.json();
    const { action, targetUserId, requestId } = body;

    if (action === 'send') {
      // Send friend request
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
      }

      if (targetUserId === userId) {
        return NextResponse.json({ error: 'Cannot friend yourself' }, { status: 400 });
      }

      // Check if friendship already exists
      const existingFriendship = await db
        .select()
        .from(userFriends)
        .where(or(
          and(eq(userFriends.userId, userId), eq(userFriends.friendId, targetUserId)),
          and(eq(userFriends.userId, targetUserId), eq(userFriends.friendId, userId))
        ))
        .limit(1);

      if (existingFriendship.length > 0) {
        return NextResponse.json({ 
          error: 'Friendship already exists or pending',
          status: existingFriendship[0].status 
        }, { status: 400 });
      }

      // Calculate match score and shared interests
      const { matchScore, sharedInterests } = await calculateMatchScore(userId, targetUserId);

      // Create friend request
      await db.insert(userFriends).values({
        userId,
        friendId: targetUserId,
        status: 'pending',
        matchScore,
        sharedInterests,
      });

      // Mark suggestion as accepted if it exists
      await db
        .update(friendSuggestions)
        .set({ status: 'accepted' })
        .where(and(
          eq(friendSuggestions.userId, userId),
          eq(friendSuggestions.suggestedUserId, targetUserId)
        ));

      return NextResponse.json({ message: 'Friend request sent' });
    }

    if (action === 'accept') {
      // Accept friend request
      if (!requestId) {
        return NextResponse.json({ error: 'Request ID required' }, { status: 400 });
      }

      const [request] = await db
        .select()
        .from(userFriends)
        .where(and(
          eq(userFriends.id, requestId),
          eq(userFriends.friendId, userId),
          eq(userFriends.status, 'pending')
        ))
        .limit(1);

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      await db
        .update(userFriends)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(userFriends.id, requestId));

      return NextResponse.json({ message: 'Friend request accepted' });
    }

    if (action === 'reject') {
      // Reject friend request
      if (!requestId) {
        return NextResponse.json({ error: 'Request ID required' }, { status: 400 });
      }

      await db
        .update(userFriends)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(userFriends.id, requestId));

      return NextResponse.json({ message: 'Friend request rejected' });
    }

    if (action === 'remove') {
      // Remove friend
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
      }

      await db.delete(userFriends).where(or(
        and(eq(userFriends.userId, userId), eq(userFriends.friendId, targetUserId)),
        and(eq(userFriends.userId, targetUserId), eq(userFriends.friendId, userId))
      ));

      return NextResponse.json({ message: 'Friend removed' });
    }

    if (action === 'dismiss_suggestion') {
      // Dismiss a friend suggestion
      if (!targetUserId) {
        return NextResponse.json({ error: 'Target user ID required' }, { status: 400 });
      }

      await db
        .update(friendSuggestions)
        .set({ status: 'dismissed' })
        .where(and(
          eq(friendSuggestions.userId, userId),
          eq(friendSuggestions.suggestedUserId, targetUserId)
        ));

      return NextResponse.json({ message: 'Suggestion dismissed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in friends POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// AI-driven friend suggestion generation
async function generateAISuggestions(userId: string) {
  try {
    // Get user's study patterns
    const userStudyData = await db
      .select({
        topicId: userProgress.topicId,
        correct: sql<number>`SUM(CASE WHEN ${userProgress.isCorrect} THEN 1 ELSE 0 END)`,
        total: sql<number>`COUNT(*)`,
      })
      .from(userProgress)
      .where(eq(userProgress.userId, userId))
      .groupBy(userProgress.topicId);

    // Get user's room memberships
    const userRooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId));

    const userRoomIds = userRooms.map(r => r.roomId);

    // Find users with similar study patterns or in same rooms
    const potentialFriends = await db
      .select({
        suggestedUserId: roomMembers.userId,
      })
      .from(roomMembers)
      .where(and(
        ne(roomMembers.userId, userId),
        userRoomIds.length > 0 
          ? sql`${roomMembers.roomId} IN (${sql.join(userRoomIds.map(id => sql`${id}`), sql`, `)})` 
          : sql`1=1`
      ))
      .groupBy(roomMembers.userId)
      .limit(20);

    // Calculate match scores and reasons
    const suggestions = await Promise.all(
      potentialFriends.map(async (pf) => {
        const { matchScore, sharedInterests } = await calculateMatchScore(userId, pf.suggestedUserId);
        
        const reasons: string[] = [];
        if (sharedInterests.includes('same_rooms')) reasons.push('Active in same rooms');
        if (sharedInterests.includes('similar_weak_areas')) reasons.push('Similar weak areas');
        if (sharedInterests.includes('same_study_schedule')) reasons.push('Similar study schedule');
        if (sharedInterests.includes('complementary_strengths')) reasons.push('Complementary strengths');

        return {
          userId,
          suggestedUserId: pf.suggestedUserId,
          matchScore,
          reasons: reasons.length > 0 ? reasons : ['Fellow bar exam student'],
          status: 'pending' as const,
        };
      })
    );

    // Filter and sort by match score
    const filteredSuggestions = suggestions
      .filter(s => s.matchScore > 50)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    // Save suggestions to database
    if (filteredSuggestions.length > 0) {
      await db.insert(friendSuggestions).values(filteredSuggestions).onConflictDoNothing();
    }

    return filteredSuggestions;
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    return [];
  }
}

// Calculate match score between two users
async function calculateMatchScore(userId1: string, userId2: string): Promise<{
  matchScore: number;
  sharedInterests: string[];
}> {
  const sharedInterests: string[] = [];
  let score = 50; // Base score

  try {
    // Check shared rooms
    const user1Rooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId1));

    const user2Rooms = await db
      .select({ roomId: roomMembers.roomId })
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId2));

    const sharedRooms = user1Rooms.filter(r1 => 
      user2Rooms.some(r2 => r2.roomId === r1.roomId)
    );

    if (sharedRooms.length > 0) {
      score += sharedRooms.length * 10;
      sharedInterests.push('same_rooms');
    }

    // Check study patterns similarity
    const user1Progress = await db
      .select({ topicId: userProgress.topicId })
      .from(userProgress)
      .where(eq(userProgress.userId, userId1))
      .groupBy(userProgress.topicId);

    const user2Progress = await db
      .select({ topicId: userProgress.topicId })
      .from(userProgress)
      .where(eq(userProgress.userId, userId2))
      .groupBy(userProgress.topicId);

    const sharedTopics = user1Progress.filter(p1 =>
      user2Progress.some(p2 => p2.topicId === p1.topicId)
    );

    if (sharedTopics.length > 3) {
      score += 15;
      sharedInterests.push('similar_study_subjects');
    }

    // Cap score at 100
    score = Math.min(100, score);

    return { matchScore: score, sharedInterests };
  } catch (error) {
    console.error('Error calculating match score:', error);
    return { matchScore: 50, sharedInterests: [] };
  }
}

// Count mutual friends
async function countMutualFriends(userId1: string, userId2: string): Promise<number> {
  try {
    // Get user1's friends
    const user1Friends = await db
      .select()
      .from(userFriends)
      .where(and(
        or(eq(userFriends.userId, userId1), eq(userFriends.friendId, userId1)),
        eq(userFriends.status, 'accepted')
      ));

    const user1FriendIds = user1Friends.map(f => 
      f.userId === userId1 ? f.friendId : f.userId
    );

    // Get user2's friends
    const user2Friends = await db
      .select()
      .from(userFriends)
      .where(and(
        or(eq(userFriends.userId, userId2), eq(userFriends.friendId, userId2)),
        eq(userFriends.status, 'accepted')
      ));

    const user2FriendIds = user2Friends.map(f => 
      f.userId === userId2 ? f.friendId : f.userId
    );

    // Count mutual
    const mutualFriends = user1FriendIds.filter(id => user2FriendIds.includes(id));
    return mutualFriends.length;
  } catch (error) {
    return 0;
  }
}
