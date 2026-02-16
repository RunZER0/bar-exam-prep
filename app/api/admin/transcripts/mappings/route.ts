/**
 * Admin API: Skill Mapping Approval
 * GET - List pending mappings
 * POST - Approve/reject mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPendingMappings,
  approveMapping,
  rejectMapping,
  batchApproveMappings 
} from '@/lib/services/transcript-ingestion';

// GET /api/admin/transcripts/mappings - List pending mappings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    
    const mappings = await getPendingMappings(limit);
    
    return NextResponse.json({
      success: true,
      mappings,
      pendingCount: mappings.length,
    });
  } catch (error) {
    console.error('Error getting pending mappings:', error);
    return NextResponse.json(
      { error: 'Failed to get pending mappings' },
      { status: 500 }
    );
  }
}

// POST /api/admin/transcripts/mappings - Approve/reject mappings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, mappingId, mappingIds, adminUserId } = body;
    
    if (!action) {
      return NextResponse.json(
        { error: 'Missing action: approve, reject, or batch_approve' },
        { status: 400 }
      );
    }
    
    switch (action) {
      case 'approve':
        if (!mappingId || !adminUserId) {
          return NextResponse.json(
            { error: 'Missing mappingId or adminUserId' },
            { status: 400 }
          );
        }
        await approveMapping(mappingId, adminUserId);
        return NextResponse.json({
          success: true,
          message: 'Mapping approved',
        });
        
      case 'reject':
        if (!mappingId) {
          return NextResponse.json(
            { error: 'Missing mappingId' },
            { status: 400 }
          );
        }
        await rejectMapping(mappingId);
        return NextResponse.json({
          success: true,
          message: 'Mapping rejected',
        });
        
      case 'batch_approve':
        if (!mappingIds || !Array.isArray(mappingIds) || !adminUserId) {
          return NextResponse.json(
            { error: 'Missing mappingIds array or adminUserId' },
            { status: 400 }
          );
        }
        const count = await batchApproveMappings(mappingIds, adminUserId);
        return NextResponse.json({
          success: true,
          message: `${count} mappings approved`,
          approvedCount: count,
        });
        
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: approve, reject, or batch_approve' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing mapping action:', error);
    return NextResponse.json(
      { error: 'Failed to process mapping action' },
      { status: 500 }
    );
  }
}
