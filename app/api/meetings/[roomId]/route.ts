import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { roomId: string } }
) {
  try {
    const { roomId } = params;
    
    const meeting = await prisma.meeting.findUnique({
      where: { roomId },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });
    
    if (!meeting) {
      return NextResponse.json(
        { message: 'Meeting not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ meeting });
  } catch (error: any) {
    console.error('Error fetching meeting:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}
