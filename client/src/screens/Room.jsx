import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useSocket } from '../context/SocketProvider.tsx';
import { useParams, useNavigate } from 'react-router-dom';
import peer from '../services/peer';
import './Room.css';

const RoomPage = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const socket = useSocket();
    const [remoteSocketId, setRemoteSocketId] = useState(null);
    const [remoteUser, setRemoteUser] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [myStream, setMyStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [screenStream, setScreenStream] = useState(null);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);
    const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
    const [user, setUser] = useState(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    
    const videoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const isGettingStreamRef = useRef(false);
    const screenShareTrackRef = useRef(null);
    const connectingRef = useRef(false);
    const mySocketIdRef = useRef(null);
    const iceCandidateQueueRef = useRef([]);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData) {
            navigate('/signin');
            return;
        }
        setUser(JSON.parse(userData));
    }, [navigate]);

    // Establish WebRTC connection
    const establishConnection = useCallback(async (otherSocketId) => {
        if (connectingRef.current || !otherSocketId || !myStream) {
            console.log('Cannot establish connection:', { connecting: connectingRef.current, otherSocketId, hasStream: !!myStream });
            return;
        }
        
        connectingRef.current = true;
        try {
            const peerConnection = peer.getPeer();
            
            // Add ICE candidate handlers
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice:candidate', { to: otherSocketId, candidate: event.candidate });
                }
            };

            // Always ensure local tracks are added before creating offer
            const senders = peerConnection.getSenders();
            myStream.getTracks().forEach(track => {
                const existingSender = senders.find(s => 
                    s.track && s.track.kind === track.kind && s.track.id === track.id
                );
                if (!existingSender) {
                    console.log('Adding track:', track.kind, track.id);
                    peerConnection.addTrack(track, myStream);
                } else {
                    console.log('Track already added:', track.kind, track.id);
                }
            });

            // Create offer AFTER tracks are added
            const offer = await peer.getOffer();
            console.log('Sending offer to:', otherSocketId, 'offer:', offer);
            socket.emit("user:call", { to: otherSocketId, offer });
        } catch (error) {
            console.error('Error establishing connection:', error);
            connectingRef.current = false;
        }
    }, [socket, myStream]);

    const handleUserAlreadyInRoom = useCallback(async ({ email, id, name, isHost: hostStatus }) => {
        console.log(`User ${name || email} is already in room`);
        
        // Don't set remote user if it's ourselves
        if (id === mySocketIdRef.current) return;
        
        setRemoteSocketId(id);
        setRemoteUser({ email, id, name: name || email });
        
        // Wait a bit for streams to be ready, then establish connection
        setTimeout(() => {
            establishConnection(id);
        }, 1000);
    }, [establishConnection]);

    const handleUserJoined = useCallback(async ({ email, id, name, isHost: hostStatus }) => {
        console.log(`User ${name || email} joined the room`);
        
        // Don't set remote user if it's ourselves
        if (id === mySocketIdRef.current) return;
        
        // Only update if we don't already have a remote user
        if (!remoteSocketId) {
            setRemoteSocketId(id);
            setRemoteUser({ email, id, name: name || email });
        }
        
        // Wait a bit for streams to be ready, then establish connection
        setTimeout(() => {
            establishConnection(id);
        }, 500);
    }, [establishConnection, remoteSocketId]);

    // Process queued ICE candidates when remote description is set
    const processIceCandidateQueue = useCallback(() => {
        const peerConnection = peer.getPeer();
        if (peerConnection.remoteDescription && iceCandidateQueueRef.current.length > 0) {
            console.log(`Processing ${iceCandidateQueueRef.current.length} queued ICE candidates`);
            const candidates = [...iceCandidateQueueRef.current];
            iceCandidateQueueRef.current = [];
            
            candidates.forEach(candidate => {
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(err => console.error('Error adding queued ICE candidate:', err));
            });
        }
    }, []);

    const handleIncommingCall = useCallback(async ({ from, offer }) => {
        if (isGettingStreamRef.current || connectingRef.current) return;
        
        try {
            isGettingStreamRef.current = true;
            connectingRef.current = true;
            
            setRemoteSocketId(from);
            
            // Ensure we have a stream
            let streamToUse = myStream;
            if (!streamToUse) {
                streamToUse = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setMyStream(streamToUse);
            }
            
            const peerConnection = peer.getPeer();
            
            // Add ICE candidate handlers
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice:candidate', { to: from, candidate: event.candidate });
                }
            };
            
            // Add tracks BEFORE answering
            const senders = peerConnection.getSenders();
            streamToUse.getTracks().forEach(track => {
                const existingSender = senders.find(s => 
                    s.track && s.track.kind === track.kind
                );
                if (!existingSender) {
                    peerConnection.addTrack(track, streamToUse);
                }
            });
            
            // Set remote description FIRST - this is important for receiving tracks
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            // Process any queued ICE candidates
            processIceCandidateQueue();
            
            // Create answer AFTER remote description is set
            const ans = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(new RTCSessionDescription(ans));
            
            console.log('Answer created and sent to:', from);
            socket.emit('call:accepted', { to: from, ans });
            
            // Check for tracks that might have been received before we set up the listener
            setTimeout(() => {
                peerConnection.getReceivers().forEach(receiver => {
                    if (receiver.track && receiver.track.readyState === 'live') {
                        console.log('Found track on receiver:', receiver.track.kind);
                        setRemoteStream(prevStream => {
                            if (prevStream) {
                                if (!prevStream.getTracks().find(t => t.id === receiver.track.id)) {
                                    prevStream.addTrack(receiver.track);
                                }
                                return prevStream;
                            } else {
                                return new MediaStream([receiver.track]);
                            }
                        });
                    }
                });
            }, 500);
        } catch (error) {
            console.error('Error handling incoming call:', error);
            alert('Could not access camera/microphone. Please check permissions.');
            connectingRef.current = false;
        } finally {
            isGettingStreamRef.current = false;
        }
    }, [socket, myStream, processIceCandidateQueue]);

    const handleCallAccepted = useCallback(async ({ from, ans }) => {
        const peerConnection = peer.getPeer();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(ans));
        
        // Process any queued ICE candidates
        processIceCandidateQueue();
        
        // Ensure local tracks are added after answer is set
        if (myStream) {
            myStream.getTracks().forEach(track => {
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === track.kind
                );
                if (!sender) {
                    peerConnection.addTrack(track, myStream);
                }
            });
        }
        
        // Check for remote tracks that might have been received
        setTimeout(() => {
            const receivers = peerConnection.getReceivers();
            console.log('Checking receivers after call accepted:', receivers.length);
            receivers.forEach(receiver => {
                if (receiver.track && receiver.track.readyState === 'live') {
                    console.log('Found live track on receiver after call accepted:', receiver.track.kind);
                    setRemoteStream(prevStream => {
                        if (prevStream) {
                            if (!prevStream.getTracks().find(t => t.id === receiver.track.id)) {
                                prevStream.addTrack(receiver.track);
                                return new MediaStream(prevStream.getTracks()); // Trigger re-render
                            }
                            return prevStream;
                        } else {
                            return new MediaStream([receiver.track]);
                        }
                    });
                }
            });
        }, 1000);
        
        connectingRef.current = false;
    }, [myStream, processIceCandidateQueue]);

    const handleIceCandidate = useCallback(({ candidate }) => {
        if (!candidate) return;
        
        const peerConnection = peer.getPeer();
        
        // Only add ICE candidate if remote description is set
        if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                .catch(err => {
                    console.error('Error adding ICE candidate:', err);
                });
        } else {
            // Queue the candidate if remote description isn't set yet
            console.log('Queuing ICE candidate, waiting for remote description');
            iceCandidateQueueRef.current.push(candidate);
        }
    }, []);

    const handleKickUser = useCallback(() => {
        if (isHost && remoteSocketId && remoteUser) {
            if (window.confirm(`Are you sure you want to remove ${remoteUser.name || remoteUser.email}?`)) {
                socket.emit('user:kick', { 
                    room: roomId, 
                    userId: remoteUser.id,
                    socketId: remoteSocketId 
                });
            }
        }
    }, [isHost, remoteSocketId, remoteUser, socket, roomId]);

    const handleKicked = useCallback(() => {
        alert('You have been removed from the meeting.');
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
        }
        navigate('/dashboard');
    }, [myStream, navigate]);

    const handleScreenShare = useCallback(async () => {
        try {
            if (isScreenSharing) {
                if (screenShareTrackRef.current) {
                    screenShareTrackRef.current.stop();
                    screenShareTrackRef.current = null;
                }
                if (screenStream) {
                    screenStream.getTracks().forEach(track => track.stop());
                    setScreenStream(null);
                }
                setIsScreenSharing(false);
                socket.emit('screen:share:stop', { room: roomId });
                
                if (myStream) {
                    const videoTrack = myStream.getVideoTracks()[0];
                    if (videoTrack) {
                        const sender = peer.getPeer().getSenders().find(s => 
                            s.track && s.track.kind === 'video'
                        );
                        if (sender) {
                            sender.replaceTrack(videoTrack);
                        }
                    }
                }
            } else {
                socket.emit('screen:share:request', { room: roomId, userId: user?.id });
            }
        } catch (error) {
            console.error('Error with screen share:', error);
            alert('Could not share screen. Please check permissions.');
        }
    }, [isScreenSharing, screenStream, myStream, socket, roomId, user]);

    const handleScreenShareStarted = useCallback(async ({ socketId, userId }) => {
        if (socketId === socket.id) {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                    video: true, 
                    audio: true 
                });
                setScreenStream(screenStream);
                setIsScreenSharing(true);
                
                const videoTrack = screenStream.getVideoTracks()[0];
                screenShareTrackRef.current = videoTrack;
                
                const sender = peer.getPeer().getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (sender && videoTrack) {
                    sender.replaceTrack(videoTrack);
                }
                
                videoTrack.onended = async () => {
                    try {
                        if (screenShareTrackRef.current) {
                            screenShareTrackRef.current.stop();
                            screenShareTrackRef.current = null;
                        }
                        if (screenStream) {
                            screenStream.getTracks().forEach(track => track.stop());
                            setScreenStream(null);
                        }
                        setIsScreenSharing(false);
                        socket.emit('screen:share:stop', { room: roomId });
                        
                        if (myStream) {
                            const videoTrack = myStream.getVideoTracks()[0];
                            if (videoTrack) {
                                const sender = peer.getPeer().getSenders().find(s => 
                                    s.track && s.track.kind === 'video'
                                );
                                if (sender) {
                                    sender.replaceTrack(videoTrack);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error stopping screen share:', error);
                    }
                };
            } catch (error) {
                console.error('Error starting screen share:', error);
                socket.emit('screen:share:stop', { room: roomId });
            }
        } else {
            setIsRemoteScreenSharing(true);
        }
    }, [socket, roomId, myStream]);

    const handleScreenShareStopped = useCallback(({ socketId }) => {
        if (socketId === socket.id) {
            setIsScreenSharing(false);
        } else {
            setIsRemoteScreenSharing(false);
        }
    }, [socket]);

    const handleScreenShareDenied = useCallback(({ message }) => {
        alert(message);
    }, []);

    const toggleMute = useCallback(() => {
        if (myStream) {
            const audioTrack = myStream.getAudioTracks()[0];
            if (audioTrack) {
                const newState = !audioTrack.enabled;
                audioTrack.enabled = newState;
                setIsMuted(!newState);
                
                if (remoteSocketId) {
                    socket.emit('audio:status', { to: remoteSocketId, muted: !newState });
                }
            }
        }
    }, [myStream, remoteSocketId, socket]);

    const toggleVideo = useCallback(() => {
        if (myStream) {
            const videoTrack = myStream.getVideoTracks()[0];
            if (videoTrack) {
                const newState = !videoTrack.enabled;
                videoTrack.enabled = newState;
                setIsVideoOff(!newState);
                
                if (remoteSocketId) {
                    socket.emit('video:status', { to: remoteSocketId, videoOff: !newState });
                }
            }
        }
    }, [myStream, remoteSocketId, socket]);

    const handleLeave = useCallback(() => {
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        peer.reset();
        navigate('/dashboard');
    }, [myStream, screenStream, navigate]);

    const handleCopyLink = useCallback(() => {
        const link = `${window.location.origin}/meeting/${roomId}`;
        navigator.clipboard.writeText(link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    }, [roomId]);

    // Set up peer connection track listener - must be reactive to peer connection changes
    useEffect(() => {
        const peerConnection = peer.getPeer();
        let currentRemoteStream = null;
        
        const handleTrack = (ev) => {
            console.log('Track event received:', ev);
            console.log('Track kind:', ev.track.kind);
            console.log('Track enabled:', ev.track.enabled);
            console.log('Track readyState:', ev.track.readyState);
            console.log('Streams:', ev.streams);
            
            if (ev.streams && ev.streams.length > 0) {
                const stream = ev.streams[0];
                console.log('Setting remote stream from streams array:', stream);
                
                if (!currentRemoteStream) {
                    currentRemoteStream = stream;
                    setRemoteStream(stream);
                } else {
                    // Add tracks from new stream to existing stream
                    stream.getTracks().forEach(track => {
                        if (!currentRemoteStream.getTracks().find(t => t.id === track.id)) {
                            currentRemoteStream.addTrack(track);
                            console.log('Added track to existing stream:', track.kind);
                        }
                    });
                }
            } else if (ev.track) {
                // Fallback: create or update stream from individual track
                console.log('Adding individual track:', ev.track.kind, ev.track.id);
                if (!currentRemoteStream) {
                    currentRemoteStream = new MediaStream([ev.track]);
                    setRemoteStream(currentRemoteStream);
                    console.log('Created new stream from individual track');
                } else {
                    if (!currentRemoteStream.getTracks().find(t => t.id === ev.track.id)) {
                        currentRemoteStream.addTrack(ev.track);
                        console.log('Added track to existing stream:', ev.track.kind);
                        setRemoteStream(new MediaStream(currentRemoteStream.getTracks())); // Trigger re-render
                    }
                }
            }
        };
        
        // Also listen for connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log('Peer connection established! Checking for tracks...');
                // Check for tracks after connection is established
                setTimeout(() => {
                    const receivers = peerConnection.getReceivers();
                    console.log('Number of receivers:', receivers.length);
                    receivers.forEach((receiver, index) => {
                        if (receiver.track) {
                            console.log(`Receiver ${index} track:`, {
                                kind: receiver.track.kind,
                                enabled: receiver.track.enabled,
                                readyState: receiver.track.readyState
                            });
                            if (!currentRemoteStream) {
                                currentRemoteStream = new MediaStream([receiver.track]);
                                setRemoteStream(currentRemoteStream);
                            } else {
                                if (!currentRemoteStream.getTracks().find(t => t.id === receiver.track.id)) {
                                    currentRemoteStream.addTrack(receiver.track);
                                    setRemoteStream(new MediaStream(currentRemoteStream.getTracks()));
                                }
                            }
                        }
                    });
                }, 1000);
            }
        };
        
        // Listen for ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
        };
        
        peerConnection.addEventListener('track', handleTrack);
        
        return () => {
            peerConnection.removeEventListener('track', handleTrack);
        };
    }, []);

    const handleAudioStatus = useCallback(({ muted }) => {
        setIsRemoteMuted(muted);
    }, []);

    const handleVideoStatus = useCallback(({ videoOff }) => {
        setIsRemoteVideoOff(videoOff);
    }, []);

    useEffect(() => {
        socket.on('user:joined', handleUserJoined);
        socket.on('user:already:in:room', handleUserAlreadyInRoom);
        socket.on('incomming:call', handleIncommingCall);
        socket.on('call:accepted', handleCallAccepted);
        socket.on('ice:candidate', handleIceCandidate);
        socket.on('screen:share:started', handleScreenShareStarted);
        socket.on('screen:share:stopped', handleScreenShareStopped);
        socket.on('screen:share:denied', handleScreenShareDenied);
        socket.on('audio:status', handleAudioStatus);
        socket.on('video:status', handleVideoStatus);
        socket.on('user:kicked', handleKicked);
        
        // Store socket ID
        socket.on('connect', () => {
            mySocketIdRef.current = socket.id;
        });
        mySocketIdRef.current = socket.id;

        return () => {
            socket.off("user:joined", handleUserJoined);
            socket.off("user:already:in:room", handleUserAlreadyInRoom);
            socket.off('incomming:call', handleIncommingCall);
            socket.off('call:accepted', handleCallAccepted);
            socket.off('ice:candidate', handleIceCandidate);
            socket.off('screen:share:started', handleScreenShareStarted);
            socket.off('screen:share:stopped', handleScreenShareStopped);
            socket.off('screen:share:denied', handleScreenShareDenied);
            socket.off('audio:status', handleAudioStatus);
            socket.off('video:status', handleVideoStatus);
            socket.off('user:kicked', handleKicked);
        };
    }, [socket, handleUserJoined, handleUserAlreadyInRoom, handleIncommingCall, handleCallAccepted, 
        handleIceCandidate, handleScreenShareStarted, handleScreenShareStopped, 
        handleScreenShareDenied, handleAudioStatus, handleVideoStatus, handleKicked]);

    const handleRoomJoin = useCallback(({ isHost: hostStatus }) => {
        setIsHost(hostStatus);
    }, []);

    useEffect(() => {
        if (user && socket && roomId) {
            socket.emit('room:join', { email: user.email, room: roomId, userId: user.id });
            
            const startMedia = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    setMyStream(stream);
                    setIsMuted(false);
                    setIsVideoOff(false);
                    
                    // Add tracks to peer connection immediately
                    const peerConnection = peer.getPeer();
                    stream.getTracks().forEach(track => {
                        peerConnection.addTrack(track, stream);
                    });
                } catch (error) {
                    console.error('Error starting media:', error);
                }
            };
            startMedia();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, socket, roomId]);

    useEffect(() => {
        socket.on('room:join', handleRoomJoin);
        return () => {
            socket.off('room:join', handleRoomJoin);
        };
    }, [socket, handleRoomJoin]);

    useEffect(() => {
        return () => {
            if (myStream) {
                myStream.getTracks().forEach(track => track.stop());
            }
            if (screenStream) {
                screenStream.getTracks().forEach(track => track.stop());
            }
            peer.reset();
        };
    }, [myStream, screenStream]);

    useEffect(() => {
        if (videoRef.current && myStream) {
            videoRef.current.srcObject = myStream;
        }
    }, [myStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('Setting remote video srcObject:', remoteStream);
            remoteVideoRef.current.srcObject = remoteStream;
            
            // Log tracks to debug
            console.log('Remote stream tracks:', remoteStream.getTracks().map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState
            })));
            
            // Handle video element events
            remoteVideoRef.current.onloadedmetadata = () => {
                console.log('Remote video metadata loaded');
                remoteVideoRef.current.play().catch(err => {
                    console.error('Error playing remote video:', err);
                });
            };
            
            // Don't mute remote video - we need audio from it!
        }
    }, [remoteStream]);

    useEffect(() => {
        if (screenVideoRef.current && screenStream) {
            screenVideoRef.current.srcObject = screenStream;
        }
    }, [screenStream]);

    // Show waiting message only for host when no remote user
    const showWaitingMessage = isHost && !remoteSocketId && !remoteStream;

    return (
        <div className="room-container">
            <div className="room-header">
                <h2>VideoMeet</h2>
                <div className="room-info">
                    <span>Room: {roomId}</span>
                    {remoteSocketId && <span className="connected">● Connected</span>}
                    {isHost && <span className="host-badge">👑 Host</span>}
                    <button 
                        className="link-btn"
                        onClick={() => setShowLinkModal(!showLinkModal)}
                        title="Show meeting link"
                    >
                        🔗
                    </button>
                </div>
            </div>

            {showLinkModal && (
                <div className="link-modal">
                    <div className="link-modal-content">
                        <h3>Meeting Link</h3>
                        <p>Share this link with others to join the meeting</p>
                        <div className="link-display">
                            <input
                                type="text"
                                value={`${window.location.origin}/meeting/${roomId}`}
                                readOnly
                                className="link-input-modal"
                            />
                            <button onClick={handleCopyLink} className="copy-btn-modal">
                                {linkCopied ? '✓ Copied!' : 'Copy'}
                            </button>
                        </div>
                        <button 
                            className="close-modal-btn"
                            onClick={() => setShowLinkModal(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <div className="video-container">
                <div className="video-grid">
                    {/* Remote User Video - Always show if remote user joined */}
                    {(remoteSocketId || remoteStream) ? (
                        <div className="video-wrapper remote-video">
                            {remoteStream ? (
                                <>
                                    <video
                                        ref={remoteVideoRef}
                                        autoPlay
                                        playsInline
                                        className="video-element"
                                        style={{ display: isRemoteVideoOff ? 'none' : 'block' }}
                                    />
                                    {isRemoteVideoOff && (
                                        <div className="video-placeholder">
                                            <div className="placeholder-icon">👤</div>
                                            <div className="placeholder-name">{remoteUser?.name || remoteUser?.email || 'Remote User'}</div>
                                        </div>
                                    )}
                                    <div className="video-label">
                                        {remoteUser?.name || remoteUser?.email || 'Remote User'}
                                        {isRemoteMuted && <span className="mute-indicator"> 🔇</span>}
                                        {isHost && remoteUser && (
                                            <button 
                                                className="kick-btn"
                                                onClick={handleKickUser}
                                                title="Remove user"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="video-placeholder">
                                    <div className="placeholder-icon">👤</div>
                                    <div className="placeholder-name">{remoteUser?.name || remoteUser?.email || 'Connecting...'}</div>
                                </div>
                            )}
                        </div>
                    ) : showWaitingMessage ? (
                        <div className="video-wrapper remote-video">
                            <div className="video-placeholder">
                                <div className="placeholder-text">Waiting for others to join...</div>
                            </div>
                        </div>
                    ) : null}
                    
                    {/* Local User Video - Always show */}
                    <div className="video-wrapper local-video">
                        {myStream ? (
                            <>
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="video-element"
                                    style={{ display: isVideoOff ? 'none' : 'block' }}
                                />
                                {isVideoOff && (
                                    <div className="video-placeholder">
                                        <div className="placeholder-icon">👤</div>
                                        <div className="placeholder-name">{user?.name || 'You'}</div>
                                    </div>
                                )}
                                <div className="video-label">
                                    {user?.name || 'You'}
                                    {isMuted && <span className="mute-indicator"> 🔇</span>}
                                </div>
                            </>
                        ) : (
                            <div className="video-placeholder">
                                <div className="placeholder-icon">👤</div>
                                <div className="placeholder-name">{user?.name || 'You'}</div>
                                <div className="placeholder-text">Camera off</div>
                            </div>
                        )}
                    </div>
                </div>

                {isScreenSharing && (
                    <div className="screen-share-overlay">
                        <video
                            ref={screenVideoRef}
                            autoPlay
                            playsInline
                            className="screen-video"
                        />
                    </div>
                )}
            </div>

            <div className="controls-bar">
                <button 
                    className={`control-btn ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                    {isMuted ? '🔇' : '🎤'}
                    <span className="control-label">{isMuted ? 'Unmute' : 'Mute'}</span>
                </button>
                
                <button 
                    className={`control-btn ${isVideoOff ? 'active' : ''}`}
                    onClick={toggleVideo}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                >
                    {isVideoOff ? '📷' : '📹'}
                    <span className="control-label">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
                </button>
                
                <button 
                    className={`control-btn ${isScreenSharing ? 'active' : ''}`}
                    onClick={handleScreenShare}
                    title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
                    disabled={isRemoteScreenSharing && !isScreenSharing}
                >
                    {isScreenSharing ? '🛑' : '📺'}
                    <span className="control-label">{isScreenSharing ? 'Stop Share' : 'Share'}</span>
                </button>
                
                <button 
                    className="control-btn danger"
                    onClick={handleLeave}
                >
                    Leave
                </button>
            </div>
        </div>
    );
};

export default RoomPage;
