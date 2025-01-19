const socket = io(); // Connect to the backend Socket.IO server
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

let localStream; // To store the local video/audio stream
let peerConnection; // To handle WebRTC peer-to-peer connection

// STUN server configuration for WebRTC (Google's public STUN server)
const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Initialize local media (camera and microphone)
const init = async () => {
    try {
        // Ask user for access to their camera and microphone
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream; // Show the local video in the local video element
    } catch (error) {
        console.error('Error accessing media devices:', error);
    }
};

// Create a WebRTC peer connection
const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(servers);

    // Add all tracks (video and audio) from local stream to the connection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // When remote stream is received, attach it to the remoteVideo element
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates (networking details for connection)
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate); // Send ICE candidate to the other peer
        }
    };
};

// Handle receiving an offer
socket.on('offer', async (offer) => {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer(); // Generate an answer to the offer
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer); // Send the answer to the other peer
});

// Handle receiving an answer
socket.on('answer', (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// Handle receiving an ICE candidate
socket.on('candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

// Handle the "Start Call" button
startCallButton.addEventListener('click', async () => {
    createPeerConnection(); // Prepare for a new connection

    const offer = await peerConnection.createOffer(); // Create an SDP offer
    await peerConnection.setLocalDescription(offer); // Save the local description

    socket.emit('offer', offer); // Send the offer to the other peer
});

// Initialize everything when the page loads
init();
