let wrtc = require("wrtc");
const adapter = require("webrtc-adapter");
const { io } = require("socket.io-client");
let socket = io('https://www.unoo.kro.kr', {
    transports: ['websocket'], //https://blog.joonas.io/62
    /*cors: { origin: ""}*/
});
const pc_config_stun = {
    "iceServers": [
        { urls: 'stun:stun.l.google.com:19302' }
        ,
        { urls: 'turn:58.238.248.102:3478', 'credential': 'myPw', 'username': 'myId' }
    ]
}
const pc_config_turn = {
    "iceServers": [
        { 'urls': 'turn:58.238.248.102:3478', 'credential': 'myPw', 'username': 'myId' }
        //{'urls':'turn:13.209.48.46:3478','credential': 'myPw','username': 'myId'}                    
    ]
}
let receiverPCs = {};   //format : receiverPCs[sender-socketID] = {receiver-socketID :RTCPeerConnection }
let senderPCs = {};     //format : senderPCs[socketID] = RTCPeerConnection
let senderStream = {};  //format : senderStream[socketID] = Stream
let retryNums = {};       //format : retryNums[socketID] = Number;
let pc_configs = {};         //format : configs[socketID] = pc_config;
let offers = [];
let answers = [];
const retryMax = 1;

socket.on('connect', () => {
    console.log('[Signal Server Connected] my socket id :' + socket.id);
    socket.emit('SFUAccess',(args)=>{
        console.log(args);
    });
});

socket.on('getOffer', (data) => {
    createAnswer(data);
});

socket.on('getCandidate', async (data) => {
    // console.log('get candidate');
    let pc = null;
    if (data.mode == "up") {
        pc = senderPCs[data.candidateSendID];
    } else {
        pc = (receiverPCs[data.candidateSendID])[data.targetSocketID];
    }

    if (pc)
        pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate)).then(() => {
            console.log(data.mode + 'candidate add success');
        }).catch(err => {
            console.error(err);
        });
    else {
        console.error("Cannot Find Peer Connection Error_Client Runtime Error");
    }
})
/*소켓 연결이 끊긴 상대에 대한 처리 리스너*/
socket.on('user_exit', async (data) => {
    console.log("peer exit");
    peerExit(data.id);
})

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
socket.on('offerDisconnected', (data) => {  
    doRetryPeerConnection(data);
});

const doRetryPeerConnection = (data)=>{
    try {
        if(data.mode=='up'){
            if(! senderPCs[data.offerSendId])
                return;
            senderPCs[data.offerSendId].close();
            delete senderPCs[data.offerSendId];
        }else{
            if(!!(receiverPCs[data.offerSendId])||!(receiverPCs[data.offerSendId])[data.targetSocketID])
                return;
            (receiverPCs[data.offerSendId])[data.targetSocketID].close();
            delete (receiverPCs[data.offerSendId])[data.targetSocketID];        
        }
    
        for (let i = 0; i < answers.length; i++) {
            if (offers[i] == data.offerSendId)
                delete offers[i];
            if (answers[i] == data.offerSendId)
                delete answers[i];
        }
        
    } catch (error) {
        console.log(error);
    }
    socket.emit("doReTry",data);
}


const createAnswer = async (data) => {
    console.log('create answer');
    let targetStream = data.mode == "up" ? null : senderStream[data.targetSocketID];
    console.debug(data.targetSocketID + " targetStream:" + targetStream);
    let pc = createPeerConnection(data.offerSendID, data.offerSendEmail, socket, targetStream, data.mode, data.targetSocketID);

    offers.push(data.offerSendID);
    if (pc) {
        try {
            await pc.setRemoteDescription(new wrtc.RTCSessionDescription(data.sdp)).then(() => {
                let offerBoolOpt = data.mode == "up" ? true : false;
                pc.createAnswer({ offerToReceiveVideo: offerBoolOpt, offerToReceiveAudio: offerBoolOpt }).then(sdp => {
                    pc.setLocalDescription(new wrtc.RTCSessionDescription(sdp));
                    socket.emit('answer', {
                        sdp: sdp,
                        answerSendID: socket.id, // SFU 서버의 소켓 아이디로 고정
                        answerReceiveID: data.offerSendID,
                        mode: data.mode,
                        targetSocketID: data.targetSocketID
                    });
                })
            }).catch(error => {
                console.error(error);
            });
        }
        catch (error) {
            console.error(error);
        }
    } else {
        console.error("Cannot Find Peer Connection Error_Client Runtime Error");
    }

}

