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

    /* 현재 Client에서 불리지 않는 이벤트 */
    socket.on('getOffer', (data) => {
        createAnswer(data);
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

    /* SFU Server가 Offer일때 연결이 Failed라면 Answer였던 클라이언트가 Offer로, Offer였던 SFU서버가 Answer로 통신하도록 하는 리스너  */
    /*
    socket.on('offerDisconnected', (data) => {
        console.log('get offerDisconnected');
        let delVideoFlag;
        if (data.retryNum > retryMax) {
            if (window.confirm("[연결실패]-연결시도 초과 \n 유료 연결을 요청하시겠습니까?(turn 서버 사용)")) {
                data.retryNum = 0;
                delVideoFlag = true;
                pc_config.iceServers = pc_config_turn.iceServers;
            } else {
                peerExit(data.socketID, false); // 고쳐야할듯                
                return;
            }
        } else {
            let videoTag = mode == 'down' ? document.getElementById(socketID + "-idTag") : localVideo;
            videoTag.innerHTML = "[연결실패]-재시도 횟수 :" + (data.retryNum) + "/" + retryMax;
            delVideoFlag = false;
        }
        if (mode == 'up') delVideoFlag = false;
        let pc = pcs[data.offerUser.id];
        if (pc) {
            peerExit(data.offerUser.id, delVideoFlag);
        } else {
            console.error("Cannot Find Peer Connection Error_Client Runtime Error");
            alert("오류발생 - 관리자 문의 요청 ");
        }
        createOffer(data.offerUser, socket, localStream);
    })
*/
    /*소켓 연결이 끊긴 상대에 대한 처리 리스너*/
    socket.on('user_exit', async (data) => {
        console.log("peer exit");
        peerExit(data.id, true); 
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

    // const createAnswer = async (data) => {
    //     console.log('create answer');
    //     createPeerConnection(data.offerSendID, data.offerSendEmail, socket, localStream,data.mode);
    //     let pc = pcs[data.offerSendID];
    //     offers.push(data.offerSendID);
    //     if (pc) {
    //         await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    //         console.log('answer set remote description success');

    //         try {
    //             let offerBoolOpt = data.mode=="up"? true : false;
    //             let sdp = await pc.createAnswer({ offerToReceiveVideo: offerBoolOpt, offerToReceiveAudio: offerBoolOpt });
    //             console.log('create answer[sdp] success');

    //             pc.setLocalDescription(new RTCSessionDescription(sdp));
    //             socket.emit('answer', {
    //                 sdp: sdp,
    //                 answerSendID: socket.id,
    //                 answerReceiveID: SFUsocketID, // SFU 서버의 소켓 아이디로 고정
    //                 mode,
    //                 targetSocketID : data.offerSendID
    //             });
    //         }
    //         catch (error) {
    //             console.log(error);
    //         }

    //     }

    // }
    const createPeerConnection = (socketID, email, socket, stream, mode) => {
        let pc = new RTCPeerConnection(pc_config);
        if (pcs[socketID]){
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
                    if (!videoTag){
                        videoTag = makeOtherVideo(socketID, email).idTag;
                    }
                    videoTag.setAttribute("data-retryNum", 0)
                    videoTag.innerHTML = socketID; //SFUsocketID 와 동일
                    break;
                case "disconnected":
                    ;
                    break;
                case "failed":
                    console.error("failed");                   
                    /*
                    // One or more transports has terminated unexpectedly or in an error                          
                    let retryNum = parseInt(videoTag.getAttribute("data-retryNum")) + 1;
                    videoTag.setAttribute("data-retryNum", retryNum);
                    videoTag.innerHTML = "[SFU 서버와 RTCPeer 연결실패]-재시도 횟수 :" + (retryNum) + "/" + retryMax;
                    for (let i = 0; i < answers.length; i++) {
                        if (answers[i] == socketID) {
                            let delVideoFlag = false;
                            if (retryNum > retryMax) {
                                if (window.confirm("[SFU 서버와 RTCPeer 연결실패]-연결시도 초과 \n 유료 연결을 요청하시겠습니까?")) {
                                    pc_config.iceServers = pc_config_turn.iceServers;
                                    delVideoFlag = true;
                                } else {
                                    peerExit(socketID, false);
                                    return;
                                }
                            }
                            if(mode=='up') delVideoFlag = false;

                            peerExit(socketID, delVideoFlag);
                            socket.emit('offerDisconnected', {
                                offerSendOfferId: socket.id,//myId
                                offerSendAnswerId: SFUsocketID, // SFU 서버의 소켓아이디로 고정
                                retryNum: retryNum,
                                mode,
                                targetSocketID: socketID
                            });
                        }
                    }
                    */
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
                remoteVideo= makeOtherVideo(socketID, email).video;
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
        return {video,idTag};
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