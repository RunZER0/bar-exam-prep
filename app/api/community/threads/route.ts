import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';

const sql = neon(process.env.DATABASE_URL!);

// GET - List threads with optional category filter
async function handleGet(req: NextRequest, user: AuthUser) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'recent'; // recent | top | hot
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let orderClause = 'ORDER BY t.is_pinned DESC, t.created_at DESC';
  if (sort === 'top') orderClause = 'ORDER BY t.is_pinned DESC, (t.upvotes - t.downvotes) DESC, t.created_at DESC';
  if (sort === 'hot') orderClause = 'ORDER BY t.is_pinned DESC, (t.upvotes - t.downvotes + t.reply_count * 2) DESC, t.created_at DESC';

  const categoryFilter = category !== 'all' ? `AND t.category = '${category}'` : '';

  const threads = await sql`
    SELECT t.*, 
           u.display_name as author_name, 
           u.photo_url as author_photo,
           u.community_username as author_username,
           (SELECT vote_type FROM thread_votes WHERE user_id = ${user.id} AND thread_id = t.id LIMIT 1) as user_vote
    FROM community_threads t
    JOIN users u ON u.id = t.author_id
    WHERE 1=1 ${category !== 'all' ? sql`AND t.category = ${category}` : sql``}
    ORDER BY t.is_pinned DESC, 
      CASE WHEN ${sort} = 'top' THEN (t.upvotes - t.downvotes) 
           WHEN ${sort} = 'hot' THEN (t.upvotes - t.downvotes + t.reply_count * 2)
           ELSE 0 END DESC,
      t.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return NextResponse.json({ threads, page, hasMore: threads.length === limit });
}

// POST - Create a new thread
async function handlePost(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { title, content, category = 'general', tags = [] } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  if (title.length > 200) {
    return NextResponse.json({ error: 'Title must be under 200 characters' }, { status: 400 });
  }

  const validCategories = ['general', 'memes', 'study-tips', 'case-discussion', 'exam-anxiety', 'career', 'resources', 'off-topic'];
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const [thread] = await sql`
    INSERT INTO community_threads (author_id, title, content, category, tags)
    VALUES (${user.id}, ${title.trim()}, ${content.trim()}, ${category}, ${tags})
    RETURNING *
  `;

  return NextResponse.json({ thread }, { status: 201 });
}

// PATCH - Vote on a thread
async function handlePatch(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { threadId, voteType } = body; // voteType: 'up' | 'down' | 'none'

  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
  }

  // Check existing vote
  const [existing] = await sql`
    SELECT id, vote_type FROM thread_votes WHERE user_id = ${user.id} AND thread_id = ${threadId}
  `;

  if (voteType === 'none' && existing) {
    // Remove vote
    await sql`DELETE FROM thread_votes WHERE id = ${existing.id}`;
    const col = existing.vote_type === 'up' ? 'upvotes' : 'downvotes';
    if (col === 'upvotes') {
      await sql`UPDATE community_threads SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = ${threadId}`;
    } else {
      await sql`UPDATE community_threads SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = ${threadId}`;
    }
  } else if (existing) {
    if (existing.vote_type === voteType) {
      return NextResponse.json({ ok: true }); // Already voted this way
    }
    // Change vote direction
    await sql`UPDATE thread_votes SET vote_type = ${voteType} WHERE id = ${existing.id}`;
    if (voteType === 'up') {
      await sql`UPDATE community_threads SET upvotes = upvotes + 1, downvotes = GREATEST(downvotes - 1, 0) WHERE id = ${threadId}`;
    } else {
      await sql`UPDATE community_threads SET downvotes = downvotes + 1, upvotes = GREATEST(upvotes - 1, 0) WHERE id = ${threadId}`;
    }
  } else if (voteType !== 'none') {
    // New vote
    await sql`INSERT INTO thread_votes (user_id, thread_id, vote_type) VALUES (${user.id}, ${threadId}, ${voteType})`;
    if (voteType === 'up') {
      await sql`UPDATE community_threads SET upvotes = upvotes + 1 WHERE id = ${threadId}`;
    } else {
      await sql`UPDATE community_threads SET downvotes = downvotes + 1 WHERE id = ${threadId}`;
    }
  }

  return NextResponse.json({ ok: true });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PATCH = withAuth(handlePatch);
