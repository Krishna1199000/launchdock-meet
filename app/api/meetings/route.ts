import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { userId, roomId } = await request.json();
    
    if (!userId || !roomId) {
      return NextResponse.json(
        { message: 'userId and roomId are required' },
        { status: 400 }
      );
    }
    
    const meeting = await prisma.meeting.upsert({
      where: { roomId },
      update: {},
      create: {
        roomId,
        hostId: userId
      },
      include: {
        host: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    return NextResponse.json({ meeting });
  } catch (error: any) {
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}

