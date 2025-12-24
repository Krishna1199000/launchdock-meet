'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '@/lib/context/SocketContext';
import peerService from '@/lib/services/peer';

interface User {
    id: string;
    name: string;
    email: string;
}

interface RemoteUser {
    email: string;
    id: string;
    name: string;
    isHost?: boolean;
}

export default function MeetingRoom() {
    const router = useRouter();
    const params = useParams();
    const socket = useSocket();
    const roomId = params?.roomId as string;
    const [user, setUser] = useState<User | null>(null);
    const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
    const [muted, setMuted] = useState(false);
    const [videoOff, setVideoOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [currentTime, setCurrentTime] = useState<string>('');
    const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
    const [showChatPanel, setShowChatPanel] = useState(false);
    const [captionsEnabled, setCaptionsEnabled] = useState(false);
    const [chatMessages, setChatMessages] = useState<
        { name: string; text: string; createdAt: string }
    >([]);
    const [chatInput, setChatInput] = useState('');
    const [handRaised, setHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState<Record<string, boolean>>({});
    const [recentReactions, setRecentReactions] = useState<
        { name: string; emoji: string; createdAt: string }[]
    >([]);
    const [waitingForApproval, setWaitingForApproval] = useState(false);
    const [joinRequests, setJoinRequests] = useState<
        { socketId: string; userId: string; name: string }[]
    >([]);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null); // stream sent to peers
    const remoteStreamRef = useRef<MediaStream | null>(null);
    const cameraPreviewStreamRef = useRef<MediaStream | null>(null); // local camera preview
    const screenStreamRef = useRef<MediaStream | null>(null); // active screen share stream
    const [localPinnedWhenScreen, setLocalPinnedWhenScreen] = useState(false);
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

    useEffect(() => {
        if (!roomId || !socket) return;
        
        const userData = localStorage.getItem('user');
        if (!userData) {
            router.push('/signin');
            return;
        }
        
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Get user media
        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((stream) => {
                // Keep a dedicated stream for local camera preview
                cameraPreviewStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = cameraPreviewStreamRef.current;
                }

                // Clone tracks into a separate stream used for WebRTC sending
                localStreamRef.current = new MediaStream(stream.getTracks());

                // Join room
                socket.emit('room:join', {
                    email: parsedUser.email,
                    room: roomId,
                    userId: parsedUser.id,
                    name: parsedUser.name,
                });
            })
            .catch((error) => {
                console.error('Error accessing media devices:', error);
            });

        // Handle user joined - defined inside useEffect to avoid dependency issues
        const handleUserJoined = async (remoteUser: RemoteUser) => {
            if (!socket || !localStreamRef.current) return;

            const peerConnection = peerService.createPeerConnection();
            peersRef.current.set(remoteUser.id, peerConnection);

            // Add local stream tracks
            localStreamRef.current.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStreamRef.current!);
            });

            // Handle remote stream
            peerConnection.ontrack = (event) => {
                remoteStreamRef.current = event.streams[0];
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
            };

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice:candidate', {
                        to: remoteUser.id,
                        candidate: event.candidate
                    });
                }
            };

            // Create and send offer
            const offer = await peerService.getOffer();
            if (offer) {
                socket.emit('user:call', { to: remoteUser.id, offer });
            }
        };

        // Socket event handlers
        socket.on('user:already:in:room', (data: RemoteUser) => {
            // Ignore our own socket; only track true remote participants
            if (data.id === socket.id) return;
            setRemoteUsers((prev) => [...prev.filter((u) => u.id !== data.id), data]);
            handleUserJoined(data);
        });

        socket.on('user:joined', (data: RemoteUser) => {
            // When we create a meeting, the server also emits user:joined back to us.
            // Ignore that so we don't treat ourselves as a remote user.
            if (data.id === socket.id) return;
            setRemoteUsers((prev) => [...prev.filter((u) => u.id !== data.id), data]);
            handleUserJoined(data);
        });

        socket.on('user:left', (data: { id: string }) => {
            setRemoteUsers((prev) => prev.filter(u => u.id !== data.id));
            if (peersRef.current.has(data.id)) {
                peersRef.current.get(data.id)?.close();
                peersRef.current.delete(data.id);
            }
        });

        socket.on('incomming:call', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
            const peerConnection = peerService.createPeerConnection();
            peersRef.current.set(from, peerConnection);

            // Add local stream tracks
            localStreamRef.current?.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStreamRef.current!);
            });

            // Handle remote stream
            peerConnection.ontrack = (event) => {
                remoteStreamRef.current = event.streams[0];
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStreamRef.current;
                }
            };

            const ans = await peerService.getAnswer(offer);
            if (ans) {
                socket.emit('call:accepted', { to: from, ans });
            }
        });

        socket.on(
            'call:accepted',
            async ({ from, ans }: { from: string; ans: RTCSessionDescriptionInit }) => {
                await peerService.applyRemoteAnswer(ans);
            },
        );

        socket.on('ice:candidate', ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
            const peerConnection = peersRef.current.get(from);
            if (peerConnection && candidate) {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        socket.on('audio:status', ({ muted: remoteMuted }: { muted: boolean }) => {
            // Handle remote audio status
        });

        socket.on('video:status', ({ videoOff: remoteVideoOff }: { videoOff: boolean }) => {
            // Handle remote video status
        });

        socket.on('user:kicked', () => {
            router.push('/dashboard');
        });

        socket.on('room:join:waiting', () => {
            setWaitingForApproval(true);
        });

        socket.on('room:join:denied', (payload: { message?: string }) => {
            setWaitingForApproval(false);
            alert(payload?.message || 'You were not allowed to join this meeting.');
            router.push('/dashboard');
        });

        socket.on(
            'room:join:request',
            (payload: { socketId: string; userId: string; name: string }) => {
                setJoinRequests((prev) => {
                    // avoid duplicates
                    if (prev.some((r) => r.socketId === payload.socketId)) return prev;
                    return [...prev, payload];
                });
            },
        );

        socket.on('chat:message', (msg: { name: string; text: string; createdAt: string }) => {
            setChatMessages((prev) => [...prev, msg]);
        });

        socket.on(
            'reaction:emoji',
            (msg: { name: string; emoji: string; createdAt: string }) => {
                setRecentReactions((prev) => [...prev.slice(-4), msg]);
            },
        );

        socket.on(
            'hand:raise',
            (payload: { socketId: string; isRaised: boolean; name?: string }) => {
                setRaisedHands((prev) => ({
                    ...prev,
                    [payload.socketId]: payload.isRaised,
                }));
            },
        );

        // Cleanup
        return () => {
            localStreamRef.current?.getTracks().forEach(track => track.stop());
            // Capture peersRef.current in a variable for cleanup
            const peers = peersRef.current;
            peers.forEach(peer => peer.close());
            peers.clear();
            socket.off('user:already:in:room');
            socket.off('user:joined');
            socket.off('user:left');
            socket.off('incomming:call');
            socket.off('call:accepted');
            socket.off('ice:candidate');
            socket.off('audio:status');
            socket.off('video:status');
            socket.off('user:kicked');
            socket.off('chat:message');
            socket.off('reaction:emoji');
            socket.off('hand:raise');
            socket.off('room:join:waiting');
            socket.off('room:join:denied');
            socket.off('room:join:request');
        };
    }, [roomId, socket, router]);

    // Update clock in footer
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                }),
            );
        };

        updateTime();
        const interval = setInterval(updateTime, 30_000);
        return () => clearInterval(interval);
    }, []);

    // Attach screen stream to preview video once sharing is enabled and element is mounted
    useEffect(() => {
        if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
            screenVideoRef.current.srcObject = screenStreamRef.current;
        }
    }, [isScreenSharing]);

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = muted;
            });
            setMuted(!muted);
            // Notify others
            remoteUsers.forEach(user => {
                socket?.emit('audio:status', { to: user.id, muted: !muted });
            });
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = videoOff;
            });
            setVideoOff(!videoOff);
            // Notify others
            remoteUsers.forEach(user => {
                socket?.emit('video:status', { to: user.id, videoOff: !videoOff });
            });
        }
    };

    const handleLeave = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        peersRef.current.forEach(peer => peer.close());
        router.push('/dashboard');
    };

    const toggleScreenShare = async () => {
        if (!localStreamRef.current) return;

        if (!isScreenSharing) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true,
                });
                const videoTrack = screenStream.getVideoTracks()[0];
                const audioTrack = screenStream.getAudioTracks()[0];

                // Save for preview tile
                screenStreamRef.current = screenStream;

                // Replace outgoing video track with screen track for peers
                if (localStreamRef.current) {
                    // Remove existing video/audio tracks
                    localStreamRef.current.getTracks().forEach((track) => {
                        if (track.kind === 'video' || track.kind === 'audio') {
                            localStreamRef.current!.removeTrack(track);
                        }
                    });

                    // Add screen video (and audio, if available)
                    localStreamRef.current.addTrack(videoTrack);
                    if (audioTrack) {
                        localStreamRef.current.addTrack(audioTrack);
                    }
                }

                peersRef.current.forEach((peer) => {
                    const videoSender = peer
                        .getSenders()
                        .find((s) => s.track && s.track.kind === 'video');
                    if (videoSender) {
                        videoSender.replaceTrack(videoTrack);
                    }

                    if (audioTrack) {
                        const audioSender = peer
                            .getSenders()
                            .find((s) => s.track && s.track.kind === 'audio');
                        if (audioSender) {
                            audioSender.replaceTrack(audioTrack);
                        }
                    }
                });

                videoTrack.onended = () => {
                    toggleScreenShare();
                };

                setIsScreenSharing(true);
            } catch (error) {
                console.error('Error sharing screen:', error);
            }
        } else {
            // Stop screen preview
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
                screenStreamRef.current = null;
            }
            if (screenVideoRef.current) {
                screenVideoRef.current.srcObject = null;
            }

            // Restore camera video track for peers from preview stream
            const cameraStream = cameraPreviewStreamRef.current;
            if (cameraStream && localStreamRef.current) {
                const cameraTrack = cameraStream.getVideoTracks()[0];
                const micTrack = cameraStream.getAudioTracks()[0];

                // Remove existing screen video/audio tracks
                localStreamRef.current.getTracks().forEach((track) => {
                    if (track.kind === 'video' || track.kind === 'audio') {
                        localStreamRef.current!.removeTrack(track);
                    }
                });

                if (cameraTrack) {
                    localStreamRef.current.addTrack(cameraTrack);
                }
                if (micTrack) {
                    localStreamRef.current.addTrack(micTrack);
                }

                peersRef.current.forEach((peer) => {
                    const videoSender = peer
                        .getSenders()
                        .find((s) => s.track && s.track.kind === 'video');
                    if (videoSender && cameraTrack) {
                        videoSender.replaceTrack(cameraTrack);
                    }

                    const audioSender = peer
                        .getSenders()
                        .find((s) => s.track && s.track.kind === 'audio');
                    if (audioSender && micTrack) {
                        audioSender.replaceTrack(micTrack);
                    }
                });
            }

            setIsScreenSharing(false);
        }
    };

    if (!roomId || !user) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: 'white' }}>
                Loading...
            </div>
        );
    }

    const isAloneInCall = remoteUsers.length === 0;
    const localAsOverlay = isScreenSharing && !localPinnedWhenScreen;

    const getDisplayName = (u: { name?: string; email?: string } | null | undefined) => {
        if (!u) return 'Guest';
        if (u.name && u.name.trim()) return u.name;
        if (u.email) return u.email.split('@')[0];
        return 'Guest';
    };

    const participants = [
        user && {
            id: 'self',
            name: getDisplayName(user),
            email: user.email,
            isSelf: true,
        },
        ...remoteUsers.map((u) => ({
            id: u.id,
            name: getDisplayName(u),
            email: u.email,
            isSelf: false,
        })),
    ].filter(Boolean) as { id: string; name: string; email: string; isSelf: boolean }[];

    const handleSendChat = (e: React.FormEvent) => {
        e.preventDefault();
        const text = chatInput.trim();
        if (!text || !socket || !user) return;
        socket.emit('chat:message', {
            room: roomId,
            name: getDisplayName(user),
            text,
        });
        setChatInput('');
    };

    const handleEmojiReaction = () => {
        if (!socket || !user) return;
        socket.emit('reaction:emoji', {
            room: roomId,
            name: getDisplayName(user),
            emoji: '🙂',
        });
    };

    const handleToggleHand = () => {
        if (!socket) return;
        const next = !handRaised;
        setHandRaised(next);
        socket.emit('hand:raise', {
            room: roomId,
            socketId: socket.id,
            isRaised: next,
            name: getDisplayName(user || undefined),
        });
    };

    return (
        <div
            className="page-fade-in"
            style={{
                height: '100vh',
                background: '#020617',
                color: 'rgb(226,232,240)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(30,64,175,0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'radial-gradient(circle at top, rgba(56,189,248,0.14), transparent 60%) rgba(15,23,42,0.95)' }}>
                <h1 style={{ margin: 0, fontSize: '1.3rem', color: 'rgb(248,250,252)' }}>Meeting Room: {roomId}</h1>
                <button 
                    onClick={handleLeave}
                    style={{
                        padding: '10px 20px',
                        backgroundImage: 'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))',
                        color: '#020617',
                        border: 'none',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        boxShadow: '0 8px 20px rgba(56,189,248,0.3)',
                    }}
                >
                    Leave Meeting
                </button>
            </div>

            {/* Video Container */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    gap: '20px',
                    padding: '12px 20px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Waiting overlay when non-host is requesting access */}
                {waitingForApproval && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20,
                        }}
                    >
                        <div
                            style={{
                                padding: '24px 32px',
                                borderRadius: 16,
                                border: '1px solid rgba(51,65,85,0.9)',
                                backgroundColor: 'rgba(15,23,42,1)',
                                textAlign: 'center',
                            }}
                        >
                            <p style={{ fontSize: '1rem', marginBottom: 4 }}>
                                Waiting for host to let you in…
                            </p>
                            <p style={{ fontSize: '0.85rem', color: 'rgb(148,163,184)' }}>
                                If the host declines 3 times, you won&apos;t be able to join this
                                meeting again.
                            </p>
                        </div>
                    </div>
                )}
                {/* Participants side panel (left) */}
                {showParticipantsPanel && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: 0,
                            width: 280,
                            backgroundColor: 'rgba(15,23,42,0.98)',
                            borderRight: '1px solid rgba(30,64,175,0.7)',
                            padding: '16px 16px 80px',
                            overflowY: 'auto',
                            zIndex: 10,
                        }}
                    >
                        <div>
                            <h2
                                style={{
                                    fontSize: '1rem',
                                    marginBottom: 12,
                                    fontWeight: 600,
                                }}
                            >
                                People ({participants.length})
                            </h2>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            borderBottom: '1px solid rgba(51,65,85,0.9)',
                                        }}
                                    >
                                        <th
                                            style={{
                                                textAlign: 'left',
                                                paddingBottom: 8,
                                                color: 'rgb(148,163,184)',
                                            }}
                                        >
                                            Name
                                        </th>
                                        <th
                                            style={{
                                                textAlign: 'left',
                                                paddingBottom: 8,
                                                color: 'rgb(148,163,184)',
                                            }}
                                        >
                                            Hand
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participants.map((p) => (
                                        <tr key={p.id}>
                                            <td
                                                style={{
                                                    padding: '6px 0',
                                                }}
                                            >
                                                {p.name}
                                                {p.isSelf && (
                                                    <span
                                                        style={{
                                                            marginLeft: 6,
                                                            fontSize: '0.7rem',
                                                            color: 'rgb(148,163,184)',
                                                        }}
                                                    >
                                                        (You)
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '6px 0',
                                                }}
                                            >
                                                {raisedHands[p.id] && '✋'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Chat side panel (right) */}
                {showChatPanel && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: 320,
                            backgroundColor: 'rgba(15,23,42,0.98)',
                            borderLeft: '1px solid rgba(30,64,175,0.7)',
                            padding: '16px 16px 80px',
                            overflowY: 'auto',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <h2
                            style={{
                                fontSize: '1rem',
                                marginBottom: 4,
                                fontWeight: 600,
                            }}
                        >
                            In-call messages
                        </h2>
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                border: '1px solid rgba(51,65,85,0.9)',
                                borderRadius: 8,
                                padding: 8,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                backgroundColor: 'rgba(15,23,42,0.9)',
                            }}
                        >
                            {chatMessages.map((m, idx) => (
                                <div key={idx}>
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            fontSize: '0.8rem',
                                        }}
                                    >
                                        {m.name}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.7rem',
                                            color: 'rgb(148,163,184)',
                                            marginLeft: 6,
                                        }}
                                    >
                                        {new Date(m.createdAt).toLocaleTimeString([], {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    <div
                                        style={{
                                            fontSize: '0.85rem',
                                        }}
                                    >
                                        {m.text}
                                    </div>
                                </div>
                            ))}
                            {chatMessages.length === 0 && (
                                <div
                                    style={{
                                        fontSize: '0.85rem',
                                        color: 'rgb(148,163,184)',
                                    }}
                                >
                                    No messages yet.
                                </div>
                            )}
                        </div>
                        <form
                            onSubmit={handleSendChat}
                            style={{
                                display: 'flex',
                                gap: 8,
                                marginTop: 8,
                            }}
                        >
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Send a message to everyone"
                                style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(51,65,85,0.9)',
                                    fontSize: '0.9rem',
                                    backgroundColor: 'rgba(15,23,42,0.95)',
                                    color: 'rgb(226,232,240)',
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: 999,
                                    border: 'none',
                                    cursor: 'pointer',
                                    backgroundImage:
                                        'linear-gradient(135deg, rgb(56,189,248), rgb(59,130,246))',
                                    color: '#020617',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                }}
                            >
                                Send
                            </button>
                        </form>
                    </div>
                )}

                {/* Reactions overlay */}
                {recentReactions.length > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 5,
                        }}
                    >
                        {recentReactions.map((r, idx) => (
                            <div
                                key={`${r.createdAt}-${idx}`}
                                style={{
                                    padding: '4px 8px',
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(15,23,42,0.85)',
                                    fontSize: '0.9rem',
                                }}
                            >
                                <span style={{ marginRight: 4 }}>{r.emoji}</span>
                                <span
                                    style={{
                                        fontSize: '0.8rem',
                                        color: 'rgb(148,163,184)',
                                    }}
                                >
                                    {r.name}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Live captions overlay (uses latest chat message when captionsEnabled) */}
                {captionsEnabled && chatMessages.length > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 80,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            maxWidth: '70%',
                            padding: '8px 16px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            border: '1px solid rgba(51,65,85,0.9)',
                            fontSize: '0.95rem',
                            textAlign: 'center',
                        }}
                    >
                        {chatMessages[chatMessages.length - 1].text}
                    </div>
                )}

                {/* Host-only join requests panel */}
                {joinRequests.length > 0 && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 16,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 15,
                            backgroundColor: 'rgba(15,23,42,0.98)',
                            borderRadius: 16,
                            border: '1px solid rgba(51,65,85,0.9)',
                            padding: '12px 16px',
                            minWidth: 260,
                        }}
                    >
                        <h3
                            style={{
                                fontSize: '0.95rem',
                                marginBottom: 8,
                            }}
                        >
                            Waiting to join
                        </h3>
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                maxHeight: 200,
                                overflowY: 'auto',
                            }}
                        >
                            {joinRequests.map((req) => (
                                <div
                                    key={req.socketId}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    <span>{req.name}</span>
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 6,
                                        }}
                                    >
                                        <button
                                            onClick={() => {
                                                if (!socket || !user) return;
                                                socket.emit('room:join:decision', {
                                                    room: roomId,
                                                    requesterSocketId: req.socketId,
                                                    userId: req.userId,
                                                    allow: true,
                                                    name: req.name,
                                                });
                                                setJoinRequests((prev) =>
                                                    prev.filter((r) => r.socketId !== req.socketId),
                                                );
                                            }}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: 'rgb(34,197,94)',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Admit
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!socket || !user) return;
                                                socket.emit('room:join:decision', {
                                                    room: roomId,
                                                    requesterSocketId: req.socketId,
                                                    userId: req.userId,
                                                    allow: false,
                                                    name: req.name,
                                                });
                                                setJoinRequests((prev) =>
                                                    prev.filter((r) => r.socketId !== req.socketId),
                                                );
                                            }}
                                            style={{
                                                padding: '4px 10px',
                                                borderRadius: 999,
                                                border: 'none',
                                                cursor: 'pointer',
                                                backgroundColor: 'rgb(239,68,68)',
                                                color: 'white',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                            }}
                                        >
                                            Deny
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* Screen share tile (when you are sharing your screen) */}
                {isScreenSharing && (
                    <div
                        style={{
                            flex: 1,
                            position: 'relative',
                            background: '#020617',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            border: '1px solid rgba(30,64,175,0.6)',
                            boxShadow: '0 24px 80px rgba(15,23,42,0.9)',
                        }}
                    >
                        <video
                            ref={screenVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div
                            style={{
                                position: 'absolute',
                                bottom: 12,
                                left: 12,
                                padding: '6px 12px',
                                borderRadius: 999,
                                backgroundColor: 'rgba(15,23,42,0.8)',
                                fontSize: '0.85rem',
                                color: 'rgb(226,232,240)',
                            }}
                        >
                            Your screen
                        </div>
                    </div>
                )}

                {/* Remote Video - only show when at least one other user is in the room and you're not sharing */}
                {!isScreenSharing && !isAloneInCall && (
                    <div
                        style={{
                            flex: 1,
                            position: 'relative',
                            background: '#020617',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            border: '1px solid rgba(30,64,175,0.6)',
                            boxShadow: '0 24px 80px rgba(15,23,42,0.9)',
                        }}
                    >
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {remoteUsers[0] && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: 12,
                                    left: 12,
                                    padding: '6px 12px',
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(15,23,42,0.8)',
                                    fontSize: '0.85rem',
                                    color: 'rgb(226,232,240)',
                                }}
                            >
                                {getDisplayName(remoteUsers[0])}
                            </div>
                        )}
                    </div>
                )}

                {/* Local Video (click to pin/unpin when sharing) */}
                <div
                    style={{
                        width: localAsOverlay
                            ? 260
                            : isAloneInCall && !isScreenSharing
                            ? '100%'
                            : '300px',
                        maxWidth: isScreenSharing
                            ? 260
                            : isAloneInCall && !isScreenSharing
                            ? '100%'
                            : '300px',
                        height: localAsOverlay ? 150 : undefined,
                        position: localAsOverlay ? 'absolute' : 'relative',
                        bottom: localAsOverlay ? 24 : undefined,
                        right: localAsOverlay ? 24 : undefined,
                        background: '#020617',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        border: '1px solid rgba(30,64,175,0.6)',
                        boxShadow: '0 24px 80px rgba(15,23,42,0.9)',
                        flex: isAloneInCall && !isScreenSharing ? 1 : 'initial',
                        zIndex: localAsOverlay ? 6 : 1,
                    }}
                    onClick={() => {
                        if (isScreenSharing) {
                            setLocalPinnedWhenScreen((prev) => !prev);
                        }
                    }}
                >
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: videoOff ? 0 : 1,
                            transition: 'opacity 0.2s ease',
                        }}
                    />
                    {videoOff && (
                        <div
                            style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background:
                                    'radial-gradient(circle at top, rgba(15,23,42,0.95), rgba(15,23,42,0.98))',
                                gap: 8,
                            }}
                        >
                            <div
                                style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '999px',
                                    backgroundImage:
                                        'linear-gradient(135deg, rgb(56,189,248), rgb(129,140,248))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: 700,
                                    color: '#020617',
                                }}
                            >
                                {getDisplayName(user || undefined).charAt(0).toUpperCase()}
                            </div>
                            <span
                                style={{
                                    fontSize: '0.95rem',
                                    color: 'rgb(226,232,240)',
                                    fontWeight: 500,
                                }}
                            >
                                {getDisplayName(user || undefined)}
                            </span>
                        </div>
                    )}
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 10,
                            left: 10,
                            padding: '4px 10px',
                            borderRadius: 999,
                            backgroundColor: 'rgba(15,23,42,0.85)',
                            fontSize: '0.8rem',
                            color: 'rgb(226,232,240)',
                        }}
                        >
                        {getDisplayName(user || undefined)}
                    </div>
                    <div
                        style={{
                            position: 'absolute',
                            bottom: 10,
                            right: 10,
                            padding: 6,
                            borderRadius: '999px',
                            backgroundColor: 'rgba(15,23,42,0.85)',
                            fontSize: '0.9rem',
                        }}
                    >
                        {muted ? '🔇' : '🔊'}
                    </div>
                </div>
            </div>

            {/* Controls footer - Google Meet style */}
            <div
                style={{
                    padding: '10px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid rgba(30,64,175,0.8)',
                    backgroundColor: 'rgba(15,23,42,0.98)',
                    gap: 24,
                }}
            >
                {/* Left: time + meeting id */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.9rem',
                        color: 'rgb(148,163,184)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    <span>{currentTime}</span>
                    <span style={{ opacity: 0.5 }}>|</span>
                    <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{roomId}</span>
                </div>

                {/* Center: controls */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        flex: 1,
                    }}
                >
                    {/* Mute / Unmute */}
                    <button
                        onClick={toggleMute}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '1.2rem',
                        }}
                        aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                        {muted ? '🎙️' : '🎤'}
                    </button>

                    {/* Video on/off */}
                    <button
                        onClick={toggleVideo}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '1.2rem',
                        }}
                        aria-label={videoOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                        {videoOff ? '📷' : '📹'}
                    </button>

                    {/* Share screen */}
                    <button
                        onClick={toggleScreenShare}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '1.2rem',
                        }}
                        aria-label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
                    >
                        🖥️
                    </button>

                    {/* Emoji (placeholder) */}
                    <button
                        onClick={handleEmojiReaction}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '1.2rem',
                        }}
                        aria-label="Reactions"
                    >
                        🙂
                    </button>

                    {/* Live captions (placeholder) */}
                    <button
                        onClick={() => setCaptionsEnabled((prev) => !prev)}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: captionsEnabled
                                ? 'rgba(56,189,248,0.2)'
                                : 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                        }}
                        aria-label="Captions"
                    >
                        CC
                    </button>

                    {/* Raise hand (placeholder) */}
                    <button
                        onClick={handleToggleHand}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: handRaised
                                ? 'rgba(56,189,248,0.2)'
                                : 'rgba(15,23,42,0.9)',
                            color: 'rgb(248,250,252)',
                            fontSize: '1.2rem',
                        }}
                        aria-label="Raise hand"
                    >
                        ✋
                    </button>

                    {/* End call */}
                    <button
                        onClick={handleLeave}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            fontSize: '1.4rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        aria-label="Leave call"
                    >
                        📞
                    </button>
                </div>

                {/* Right: placeholders for info/participants/chat */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <button
                        onClick={() => setShowParticipantsPanel((prev) => !prev)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: 'rgb(148,163,184)',
                            fontSize: '1.1rem',
                        }}
                        aria-label="Info"
                    >
                        ℹ️
                    </button>
                    <button
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: 'rgb(148,163,184)',
                            fontSize: '1.1rem',
                        }}
                        aria-label="Participants"
                    >
                        👥
                    </button>
                    <button
                        onClick={() => setShowChatPanel((prev) => !prev)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 9999,
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: 'rgb(148,163,184)',
                            fontSize: '1.1rem',
                        }}
                        aria-label="Chat"
                    >
                        💬
                    </button>
                </div>
            </div>
        </div>
    );
}
