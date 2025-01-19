const socket = io(); // Connect to the backend Socket.IO server
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');
const hangUpButton = document.getElementById('hangUp');
const resetButton = document.getElementById('reset');
const statusElement = document.getElementById('status');

let localStream; // To store the local video/audio stream
let peerConnection; // To handle WebRTC peer-to-peer connection
let iceCandidates = []; // Store candidates before the remote description is set

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
        localVideo.srcObject = localStream;
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

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', event.candidate); // Send candidate to the server
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

    setStatus('Call ended. You can reset to try again.');
    remoteVideo.srcObject = null;
    hangUpButton.disabled = true;
    startCallButton.disabled = false;
    resetButton.disabled = false;

    socket.emit('hangUp'); // Notify the other user
};

// Reset: Reinitialize the media and clear the remote video
const reset = async () => {
    if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    socket.off('offer');
    socket.off('answer');
    socket.off('candidate');
    socket.off('hangUp');

    await init();
    setStatus('Click "Start Call" to begin.');

    resetButton.disabled = true;
    startCallButton.disabled = false;
    hangUpButton.disabled = true;
};

// Handle receiving an offer
socket.on('offer', async (offer) => {
    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', answer);
    setStatus('Partner found! Connecting...');
    hangUpButton.disabled = false;
    startCallButton.disabled = true;
});

// Handle receiving an answer
socket.on('answer', (answer) => {
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        setStatus('Connected! You can now chat.');
    }

    // Forward stored ICE candidates once the remote description is set
    if (iceCandidates.length > 0) {
        iceCandidates.forEach((candidate) => {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
                console.warn('Failed to add buffered ICE candidate:', err);
            });
        });
        iceCandidates = []; // Clear candidates after they are added
    }

    hangUpButton.disabled = false;
    startCallButton.disabled = true;
});

// Handle receiving an ICE candidate
socket.on('candidate', (candidate) => {
    if (peerConnection) {
        // Add candidate only if remote description is set
        if (peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch((err) => {
                console.warn('Failed to add ICE candidate:', err);
            });
        } else {
            // Store the candidate until remote description is set
            console.log('ICE candidate received before remote description, saving...');
            iceCandidates.push(candidate);
        }
    } else {
        console.warn('Received ICE candidate, but peerConnection is null.');
    }
});

// Handle receiving a "hangUp" message
socket.on('hangUp', () => {
    hangUp();
    setStatus('Partner disconnected. Reset to start again.');
});

// Start Call Button
startCallButton.addEventListener('click', async () => {
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('offer', offer);

    socket.on('answer', (answer) => {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('candidate', (candidate) => {
        if (peerConnection) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            iceCandidates.push(candidate); // Store candidate if remote description is not yet set
        }
    });

    socket.on('hangUp', () => {
        hangUp();
    });

    setStatus('Looking for a partner...');
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
