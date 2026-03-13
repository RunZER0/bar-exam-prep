import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { withAuth, type AuthUser } from '@/lib/auth/middleware';

const sql = neon(process.env.DATABASE_URL!);

// GET - Fetch replies for a thread
async function handleGet(req: NextRequest, user: AuthUser) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) {
    return NextResponse.json({ error: 'threadId required' }, { status: 400 });
  }

  const rawReplies = await sql`
    SELECT r.*, 
           u.display_name as author_name,
           u.photo_url as author_photo,
           u.community_username as author_username,
           (SELECT vote_type FROM thread_votes WHERE user_id = ${user.id} AND reply_id = r.id LIMIT 1) as user_vote
    FROM thread_replies r
    JOIN users u ON u.id = r.author_id
    WHERE r.thread_id = ${threadId}
    ORDER BY r.created_at ASC
  `;

  const replies = rawReplies.map((r: any) => {
    const createdAtMs = new Date(r.created_at).getTime();
    const withinEditWindow = Date.now() - createdAtMs <= 15 * 60 * 1000;
    const isMine = r.author_id === user.id;
    const isDeleted = r.content === '[deleted]';

    return {
      id: r.id,
      threadId: r.thread_id,
      authorId: r.author_id,
      authorName: r.author_username || r.author_name || 'Anonymous',
      authorPhoto: r.author_photo,
      parentReplyId: r.parent_reply_id,
      content: r.content,
      upvotes: r.upvotes || 0,
      downvotes: r.downvotes || 0,
      isAgentReply: r.is_agent_reply || false,
      userVote: r.user_vote || null,
      createdAt: r.created_at,
      isDeleted,
      canEdit: isMine && !isDeleted && withinEditWindow,
      canDelete: isMine && !isDeleted,
    };
  });

  return NextResponse.json({ replies });
}

// POST - Create a reply
async function handlePost(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { threadId, content, parentReplyId } = body;

  if (!threadId || !content?.trim()) {
    return NextResponse.json({ error: 'Thread ID and content required' }, { status: 400 });
  }

  const [rawReply] = await sql`
    INSERT INTO thread_replies (thread_id, author_id, parent_reply_id, content)
    VALUES (${threadId}, ${user.id}, ${parentReplyId || null}, ${content.trim()})
    RETURNING *
  `;

  // Increment reply count
  await sql`UPDATE community_threads SET reply_count = reply_count + 1 WHERE id = ${threadId}`;

  // Get the user's username for the response
  const [u] = await sql`SELECT display_name, community_username FROM users WHERE id = ${user.id}`;

  const reply = {
    id: rawReply.id,
    threadId: rawReply.thread_id,
    authorId: rawReply.author_id,
    authorName: u?.community_username || u?.display_name || 'Anonymous',
    authorPhoto: null,
    parentReplyId: rawReply.parent_reply_id,
    content: rawReply.content,
    upvotes: 0,
    downvotes: 0,
    isAgentReply: false,
    userVote: null,
    createdAt: rawReply.created_at,
    isDeleted: false,
    canEdit: true,
    canDelete: true,
  };

  return NextResponse.json({ reply }, { status: 201 });
}

// PATCH - Vote on a reply
async function handlePatch(req: NextRequest, user: AuthUser) {
  const body = await req.json();
  const { replyId, voteType, vote, action, content } = body;
  const effectiveVote = voteType || vote;

  if (!replyId) {
    return NextResponse.json({ error: 'Reply ID required' }, { status: 400 });
  }

  if (action === 'edit') {
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    const [targetReply] = await sql`
      SELECT id, author_id, created_at, content
      FROM thread_replies
      WHERE id = ${replyId}
      LIMIT 1
    `;

    if (!targetReply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    if (targetReply.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const createdAtMs = new Date(targetReply.created_at).getTime();
    if (Date.now() - createdAtMs > 15 * 60 * 1000) {
      return NextResponse.json({ error: 'Edit window expired (15 minutes)' }, { status: 400 });
    }

    if (targetReply.content === '[deleted]') {
      return NextResponse.json({ error: 'Deleted replies cannot be edited' }, { status: 400 });
    }

    const [updated] = await sql`
      UPDATE thread_replies
      SET content = ${content.trim()}
      WHERE id = ${replyId}
      RETURNING id, content, created_at
    `;

    const canEdit = Date.now() - new Date(updated.created_at).getTime() <= 15 * 60 * 1000;
    return NextResponse.json({
      ok: true,
      reply: {
        id: updated.id,
        content: updated.content,
        canEdit,
      },
    });
  }

  if (action === 'delete') {
    const [targetReply] = await sql`
      SELECT id, author_id, content
      FROM thread_replies
      WHERE id = ${replyId}
      LIMIT 1
    `;

    if (!targetReply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    if (targetReply.author_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (targetReply.content === '[deleted]') {
      return NextResponse.json({ ok: true });
    }

    await sql`
      UPDATE thread_replies
      SET content = '[deleted]'
      WHERE id = ${replyId}
    `;

    return NextResponse.json({ ok: true });
  }

  const [existing] = await sql`
    SELECT id, vote_type FROM thread_votes WHERE user_id = ${user.id} AND reply_id = ${replyId}
  `;

  if (effectiveVote === 'none' && existing) {
    await sql`DELETE FROM thread_votes WHERE id = ${existing.id}`;
    if (existing.vote_type === 'up') {
      await sql`UPDATE thread_replies SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = ${replyId}`;
    } else {
      await sql`UPDATE thread_replies SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = ${replyId}`;
    }
  } else if (existing) {
    if (existing.vote_type === effectiveVote) return NextResponse.json({ ok: true });
    await sql`UPDATE thread_votes SET vote_type = ${effectiveVote} WHERE id = ${existing.id}`;
    if (effectiveVote === 'up') {
      await sql`UPDATE thread_replies SET upvotes = upvotes + 1, downvotes = GREATEST(downvotes - 1, 0) WHERE id = ${replyId}`;
    } else {
      await sql`UPDATE thread_replies SET downvotes = downvotes + 1, upvotes = GREATEST(upvotes - 1, 0) WHERE id = ${replyId}`;
    }
  } else if (effectiveVote !== 'none') {
    await sql`INSERT INTO thread_votes (user_id, reply_id, vote_type) VALUES (${user.id}, ${replyId}, ${effectiveVote})`;
    if (effectiveVote === 'up') {
      await sql`UPDATE thread_replies SET upvotes = upvotes + 1 WHERE id = ${replyId}`;
    } else {
      await sql`UPDATE thread_replies SET downvotes = downvotes + 1 WHERE id = ${replyId}`;
    }
  }

  return NextResponse.json({ ok: true });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
export const PATCH = withAuth(handlePatch);
