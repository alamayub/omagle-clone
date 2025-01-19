const socket = io(); // Connect to the backend Socket.IO server
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const hangUpButton = document.getElementById('hangUp');
const resetButton = document.getElementById('reset');
const statusElement = document.getElementById('status');

let localStream; // Local video/audio stream
let peerConnection; // WebRTC connection
let partnerId = null; // ID of the connected partner
let iceCandidates = []; // ICE candidate buffer

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const setStatus = (message) => {
    statusElement.textContent = message;
};

// Initialize local media
const init = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream; // Display local video
        setStatus('Ready to start a call.');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        setStatus('Failed to access camera/microphone. Check permissions.');
    }
};

// Create a new WebRTC peer connection
const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(servers);

    if (localStream) {
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });
    }

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && partnerId) {
            socket.emit('candidate', event.candidate, partnerId);
        }
    };
};

// Reset the app state
const reset = async () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    partnerId = null;

    startCallButton.disabled = false;
    hangUpButton.disabled = true;
    resetButton.disabled = true;

    await init();
    setStatus('Click "Start Call" to begin.');
};

// Handle incoming events
socket.on('partnerFound', (id) => {
    partnerId = id;
    setStatus('Partner found! Starting connection...');
});

// Handle receiving an offer
socket.on('offer', async (offer) => {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer, partnerId);
    setStatus('Partner found! Connecting...');
});

// Handle receiving an answer
socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    setStatus('Connected! You can now chat.');

    iceCandidates.forEach((candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidates = [];
});

// Handle receiving an ICE candidate
socket.on('candidate', (candidate) => {
    if (peerConnection) {
        if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        } else {
            iceCandidates.push(candidate);
        }
    }
});

// Handle hang-up signal
socket.on('hangUp', async () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    remoteVideo.srcObject = null;
    setStatus('Partner disconnected. Ready for a new call.');

    partnerId = null;
    startCallButton.disabled = false;
    hangUpButton.disabled = true;
    resetButton.disabled = false;

    await init();
});

// Start call
startCallButton.addEventListener('click', async () => {
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer, partnerId);
    setStatus('Looking for a partner...');

    startCallButton.disabled = true;
    hangUpButton.disabled = false;
    resetButton.disabled = true;
});

// Hang up call
hangUpButton.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    socket.emit('hangUp', partnerId);
    partnerId = null;

    remoteVideo.srcObject = null;
    setStatus('Call ended. Ready to start a new call.');

    startCallButton.disabled = false;
    hangUpButton.disabled = true;
    resetButton.disabled = false;
});

// Reset UI and reinitialize
resetButton.addEventListener('click', reset);

// Initialize the app on page load
init();
