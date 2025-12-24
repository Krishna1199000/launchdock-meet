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

    async getAnswer(offer: RTCSessionDescriptionInit, peerConnection?: RTCPeerConnection): Promise<RTCSessionDescriptionInit | undefined> {
        const pc = peerConnection || this.getPeer();
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    // Apply remote answer on the caller side.
    // Guard against applying it multiple times which causes InvalidStateError.
    async applyRemoteAnswer(ans: RTCSessionDescriptionInit, peerConnection?: RTCPeerConnection): Promise<void> {
        const pc = peerConnection || this.getPeer();
        if (!pc) return;

        // If we already have a remote description and are stable, no need to set again
        if (
            pc.signalingState === 'stable' &&
            pc.currentRemoteDescription
        ) {
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(ans));
    }
    
    async getOffer(peerConnection?: RTCPeerConnection): Promise<RTCSessionDescriptionInit | undefined> {
        const pc = peerConnection || this.getPeer();
        if (pc) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(new RTCSessionDescription(offer));
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

