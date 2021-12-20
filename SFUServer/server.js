const { io } = require("socket.io-client");
let socket = io('https://www.unoo.kro.kr', {
    transports: ['websocket'], //https://blog.joonas.io/62
    /*cors: { origin: ""}*/
});
socket.on('connect', function (socket) {
    console.log('Connected!');
});
socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect") {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
    }
    // else the socket will automatically try to reconnect
});
socket.on('error', (error) => {
    console.log("error:" + error);
});
socket.on("connect_error", (error) => {
    console.log(error);
});

