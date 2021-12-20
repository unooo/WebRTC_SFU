let express = require('express');
const spdy = require('spdy');
let app = express();
let fs = require('fs');
var options = {
    key: fs.readFileSync('www.unoo.kro.kr-key.pem'),
    cert: fs.readFileSync('www.unoo.kro.kr-crt.pem'),
    ca: fs.readFileSync('www.unoo.kro.kr-chain.pem'),
    requestCert: false,
    rejectUnauthorized: false,
};
const server = spdy.createServer(options, app);
const io = require("socket.io")(server, {
    transports: ['websocket'],
    /*cors: {
      origin: "",
      methods: ["GET", "POST"]
    }*/
});

const PORT = process.env.PORT || 443;
app.set('view engine', 'ejs');
app.get('/', function (request, response) {
    response.render('main');
})
app.use(express.static('public'));

let roomToUsers = {};
let socketIdToRoom = {};
const maximum = process.env.MAXIMUM || 4;

io.on('connection', socket => {
    socket.on('join_room', data => {
        if (roomToUsers[data.room]) {
            const length = roomToUsers[data.room].length;
            if (length === maximum) {
                socket.to(socket.id).emit('room_full');
                return;
            }
            roomToUsers[data.room].push({ id: socket.id, email: data.email });
        } else {
            roomToUsers[data.room] = [{ id: socket.id, email: data.email }];
        }
        socketIdToRoom[socket.id] = data.room;

        socket.join(data.room);
        console.log(`[${socketIdToRoom[socket.id]}]: ${socket.id} enter`);

        const usersInThisRoom = roomToUsers[data.room].filter(user => user.id !== socket.id);
        console.log('userInThisRoom:');
        console.log(usersInThisRoom);

        io.sockets.to(socket.id).emit('all_users', usersInThisRoom);
    });

    socket.on('offer', data => {
        //console.log(data.sdp);
        socket.to(data.offerReceiveID).emit('getOffer', { sdp: data.sdp, offerSendID: data.offerSendID, offerSendEmail: data.offerSendEmail });
    });

    socket.on('answer', data => {
        //console.log(data.sdp);
        socket.to(data.answerReceiveID).emit('getAnswer', { sdp: data.sdp, answerSendID: data.answerSendID });
    });

    socket.on('candidate', data => {
        //console.log(data.candidate);
        socket.to(data.candidateReceiveID).emit('getCandidate', { candidate: data.candidate, candidateSendID: data.candidateSendID });
    });
    socket.on('offerDisconnected', data => {
        const roomID = socketIdToRoom[socket.id];
        let offerUser = roomToUsers[roomID].filter(user => user.id == socket.id)[0];
        socket.to(data.offerSendAnswerId).emit('offerDisconnected', { offerUser: offerUser, retryNum: data.retryNum });
        console.log('offerDisconnected : ');
        console.log(offerUser);
    });

    socket.on('exit', () => {
        console.log(`[${socketIdToRoom[socket.id]}]: ${socket.id} exit`);
        const roomID = socketIdToRoom[socket.id];
        let room = roomToUsers[roomID];
        if (room) {
            room = room.filter(user => user.id !== socket.id);
            roomToUsers[roomID] = room;
            if (room.length === 0) {
                delete roomToUsers[roomID];
                return;
            }
        }
        socket.to(roomID).emit('user_exit', { id: socket.id });
        console.log(`disconnected: ${roomToUsers}`);
    });
    socket.on("disconnect", (reason) => {
        console.log("socket disconnected : "+ reason);
    });
});

server.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
});