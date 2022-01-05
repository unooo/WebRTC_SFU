let express = require('express');
const spdy = require('spdy');
let app = express();
let fs = require('fs');
let my_socket_server = require('./socket_server');
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


const onSocketConnection =(socket)=>{
    my_socket_server(socket,io);
}
io.on('connection',onSocketConnection);

server.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
});