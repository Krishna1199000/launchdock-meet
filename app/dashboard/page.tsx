'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/context/SocketContext';

interface User {
    id: string;
    name: string;
    email: string;
}

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    // Link generated when you create a new meeting (used only for sharing)
    const [createdMeetingLink, setCreatedMeetingLink] = useState('');
    // Raw input when joining a meeting (can be full URL or just ID)
    const [joinInput, setJoinInput] = useState('');
    const [copied, setCopied] = useState(false);
    const router = useRouter();
    const socket = useSocket();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/signin');
            return;
        }
        setUser(JSON.parse(userData));
    }, [router]);

    const generateMeetingId = (): string => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handleNewMeeting = () => {
        const meetingId = generateMeetingId();
        const link = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${meetingId}` : '';
        setCreatedMeetingLink(link);
        
        // Join the room immediately
        if (socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            router.push(`/meeting/${meetingId}`);
        }
    };

    const handleJoinMeeting = (e: React.FormEvent) => {
        e.preventDefault();
        const value = joinInput.trim();
        if (!value) return;

        const meetingId = value.includes('/') ? value.split('/').pop() : value;
        if (meetingId && socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            router.push(`/meeting/${meetingId}`);
        }
    };

    const handleCopyLink = () => {
        if (createdMeetingLink) {
            navigator.clipboard.writeText(createdMeetingLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleSignOut = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/');
    };

    if (!user) {
        return null;
    }

    return (
        <div className="page-fade-in" style={{ minHeight: '100vh', backgroundColor: '#020617', padding: '24px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '32px 0', 
                    marginBottom: '48px', 
                    color: 'rgb(248,250,252)',
                    borderBottom: '1px solid rgba(51,65,85,0.5)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background:
                                    'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.9), rgba(37,99,235,0.9))',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 24px rgba(56,189,248,0.3)',
                            }}
                        >
                            <span style={{ fontSize: 22 }}>🚀</span>
                        </div>
                        <div>
                            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>VideoDock</h1>
                            <span style={{ fontSize: '0.85rem', color: 'rgb(148,163,184)' }}>Dashboard</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                        <span style={{ fontSize: '1rem', color: 'rgb(226,232,240)' }}>Welcome, <span style={{ fontWeight: 600, color: 'rgb(56,189,248)' }}>{user.name}</span></span>
                        <button 
                            onClick={handleSignOut} 
                            style={{ 
                                padding: '10px 24px', 
                                fontSize: '0.9rem', 
                                fontWeight: 600, 
                                borderRadius: '999px', 
                                cursor: 'pointer', 
                                backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))', 
                                color: '#020617',
                                boxShadow: '0 8px 20px rgba(56,189,248,0.3)',
                                border: 'none',
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    {/* New Meeting Card */}
                    <div className="card-float" style={{ 
                        background: 'radial-gradient(circle at top, rgba(56,189,248,0.18), transparent 60%) #020617', 
                        borderRadius: '12px', 
                        padding: '30px', 
                        boxShadow: '0 24px 70px rgba(15,23,42,0.9)',
                        border: '1px solid rgba(51,65,85,0.9)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, color: 'rgb(248,250,252)' }}>Start a new meeting</h2>
                        <p style={{ color: 'rgb(148,163,184)', margin: 0, lineHeight: '1.6' }}>Create a new meeting and share the link with others</p>
                        <button 
                            onClick={handleNewMeeting} 
                            style={{ 
                                padding: '15px 30px', 
                                fontSize: '1rem', 
                                fontWeight: 600, 
                                border: 'none', 
                                borderRadius: '999px', 
                                cursor: 'pointer', 
                                backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))', 
                                color: '#020617',
                                marginTop: 'auto',
                                boxShadow: '0 12px 30px rgba(56,189,248,0.35)',
                            }}
                        >
                            New Meeting
                        </button>
                    </div>

                    {/* Join Meeting Card */}
                    <div className="card-float" style={{ 
                        background: 'radial-gradient(circle at top, rgba(129,140,248,0.22), transparent 60%) #020617', 
                        borderRadius: '12px', 
                        padding: '30px', 
                        boxShadow: '0 24px 70px rgba(15,23,42,0.9)',
                        border: '1px solid rgba(51,65,85,0.9)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0, color: 'rgb(248,250,252)' }}>Join a meeting</h2>
                        <p style={{ color: 'rgb(148,163,184)', margin: 0, lineHeight: '1.6' }}>Enter a meeting link or ID to join</p>
                        <form 
                            onSubmit={handleJoinMeeting} 
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '15px',
                                marginTop: 'auto'
                            }}
                        >
                            <input
                                type="text"
                                value={joinInput}
                                onChange={(e) => setJoinInput(e.target.value)}
                                placeholder="Paste meeting link or enter meeting ID"
                                style={{ 
                                    padding: '12px', 
                                    fontSize: '1rem', 
                                    border: '1px solid rgba(51,65,85,0.9)', 
                                    borderRadius: '10px',
                                    outline: 'none',
                                    transition: 'border-color 0.3s',
                                    backgroundColor: 'rgba(15,23,42,0.9)',
                                    color: 'rgb(226,232,240)',
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = 'rgb(56,189,248)'}
                                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(51,65,85,0.9)'}
                            />
                            <button 
                                type="submit" 
                                style={{ 
                                    padding: '15px 30px', 
                                    fontSize: '1rem', 
                                    fontWeight: 600, 
                                    border: 'none', 
                                    borderRadius: '999px', 
                                    cursor: 'pointer', 
                                    backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))', 
                                    color: '#020617',
                                    boxShadow: '0 12px 30px rgba(56,189,248,0.35)',
                                }}
                            >
                                Join
                            </button>
                        </form>
                    </div>

                    {/* Share Link Card */}
                    {createdMeetingLink && (
                        <div className="card-float" style={{ 
                            background: 'rgba(15,23,42,0.98)', 
                            borderRadius: '12px', 
                            padding: '30px', 
                            boxShadow: '0 24px 70px rgba(15,23,42,0.9)',
                            border: '1px solid rgba(51,65,85,0.9)',
                            gridColumn: '1 / -1'
                        }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 20px 0', color: 'rgb(248,250,252)' }}>Share this meeting link</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    value={createdMeetingLink}
                                    readOnly
                                    style={{ 
                                        flex: 1,
                                        padding: '12px', 
                                        fontSize: '1rem', 
                                    border: '1px solid rgba(51,65,85,0.9)', 
                                    borderRadius: '10px',
                                    backgroundColor: 'rgba(15,23,42,0.9)',
                                    color: 'rgb(226,232,240)'
                                    }}
                                />
                                <button 
                                    onClick={handleCopyLink} 
                                    style={{ 
                                        padding: '12px 30px', 
                                        fontSize: '1rem', 
                                        fontWeight: 600, 
                                        border: 'none', 
                                        borderRadius: '999px', 
                                        cursor: 'pointer', 
                                        backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))', 
                                        color: '#020617',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 8px 20px rgba(56,189,248,0.3)',
                                    }}
                                >
                                    {copied ? '✓ Copied!' : 'Copy Link'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
