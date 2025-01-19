const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = [];

app.use(express.static('public'));  // Serve static files like your client-side code

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Add user to the list (simplified)
    users.push(socket.id);

    // When an offer is sent from a client, broadcast it to the other user
    socket.on('offer', (offer) => {
        const partner = users.find(id => id !== socket.id);  // Find the other user
        if (partner) {
            io.to(partner).emit('offer', offer);  // Send the offer to the other user
        }
    });

    // When an answer is received, forward it to the other user
    socket.on('answer', (answer) => {
        const partner = users.find(id => id !== socket.id);
        if (partner) {
            io.to(partner).emit('answer', answer);  // Send the answer to the other user
        }
    });

    // When a candidate is received, forward it to the other user
    socket.on('candidate', (candidate) => {
        const partner = users.find(id => id !== socket.id);
        if (partner) {
            io.to(partner).emit('candidate', candidate);  // Send the candidate to the other user
        }
    });

    // When a user disconnects, remove from users list and notify the other user
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        users = users.filter(id => id !== socket.id);
        const partner = users.find(id => id !== socket.id);
        if (partner) {
            io.to(partner).emit('hangUp');  // Notify the other user when one disconnects
        }
    });

    // When 'hangUp' is emitted, send it to the other user
    socket.on('hangUp', () => {
        const partner = users.find(id => id !== socket.id);
        if (partner) {
            io.to(partner).emit('hangUp');
        }
    });
});

// Start the server on port 3000
server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
