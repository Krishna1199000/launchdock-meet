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
    const [meetingLink, setMeetingLink] = useState('');
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
        setMeetingLink(link);
        
        // Join the room immediately
        if (socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            router.push(`/meeting/${meetingId}`);
        }
    };

    const handleJoinMeeting = (e: React.FormEvent) => {
        e.preventDefault();
        const meetingId = meetingLink.split('/').pop();
        if (meetingId && socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            router.push(`/meeting/${meetingId}`);
        }
    };

    const handleCopyLink = () => {
        if (meetingLink) {
            navigator.clipboard.writeText(meetingLink);
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
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', marginBottom: '40px', color: 'white' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>VideoMeet</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{ fontSize: '1rem' }}>Welcome, {user.name}</span>
                        <button 
                            onClick={handleSignOut} 
                            style={{ 
                                padding: '10px 20px', 
                                fontSize: '0.9rem', 
                                fontWeight: 600, 
                                border: '2px solid white', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                backgroundColor: 'transparent', 
                                color: 'white',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.color = '#667eea';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'white';
                            }}
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    {/* New Meeting Card */}
                    <div style={{ 
                        background: 'white', 
                        borderRadius: '12px', 
                        padding: '30px', 
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#333' }}>Start a new meeting</h2>
                        <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>Create a new meeting and share the link with others</p>
                        <button 
                            onClick={handleNewMeeting} 
                            style={{ 
                                padding: '15px 30px', 
                                fontSize: '1rem', 
                                fontWeight: 600, 
                                border: 'none', 
                                borderRadius: '8px', 
                                cursor: 'pointer', 
                                backgroundColor: '#667eea', 
                                color: 'white',
                                transition: 'background-color 0.3s',
                                marginTop: 'auto'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5568d3'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
                        >
                            New Meeting
                        </button>
                    </div>

                    {/* Join Meeting Card */}
                    <div style={{ 
                        background: 'white', 
                        borderRadius: '12px', 
                        padding: '30px', 
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px'
                    }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: '#333' }}>Join a meeting</h2>
                        <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>Enter a meeting link or ID to join</p>
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
                                value={meetingLink}
                                onChange={(e) => setMeetingLink(e.target.value)}
                                placeholder="Paste meeting link or enter meeting ID"
                                style={{ 
                                    padding: '12px', 
                                    fontSize: '1rem', 
                                    border: '2px solid #e0e0e0', 
                                    borderRadius: '8px',
                                    outline: 'none',
                                    transition: 'border-color 0.3s'
                                }}
                                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
                            />
                            <button 
                                type="submit" 
                                style={{ 
                                    padding: '15px 30px', 
                                    fontSize: '1rem', 
                                    fontWeight: 600, 
                                    border: 'none', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer', 
                                    backgroundColor: '#764ba2', 
                                    color: 'white',
                                    transition: 'background-color 0.3s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5d3a7a'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#764ba2'}
                            >
                                Join
                            </button>
                        </form>
                    </div>

                    {/* Share Link Card */}
                    {meetingLink && (
                        <div style={{ 
                            background: 'white', 
                            borderRadius: '12px', 
                            padding: '30px', 
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                            gridColumn: '1 / -1'
                        }}>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: 600, margin: '0 0 20px 0', color: '#333' }}>Share this meeting link</h3>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="text"
                                    value={meetingLink}
                                    readOnly
                                    style={{ 
                                        flex: 1,
                                        padding: '12px', 
                                        fontSize: '1rem', 
                                        border: '2px solid #e0e0e0', 
                                        borderRadius: '8px',
                                        backgroundColor: '#f5f5f5',
                                        color: '#333'
                                    }}
                                />
                                <button 
                                    onClick={handleCopyLink} 
                                    style={{ 
                                        padding: '12px 30px', 
                                        fontSize: '1rem', 
                                        fontWeight: 600, 
                                        border: 'none', 
                                        borderRadius: '8px', 
                                        cursor: 'pointer', 
                                        backgroundColor: copied ? '#4caf50' : '#667eea', 
                                        color: 'white',
                                        transition: 'background-color 0.3s',
                                        whiteSpace: 'nowrap'
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
