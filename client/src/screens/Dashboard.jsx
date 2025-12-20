import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketProvider.tsx';
import './Dashboard.css';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [meetingLink, setMeetingLink] = useState('');
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();
    const socket = useSocket();

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            navigate('/signin');
            return;
        }
        setUser(JSON.parse(userData));
    }, [navigate]);

    const generateMeetingId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    const handleNewMeeting = () => {
        const meetingId = generateMeetingId();
        const link = `${window.location.origin}/meeting/${meetingId}`;
        setMeetingLink(link);
        
        // Join the room immediately
        if (socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            navigate(`/meeting/${meetingId}`);
        }
    };

    const handleJoinMeeting = (e) => {
        e.preventDefault();
        const meetingId = meetingLink.split('/').pop();
        if (meetingId && socket && user) {
            socket.emit('room:join', { email: user.email, room: meetingId, userId: user.id });
            navigate(`/meeting/${meetingId}`);
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
        navigate('/');
    };

    if (!user) {
        return null;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>VideoMeet</h1>
                <div className="dashboard-user">
                    <span>Welcome, {user.name}</span>
                    <button onClick={handleSignOut} className="signout-button">Sign Out</button>
                </div>
            </div>

            <div className="dashboard-content">
                <div className="dashboard-card">
                    <h2>Start a new meeting</h2>
                    <p>Create a new meeting and share the link with others</p>
                    <button onClick={handleNewMeeting} className="btn-new-meeting">
                        New Meeting
                    </button>
                </div>

                <div className="dashboard-card">
                    <h2>Join a meeting</h2>
                    <p>Enter a meeting link or ID to join</p>
                    <form onSubmit={handleJoinMeeting} className="join-form">
                        <input
                            type="text"
                            value={meetingLink}
                            onChange={(e) => setMeetingLink(e.target.value)}
                            placeholder="Paste meeting link or enter meeting ID"
                            className="join-input"
                        />
                        <button type="submit" className="btn-join">Join</button>
                    </form>
                </div>

                {meetingLink && (
                    <div className="dashboard-card share-card">
                        <h3>Share this meeting link</h3>
                        <div className="link-container">
                            <input
                                type="text"
                                value={meetingLink}
                                readOnly
                                className="link-input"
                            />
                            <button onClick={handleCopyLink} className="btn-copy">
                                {copied ? '✓ Copied!' : 'Copy Link'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;

