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
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);
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
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then((stream) => {
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // Join room
                socket.emit('room:join', {
                    email: parsedUser.email,
                    room: roomId,
                    userId: parsedUser.id
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
            setRemoteUsers((prev) => [...prev.filter(u => u.id !== data.id), data]);
            handleUserJoined(data);
        });

        socket.on('user:joined', (data: RemoteUser) => {
            setRemoteUsers((prev) => [...prev.filter(u => u.id !== data.id), data]);
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

        socket.on('call:accepted', async ({ from, ans }: { from: string; ans: RTCSessionDescriptionInit }) => {
            await peerService.setLocalDescription(ans);
        });

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
        };
    }, [roomId, socket, router]);

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
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const videoTrack = screenStream.getVideoTracks()[0];
                
                localStreamRef.current.getVideoTracks().forEach(track => {
                    localStreamRef.current!.removeTrack(track);
                    track.stop();
                });
                localStreamRef.current.addTrack(videoTrack);

                peersRef.current.forEach((peer) => {
                    const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
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
            const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            const videoTrack = userStream.getVideoTracks()[0];

            localStreamRef.current.getVideoTracks().forEach(track => {
                localStreamRef.current!.removeTrack(track);
                track.stop();
            });
            localStreamRef.current.addTrack(videoTrack);

            peersRef.current.forEach((peer) => {
                const sender = peer.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

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

    return (
        <div style={{ minHeight: '100vh', background: '#1a1a1a', color: 'white', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Meeting Room: {roomId}</h1>
                <button 
                    onClick={handleLeave}
                    style={{
                        padding: '10px 20px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Leave Meeting
                </button>
            </div>

            {/* Video Container */}
            <div style={{ flex: 1, display: 'flex', gap: '20px', padding: '20px', position: 'relative' }}>
                {/* Remote Video */}
                <div style={{ flex: 1, position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {remoteUsers.length === 0 && (
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.2rem', opacity: 0.7 }}>Waiting for others to join...</p>
                        </div>
                    )}
                </div>

                {/* Local Video */}
                <div style={{ width: '300px', position: 'relative', background: '#000', borderRadius: '8px', overflow: 'hidden' }}>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>
            </div>

            {/* Controls */}
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '20px', borderTop: '1px solid #333' }}>
                <button
                    onClick={toggleMute}
                    style={{
                        padding: '15px 30px',
                        background: muted ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                    }}
                >
                    {muted ? '🔇 Unmute' : '🔊 Mute'}
                </button>

                <button
                    onClick={toggleVideo}
                    style={{
                        padding: '15px 30px',
                        background: videoOff ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                    }}
                >
                    {videoOff ? '📹 Start Video' : '📹 Stop Video'}
                </button>

                <button
                    onClick={toggleScreenShare}
                    style={{
                        padding: '15px 30px',
                        background: isScreenSharing ? '#10b981' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 600
                    }}
                >
                    {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
                </button>
            </div>
        </div>
    );
}
