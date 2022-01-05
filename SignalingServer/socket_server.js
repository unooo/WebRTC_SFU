var roomToUsers = {};
var socketIdToRoom = {};
var SFUsocketID = null;
const maximum = process.env.MAXIMUM || 4;
module.exports = (socket, io) => {

    if (SFUsocketID)
        socket.emit("getSFUsocketID", SFUsocketID);

    socket.on('SFUAccess', (cb) => {
        SFUsocketID = socket.id;
        console.log('[SFUAccess] SFUsocketID: ' + SFUsocketID);
        if(cb)
            cb({status:"ok",SFUsocketID});
    })
    socket.on('join_room', (data,cb) => {
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
        console.log('[userInThisRoom]_Room Number[' + data.room + ']:');
        console.log(usersInThisRoom);

        //Download Stream 생성 시작
        io.sockets.to(socket.id).emit('all_users', usersInThisRoom);
        if(cb)
            cb({status:"ok"});
    });
    /* From client To SFU server */
    socket.on('offer', (data,cb) => {
        socket.to(data.offerReceiveID).emit('getOffer', data);        
        if(cb)
         cb({status:"ok"});
    });
    /* From SFU Server To Client */
    socket.on('answer', (data,cb) => {
        socket.to(data.answerReceiveID).emit('getAnswer', data);
        if(cb)
         cb({status:"ok"});
    });

    socket.on('candidate', (data,cb) => {
        socket.to(data.candidateReceiveID).emit('getCandidate', { candidate: data.candidate, candidateSendID: data.candidateSendID, mode: data.mode, targetSocketID: data.targetSocketID });
        if(cb)
         cb({status:"ok"});
    });
    socket.on('offerDisconnected', data => {
        const roomID = socketIdToRoom[socket.id];
        let offerUser = null;
        if (data.mode == "up")
            offerUser = { id: SFUsocketID };
        else
            offerUser = roomToUsers[roomID].filter(user => user.id == socket.id)[0];

        socket.to(data.offerSendAnswerId).emit('offerDisconnected', { offerUser, retryNum: data.retryNum, mode: data.mode });
        console.log('offerDisconnected : ');
        console.log(offerUser);
    });
    socket.on('newSenderEnter', (data,cb) => {
        console.log("newSenderEnter");
        let roomNumber = socketIdToRoom[data.socketID];
        socket.broadcast.to(roomNumber).emit('newSenderEnter', data);
        if(cb)
         cb({status:"ok"});
    });

    socket.on('exit', exitFunc);
    socket.on("disconnect", (reason) => {
        exitFunc();
        console.log("socket disconnected : " + reason);
        // socket.connect();
    });

    function exitFunc() {
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
        socket.to(SFUsocketID).emit('user_exit', { id: socket.id });
        console.log(`disconnected: ${roomToUsers}`);
    }
    return {
        roomToUsers,
        socketIdToRoom,
        SFUsocketID,
    }
}