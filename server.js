const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let waitingUser = null; // To track the user waiting for a connection

// Serve static files from the 'public' folder
app.use(express.static('public'));

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Check if there is a waiting user
    if (waitingUser) {
        // Pair the users by putting them in the same "room"
        const room = `${waitingUser}-${socket.id}`;
        socket.join(room);
        io.to(waitingUser).emit('partnerFound', socket.id); // Notify the waiting user
        socket.emit('partnerFound', waitingUser); // Notify the new user
        socket.room = room; // Save room info on the socket object
        waitingUser = null; // Clear waiting user
    } else {
        // No one is waiting, set this user as the waiting user
        waitingUser = socket.id;
    }

    // Handle offers (send it to the specific partner in the room)
    socket.on('offer', (offer, partnerId) => {
        console.log('Offer received from:', socket.id, 'to:', partnerId);
        io.to(partnerId).emit('offer', offer);
    });

    // Handle answers (send it to the specific partner in the room)
    socket.on('answer', (answer, partnerId) => {
        console.log('Answer received from:', socket.id, 'to:', partnerId);
        io.to(partnerId).emit('answer', answer);
    });

    // Handle ICE candidates (send to the specific partner in the room)
    socket.on('candidate', (candidate, partnerId) => {
        console.log('ICE candidate received from:', socket.id, 'to:', partnerId);
        io.to(partnerId).emit('candidate', candidate);
    });

    // Handle hang-ups
    socket.on('hangUp', (partnerId) => {
        console.log('Hang Up received from:', socket.id, 'to:', partnerId);
        io.to(partnerId).emit('hangUp'); // Notify the other user
        socket.leave(socket.room); // Leave the room
        socket.room = null; // Clear room info
    });

    // Handle disconnect events
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
        
        // If the user was waiting, clear the waiting state
        if (waitingUser === socket.id) {
            waitingUser = null;
        } else if (socket.room) {
            // Notify the other user in the room to hang up
            socket.to(socket.room).emit('hangUp');
        }
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
