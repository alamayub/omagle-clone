const socket = io(); // Connect to the backend Socket.IO server
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const hangUpButton = document.getElementById('hangUp');
const resetButton = document.getElementById('reset');
const statusElement = document.getElementById('status');

let localStream; // To store the local video/audio stream
let peerConnection; // To handle WebRTC peer-to-peer connection
let iceCandidates = []; // Buffer to hold ICE candidates before remote description is set

const servers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const setStatus = (message) => {
    statusElement.textContent = message;
};

// Initialize local media (camera and microphone)
const init = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream; // Show the local video
        setStatus('Ready to start a call.');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        setStatus('Failed to access camera/microphone. Check permissions.');
    }
};

// Create a WebRTC peer connection
const createPeerConnection = () => {
    peerConnection = new RTCPeerConnection(servers);

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Set up the remote video once tracks are received
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates (networking details for connection)
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate); // Send ICE candidate
        }
    };
};

// Reset the call, stop streams, and clear remote video
const reset = async () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Reset buttons and status
    resetButton.disabled = true;
    startCallButton.disabled = false;
    hangUpButton.disabled = true;

    // Reinitialize the media
    await init();
    setStatus('Click "Start Call" to begin.');
};

// Handle receiving an offer
socket.on('offer', async (offer) => {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await peerConnection.createAnswer(); // Generate an answer
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer); // Send the answer to the other peer
    setStatus('Partner found! Connecting...');
});

// Handle receiving an answer
socket.on('answer', async (answer) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    setStatus('Connected! You can now chat.');

    // Add buffered ICE candidates if any
    iceCandidates.forEach((candidate) => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
    iceCandidates = []; // Clear the buffer once candidates are applied
});

// Handle receiving an ICE candidate
socket.on('candidate', (candidate) => {
    if (peerConnection) {
        if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
        } else {
            // Store ICE candidates until remote description is set
            iceCandidates.push(candidate);
        }
    }
});

// Handle the "Start Call" button
startCallButton.addEventListener('click', async () => {
    createPeerConnection();

    const offer = await peerConnection.createOffer(); // Create SDP offer
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer); // Send offer to the other peer

    setStatus('Looking for a partner...');
    startCallButton.disabled = true;
    hangUpButton.disabled = false;
    resetButton.disabled = true;
});

// Handle the "Hang Up" button
hangUpButton.addEventListener('click', () => {
    // Close connection and reset UI on hang up
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    setStatus('Call ended.');
    remoteVideo.srcObject = null;
    hangUpButton.disabled = true;
    startCallButton.disabled = false;
    resetButton.disabled = false;

    socket.emit('hangUp'); // Notify the other user
});

// Handle the "Reset" button
resetButton.addEventListener('click', reset);

// Initialize media and set up UI on page load
init();
