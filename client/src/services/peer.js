class PeerService {
    constructor(){
        this._peer = null;
    }

    createPeerConnection() {
        this._peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: ['stun:stun.l.google.com:19302','stun:global.stun.twilio.com:3478'],
                },
            ],
        });
        return this._peer;
    }

    getPeer() {
        if (!this._peer) {
            this.createPeerConnection();
        }
        return this._peer;
    }

    get peer() {
        return this.getPeer();
    }

    async getAnswer(offer){
        const peerConnection = this.getPeer();
        if(peerConnection){
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const ans = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(new RTCSessionDescription(ans));
            return ans;
        }
    }

    async setLocalDescription(ans){
        const peerConnection = this.getPeer();
        if(peerConnection){
            await peerConnection.setRemoteDescription(new RTCSessionDescription(ans));
        }
    }
    
    async getOffer(){
        const peerConnection = this.getPeer();
        if(peerConnection){
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
            return offer;
        }
    }

    reset() {
        if (this._peer) {
            this._peer.close();
            this._peer = null;
        }
    }
}

const peerService = new PeerService();
export default peerService;