const socket = io(); // Connect to the backend Socket.IO server
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const hangUpButton = document.getElementById('hangUp');
const resetButton = document.getElementById('reset');

let localStream; // To store the local video/audio stream
let peerConnection; // To handle WebRTC peer-to-peer connection

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Initialize local media (camera and microphone)
const init = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
};

// Create a WebRTC peer connection
const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate);
        }
    };
};

// Hang Up: Close the connection and stop streams
const hangUp = () => {
    if (peerConnection) {
        peerConnection.close(); // Close WebRTC connection
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop()); // Stop media streams
    }

    remoteVideo.srcObject = null;
    hangUpButton.disabled = true;
    startCallButton.disabled = false;
    resetButton.disabled = false;

    socket.emit('hangUp'); // Notify the other user
};

// Reset: Reinitialize the media and clear the remote video
const reset = async () => {
    await init(); // Reinitialize local media
    remoteVideo.srcObject = null;
    resetButton.disabled = true;
    startCallButton.disabled = false;
};

// Handle receiving an offer
socket.on('offer', async (offer) => {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer);

    hangUpButton.disabled = false;
    startCallButton.disabled = true;
});

// Handle receiving an answer
socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    hangUpButton.disabled = false;
    startCallButton.disabled = true;
});

// Handle receiving an ICE candidate
socket.on('candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Handle receiving a "hangUp" message
socket.on('hangUp', () => {
    hangUp(); // Execute hang up logic when the other user disconnects
});

// Start Call Button
startCallButton.addEventListener('click', async () => {
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer);

    startCallButton.disabled = true;
    hangUpButton.disabled = false;
    resetButton.disabled = true;
});

// Hang Up Button
hangUpButton.addEventListener('click', () => {
    hangUp(); // Hang up the current call
});

// Reset Button
resetButton.addEventListener('click', () => {
    reset(); // Reset and reinitialize media
});

// Initialize on page load
init();
