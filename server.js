const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle offers (send it to the other peer)
    socket.on('offer', (offer) => {
        console.log('Offer received from:', socket.id);
        socket.broadcast.emit('offer', offer);
    });

    // Handle answers (send it to the other peer)
    socket.on('answer', (answer) => {
        console.log('Answer received from:', socket.id);
        socket.broadcast.emit('answer', answer);
    });

    // Handle ICE candidates (send to the other peer)
    socket.on('candidate', (candidate) => {
        console.log('ICE candidate received from:', socket.id);
        socket.broadcast.emit('candidate', candidate);
    });

    // Handle disconnect events (notify other peer)
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        socket.broadcast.emit('hangUp'); // Notify the other user to hang up
    });

    // Handle hang-ups
    socket.on('hangUp', () => {
        console.log('Hang Up received from:', socket.id);
        socket.broadcast.emit('hangUp'); // Notify the other user
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
