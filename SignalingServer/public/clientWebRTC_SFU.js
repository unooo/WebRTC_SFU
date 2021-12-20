const App = (localVideo,videoGrid ,connectionStateSpan) => {
    const pc_config_stun = {
        "iceServers": [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
            ,{'urls':'turn:58.238.248.102:3478','credential': 'myPw','username': 'myId'}
        ]
    }
    const pc_config_turn = {
        "iceServers": [
            { 'urls': 'turn:58.238.248.102:3478', 'credential': 'myPw', 'username': 'myId' }
            //{'urls':'turn:13.209.48.46:3478','credential': 'myPw','username': 'myId'}                    
        ]
    }
    const video_config = {
        width: 240,
        height: 240,
        margin: 5,
        backgroundColor: 'black',
    }

    const retryMax = 1;

    let pc_config = {};
    let pcs = {};
    let offers = [];
    let answers = [];
    let remoteVideos = [];
    let socket= io({ transports: ['websocket'] });
    socket.connect('https://www.unoo.kro.kr');

    socket.on('connect', () => {
        connectionStateSpan.innerText = "접속중";
    });

    socket.on("disconnect", (reason) => {
        connectionStateSpan.innerText = "접속 종료";
    });

    socket.on('all_users', (allUsers) => {
        allUsers.forEach(user=>createOffer(user,socket,localStream));
    });

    socket.on('getOffer', (data) => {
        createAnswer(data);
    });

    socket.on('getAnswer', (data) => {
        let pc = pcs[data.answerSendID];
        if (pc) 
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
    });

    socket.on('getCandidate', (data) => {
        console.log('get candidate');
        let pc = pcs[data.candidateSendID];
        if (pc) 
            pc.addIceCandidate(new RTCIceCandidate(data.candidate)).then(() => {
                console.log('candidate add success');
            });
        
    })

    socket.on('offerDisconnected', (data) => {
        //offer의 연결이 비정상으로 확인. 
        //answer가 offer로 재요청 시도.                
        console.log('get Disconnected');
        let delVideoFlag;
        if (data.retryNum > retryMax) {
            if (window.confirm("[연결실패]-연결시도 초과 \n 유료 연결을 요청하시겠습니까?(상대 동의 완료-turn 서버 사용)")) {
            data.retryNum = 0;
              delVideoFlag = true;
              pc_config.iceServers = pc_config_turn.iceServers;
            } else {
                peerExit(socketID, false);
                return;
            }
        } else {
            let videoTag = document.getElementById(data.offerUser.id + "-idTag");
            videoTag.innerHTML = "[연결실패]-재시도 횟수 :" + (data.retryNum) + "/" + retryMax;
            delVideoFlag = false;
        }
        let pc = pcs[data.offerUser.id];
        if (pc)
            peerExit(data.offerUser.id, delVideoFlag);
        createOffer(data.offerUser, socket, localStream);
    })

    socket.on('user_exit', async (data) => {
        console.log("peer exit");
        if (data.id == socket.id)
            socket = io({ transports: ['websocket'] }).connect('https://www.unoo.kro.kr');
        
        peerExit(data.id, true);
    })

    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
            width: 240,
            height: 240
        }
    }).then(stream => {
        if (localVideo) localVideo.srcObject = stream;
        pc_config.iceServers = pc_config_stun.iceServers;
        localStream = stream;
        socket.emit('join_room', { room: '1234', email: 'sample@naver.com' });
    }).catch(error => {
        console.log(`getUserMedia error: ${error}`);
    });
    const createOffer = (user, socket, localStream) => {
        console.log('create offer');
        createPeerConnection(user.id, user.email, socket, localStream);
        let pc = pcs[user.id];
        answers.push(user.id);
        if (pc) {
            pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
                .then(sdp => {
                    console.log('create offer success');
                    pc.setLocalDescription(new RTCSessionDescription(sdp));
                    socket.emit('offer', {
                        sdp: sdp,
                        offerSendID: socket.id,
                        offerSendEmail: 'offerSendSample@sample.com',
                        offerReceiveID: user.id
                    });
                })
                .catch(error => {
                    console.log(error);
                })
        }
    }

    const createAnswer = (data) => {
        console.log('create answer');
        createPeerConnection(data.offerSendID, data.offerSendEmail, socket, localStream);
        let pc = pcs[data.offerSendID];
        offers.push(data.offerSendID);
        if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                console.log('answer set remote description success');
                pc.createAnswer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
                    .then(sdp => {
                        console.log('create answer success');
                        pc.setLocalDescription(new RTCSessionDescription(sdp));
                        socket.emit('answer', {
                            sdp: sdp,
                            answerSendID: socket.id,
                            answerReceiveID: data.offerSendID
                        });
                    })
                    .catch(error => {
                        console.log(error);
                    })
            })
        }

    }
    const createPeerConnection = (socketID, email, socket, localStream) => {
        // add pc to peerConnections object
        let pc = new RTCPeerConnection(pc_config);                
        pcs[socketID] = pc;
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log('onicecandidate');
                socket.emit('candidate', {
                    candidate: e.candidate,
                    candidateSendID: socket.id,
                    candidateReceiveID: socketID
                });
            }
        }

        pc.onconnectionstatechange = (e) => {
            console.log("onconnectionstatechange:" + pc.connectionState);
            let videoTag = document.getElementById(socketID + "-idTag");
            switch (pc.connectionState) {
                case "connected":
                    // The connection has become fully connected                            
                    // videoTag.innerHTML=videoTag.getAttribute('data-email');
                    videoTag.setAttribute("data-retryNum",0)
                    videoTag.innerHTML = socketID;
                    break;
                case "disconnected":
                    ;
                    break;
                case "failed":
                    // One or more transports has terminated unexpectedly or in an error                          
                    let retryNum = parseInt(videoTag.getAttribute("data-retryNum")) + 1;
                    videoTag.setAttribute("data-retryNum", retryNum);
                    videoTag.innerHTML = "[연결실패]-재시도 횟수 :" + (retryNum) + "/" + retryMax;
                    for (let i = 0; i < answers.length; i++) {
                        if (answers[i] == socketID) {
                            let delVideoFlag;
                            if (retryNum > retryMax) {
                                if (window.confirm("[연결실패]-연결시도 초과 \n 유료 연결을 요청하시겠습니까?(상대 동의시 연결)")) {
                                    pc_config.iceServers = pc_config_turn.iceServers;
                                    delVideoFlag = true;
                                } else {
                                    peerExit(socketID, false);
                                    return;
                                }
                            } else {
                                delVideoFlag = false;
                            }
                            peerExit(socketID, delVideoFlag);
                            socket.emit('offerDisconnected', {
                                offerSendOfferId: socket.id,//myId
                                offerSendAnswerId: socketID,
                                retryNum: retryNum
                            });
                        }
                    }
                    break;
                case "closed":
                    // The connection has been closed                          
                    ;
                    break;
            }

        }

        pc.oniceconnectionstatechange = (e) => {
            //disconnected는 새로고침이나 뒤로가기등등에 적용됨      
            console.log("oniceconnectionstatechange : " + pc.iceConnectionState);
            if (pc.iceConnectionState === "failed") {
                //pc.restartIce();     
                //이거 안먹힘
            } else if (pc.connectionState != 'connecting' && pc.iceConnectionState === "disconnected") {
                //정상 연결중 새로고침
            }
            else if (pc.connectionState == 'connecting' && pc.iceConnectionState === "disconnected") {
                //alert("확인코드 pc.iceConnectionState:"+pc.iceConnectionState +"\n pc.connectionState: "+pc.connectionState);
                // socket.emit('offerDisconnected', {
                //         offerSendID: socket.id,
                // });
            } else if (pc.iceConnectionState === "closed") {
                //alert("closed pc.iceConnectionState:"+pc.iceConnectionState +"\n pc.connectionState: "+pc.connectionState);
            }
            else {
                //alert("pc.iceConnectionState:"+pc.iceConnectionState +"\n pc.connectionState: "+pc.connectionState);
            }

        }

        pc.ontrack = (e) => {
            console.log('ontrack success');
            remoteVideo = remoteVideos.filter(user => user.id == socketID)[0];
            if (!remoteVideo) {
                // some thing wrong
                makeOtherVideo(socketID, email);
            } else {
                remoteVideo.srcObject = e.streams[0];
            }
        }

        if (localStream) {
            console.log('localstream add');
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        } else {
            console.log('no local stream');
            alert('no local stream');
        }
        return pc;
    }
    function peerExit(socketID, delVideoFlag) {
        pcs[socketID].close();
        delete pcs[socketID];
        for (let i = 0; i < answers.length; i++) {
            if (offers[i] == socketID)
                delete offers[i];
            if (answers[i] == socketID)
                delete answers[i];
        }
        if (delVideoFlag)
            removeVideo(socketID);
    }

    function makeOtherVideo(socketID, email) {
        /*Set Video Outer*/
        let divOuter = document.createElement('div');
        divOuter.style.float = "left";
        /*Set Video Tag*/
        let idTag = document.createElement('div');
        idTag.id = socketID + '-idTag';

        idTag.innerHTML += "loading";
        idTag.setAttribute('data-email', email);
        idTag.setAttribute("data-retryNum", 0);
        /*Set Video */
        const video = document.createElement('video');
        Object.assign(video.style, video_config);
        video.setAttribute('playsinline', true);
        video.setAttribute('autoplay', true);
        video.id = socketID;
        video.setAttribute('data-email', email);
        video.poster = "https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif";
        remoteVideos.push(video);
        /*Append Element*/
        divOuter.append(video);
        divOuter.append(idTag);
        document.body.append(divOuter);

    }
    function removeVideo(socketID) {
        for (let i = 0; i < remoteVideos.length; i++) {
            let delVideo = remoteVideos[i];
            if (delVideo.id != socketID)
                continue;
            remoteVideos.splice(i, 1);
            let parent = delVideo.parentNode;
            parent.remove();
            break;
        }
    }
    return {
        socket,
        pcs,
        offers,
        answers,
        remoteVideos,
        pc_config
    }
};