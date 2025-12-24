class PeerService {
    private _peer: RTCPeerConnection | null = null;

    createPeerConnection(): RTCPeerConnection {
        this._peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: ['stun:stun.l.google.com:19302', 'stun:global.stun.twilio.com:3478'],
                },
            ],
        });
        return this._peer;
    }

    getPeer(): RTCPeerConnection {
        if (!this._peer) {
            this.createPeerConnection();
        }
        return this._peer!;
    }

    get peer(): RTCPeerConnection {
        return this.getPeer();
    }

    async getAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | undefined> {
        const peerConnection = this.getPeer();
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const ans = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    // Apply remote answer on the caller side.
    // Guard against applying it multiple times which causes InvalidStateError.
    async applyRemoteAnswer(ans: RTCSessionDescriptionInit): Promise<void> {
        const peerConnection = this.getPeer();
        if (!peerConnection) return;

        // If we already have a remote description and are stable, no need to set again
        if (
            peerConnection.signalingState === 'stable' &&
            peerConnection.currentRemoteDescription
        ) {
            return;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(ans));
    }
    
    async getOffer(): Promise<RTCSessionDescriptionInit | undefined> {
        const peerConnection = this.getPeer();
        if (peerConnection) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
            return offer;
        }
    }

    reset(): void {
        if (this._peer) {
            this._peer.close();
            this._peer = null;
        }
    }
}

const peerService = new PeerService();
export default peerService;

