const App = (localVideo, videoGrid, connectionStateSpan, email) => {
    const pc_config_stun = {
        "iceServers": [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
            , { 'urls': 'turn:58.238.248.102:3478', 'credential': 'myPw', 'username': 'myId' }
        ]
    }
    const pc_config_turn = {
        "iceServers": [
            { 'urls': 'turn:58.238.248.102:3478', 'credential': 'myPw', 'username': 'myId' }
            //{'urls':'turn:13.209.48.46:3478','credential': 'myPw','username': 'myId'} //AWS Tern Server                   
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
    let SFUsocketID;
    let socket = io({ transports: ['websocket'] });
    socket.connect('https://www.unoo.kro.kr');
    let localStream;

    socket.on('connect', () => {
        connectionStateSpan.innerText = "접속중";
    });
    socket.on("disconnect", (reason) => {
        connectionStateSpan.innerText = "접속 종료";
        console.log(reason);
    });

    /*SFU서버의 소켓 아이디 초기화 이벤트 리스너*/
    socket.on('getSFUsocketID', sId => {
        SFUsocketID = sId;
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

            /* uploadStream 생성 시작 */
            createOffer({ id: SFUsocketID, email }, socket, localStream, "up");

            setTimeout(function () {
                /* downloadStream 생성 시작 */
                socket.emit('join_room', { room: '1234', email });
            }, 0);

        }).catch(error => {
            console.error(`getUserMedia error: ${error}`);
            alert("getUserMedia error");
        });
    });

    /* Receiver - 기 접속자에 대한 DownStream Peer 생성  */
    socket.on('all_users', (allUsers) => {
        allUsers.forEach(user => createOffer(user, socket, null, "down"));
    });

    /* Receiver - 신규 접속자에 대한 DownStream Peer 생성  */
    socket.on('newSenderEnter', data => {
        if (data.socketID == socket.id)
            return;
        createOffer({ id: data.socketID, email: data.email }, socket, null, "down");
    });


    /* 클라이언트가 SFU 서버에 보낸 Offer에 대한 SFU 서버의 Answer를 받는 이벤트 리스너 */
    /* 즉 서버가 정상적으로 offer를 받고 answer를 보냈음이 보장 */
    socket.on('getAnswer', async (data) => {
        console.log("getAnswer");
        let pc = pcs[data.targetSocketID]; // 논란
        if (pc) {
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                console.log("success");
            }).catch((error) => {
                console.error(error);
            });
        } else {
            console.error("Cannot Find Peer Connection Error_Client Runtime Error");
            alert("오류발생 - 관리자 문의 요청 ");
        }
    });

    /* Ice 수행 과정 */
    /* 상대 RTCPeerConnection에서 생성된 Candidaate를 내 RTCPeerConnection에 추가하는 리스너*/
    socket.on('getCandidate', async (data) => {
        console.log('get candidate');
        let pc = pcs[data.targetSocketID]; // 논란
        if (pc) {
            pc.addIceCandidate(new RTCIceCandidate(data.candidate)).then(() => {
                console.log('candidate add success');
            }).catch(err => {
                console.error(err);
            });
        } else {
            console.error("Cannot Find Peer Connection Error_Client Runtime Error");
            alert("오류발생 - 관리자 문의 요청 ");
        }
    })

    /*소켓 연결이 끊긴 상대에 대한 처리 리스너*/
    socket.on('user_exit', async (data) => {
        console.log("peer exit");
        peerExit(data.id, true);
    });

    socket.on('doRetry',(data)=>{
        if (data.mode == 'up') {
            /* uploadStream 재생성 시작 */
            createOffer({ id: SFUsocketID, email }, socket, localStream, "up");
        } else {
            /* downloadStream 재생성 시작 */
            createOffer({ id: data.targetSocketID, email: data.email }, socket, null, "down");
        }

    });

    const createOffer = async (user, socket, stream, mode) => {
        console.log('create offer, mode : ' + mode);
        let pc = createPeerConnection(user.id, user.email, socket, stream, mode);
        answers.push(user.id);
        if (pc) {

            let offerBoolOpt = mode == "up" ? false : true;
            pc.createOffer({ offerToReceiveAudio: offerBoolOpt, offerToReceiveVideo: offerBoolOpt }).then(sdp => {
                console.log('create offer success');
                pc.setLocalDescription(new RTCSessionDescription(sdp)).then(() => {
                    //  if (mode == 'down')
                    //      alert(JSON.stringify(sdp));

                    socket.emit('offer', {
                        sdp: sdp,
                        offerSendID: socket.id,
                        offerSendEmail: 'offerSendSample@sample.com',
                        offerReceiveID: SFUsocketID, // SFU 서버의 소켓 아이디로 고정
                        mode,
                        targetSocketID: user.id
                    });
                }).catch((err) => alert(err));

            }).catch(error => {
                console.error(error);
                alert();
            });
        } else {
            console.error("Cannot Find Peer Connection Error_Client Runtime Error");
            alert("오류발생 - 관리자 문의 요청 ");
        }
    }


    const createPeerConnection = (socketID, email, socket, stream, mode) => {
        let pc = new RTCPeerConnection(pc_config);
        if (pcs[socketID]) {
            // debugger;
            // alert("pc duplicate error occur");
        }

        pcs[socketID] = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                console.log(mode + ' onicecandidate');
                socket.emit('candidate', {
                    candidate: e.candidate,
                    candidateSendID: socket.id,
                    candidateReceiveID: SFUsocketID, // SFU 서버의 소켓 아이디로 고정
                    mode,
                    targetSocketID: socketID
                });
            }
        }

        pc.onconnectionstatechange = (e) => {
            console.log("onconnectionstatechange:" + pc.connectionState);
            console.log("mode:" + mode);
            let videoTag = mode == 'down' ? document.getElementById(socketID + "-idTag") : localVideo;
            switch (pc.connectionState) {
                case "connected":
                    if (!videoTag) {
                        videoTag = makeOtherVideo(socketID, email).idTag;
                    }
                    videoTag.setAttribute("data-retryNum", 0);
                    videoTag.innerHTML = socketID; //SFUsocketID 와 동일
                    break;
                case "disconnected":
                    ;
                    break;
                case "failed":
                    console.error("failed");
                    // One or more transports has terminated unexpectedly or in an error
                    peerExit(socketID, delVideoFlag);
                    let retryNum = videoTag.getAttribute("data-retryNum");
                    if(retryNum>retryMax){
                        alert("연결불가, 최대연결재시도 횟수 초과");
                        return ;
                    }
                    videoTag.setAttribute("data-retryNum", retryNum+1);                    
                    socket.emit('offerDisconnected', {
                        offerSendOfferId: socket.id,//myId
                        offerSendAnswerId: SFUsocketID, // SFU 서버의 소켓아이디로 고정                       
                        mode,
                        targetSocketID: socketID
                    });
                    break;
                case "closed":
                    // The connection has been closed                          
                    ;
                    break;
            }
        }


        pc.oniceconnectionstatechange = (e) => {
            //disconnected는 새로고침이나 뒤로가기등등에 적용됨 
            console.log(mode + " " + pc.iceConnectionState);
            console.log("oniceconnectionstatechange : " + pc.iceConnectionState);
            if (pc.iceConnectionState === "failed") {
            } else if (pc.connectionState != 'connecting' && pc.iceConnectionState === "disconnected") {
                //정상 연결중 새로고침
            } else if (pc.connectionState == 'connecting' && pc.iceConnectionState === "disconnected") {
            } else if (pc.iceConnectionState === "closed") {
            } else {
            }
        }

        /* 다운로드일 때만 수행되는 이벤트 - Stream 수신 */
        pc.ontrack = (e) => {
            console.log('ontrack success');
            let remoteVideo = remoteVideos.filter(user => user.id == socketID)[0];
            if (!remoteVideo) {
                remoteVideo = makeOtherVideo(socketID, email).video;
            }

            remoteVideo.srcObject = e.streams[0];

        }

        /* 업로드 일때만 수행되는 분기문 - Stream 송신 */
        /* 하지만 모바일 기종에서 pc.addTrack 하지 않는경우 sdp 오류 발생 하므로 하단의 if 조건 주석처리 */
        //if (mode == 'up') 
        if (localStream) {
            console.log('localstream add');
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        } else {
            console.error('no local stream');
            alert('no local stream');
        }

        return pc;
    }

    function peerExit(socketID, delVideoFlag) {
        if(pcs[socketID]){
            pcs[socketID].close();
            delete pcs[socketID];
        }
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
        return { video, idTag };
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