const createPeerConnection = (socketID, email, socket, targetStream, mode, targetSocketID) => {
    let pc = new wrtc.RTCPeerConnection(pc_configs[socketID]);
    console.log("mode:" + mode);
    if (mode == "up") {
        if (senderPCs[socketID]) {
            console.error("sender pc duplicate error occur");
        }

        senderPCs[socketID] = pc;
        receiverPCs[socketID] = {};
    } else {
        if ((receiverPCs[socketID])[targetSocketID])
            console.error("receiver pc dupliccate error occur");
        (receiverPCs[socketID])[targetSocketID] = pc;
    }
    pc_configs[socketID] = {};
    pc_configs[socketID].iceServers = pc_config_turn.iceServers; //고치긴해야될듯
    retryNums[socketID] = 0;
    pc.onicecandidate = (e) => {
        console.log(mode + " createPC and candidate");
        if (e.candidate) {
            socket.emit('candidate', {
                candidate: e.candidate,
                candidateSendID: socket.id,// SFU 서버의 소켓 아이디로 고정
                candidateReceiveID: socketID,
                mode,
                targetSocketID //up일땐 SFU 서버 소켓아이디
            });
        }
    }

    pc.onconnectionstatechange = (e) => {
        console.log("onconnectionstatechange:" + pc.connectionState);
        switch (pc.connectionState) {
            case "connected":
                if (mode == "up") {                    
                    socket.emit("newSenderEnter", { socketID, email });
                }
                break;
            case "disconnected":
                ;
                break;
            case "failed":
                console.error("failed ", "SendSocketID : " + socketID, ", SFUSocketID: " + socket.id, ", Mode: " + mode, ", TargetSocketID: " + targetSocketID);
                // One or more transports has terminated unexpectedly or in an error                          
                doRetryPeerConnection({offerSendOfferId:socketID,offerSendAnswerId:socket.id,mode,targetSocketID});
                break;
            case "closed":
                // The connection has been closed                          
                ;
                break;
            default:
                console.error(pc.connectionState);
        }
    }

    pc.oniceconnectionstatechange = (e) => {
        //disconnected는 새로고침이나 뒤로가기등등에 적용됨      
        console.log("oniceconnectionstatechange : " + pc.iceConnectionState);
        if (pc.iceConnectionState === "failed") {
        } else if (pc.connectionState != 'connecting' && pc.iceConnectionState === "disconnected") {
            //정상 연결중 새로고침
        } else if (pc.connectionState == 'connecting' && pc.iceConnectionState === "disconnected") {
        } else if (pc.iceConnectionState === "closed") {
        } else {
        }
    }

    // 업로드일 때만 수행되는 이벤트
    pc.ontrack = (e) => {
        console.log('ontrack success');
        senderStream[socketID] = e.streams[0];
    }

    // 다운로드 일때만 수행되는 분기문
    if (mode == 'down') {
        if (targetStream) {
            console.log('targetStream add');
            targetStream.getTracks().forEach(track => {
                pc.addTrack(track, targetStream);
                console.log("add track success");
            });
        } else {
            console.error('no target stream');
        }
    }
    return pc;
}

function peerExit(socketID) {

    senderPCs[socketID].close();
    delete senderPCs[socketID];

    for (let targetSocketID in (receiverPCs[socketID])) {
        (receiverPCs[socketID])[targetSocketID].close();
        delete (receiverPCs[socketID])[targetSocketID];
    }

    for(let outerSocketID in receiverPCs ){
        for(let innerSocketID in receiverPCs[outerSocketID]){
            if(innerSocketID==socketID){
                (receiverPCs[outerSocketID])[innerSocketID].close();
                 delete (receiverPCs[outerSocketID])[innerSocketID];
            }
        }
    }

    for (let i = 0; i < answers.length; i++) {
        if (offers[i] == socketID)
            delete offers[i];
        if (answers[i] == socketID)
            delete answers[i];
    }

}