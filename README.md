# WebRTC 시리즈 3. WebRTC_SFU
**SFU(Selective Forwarding Unit)** 서버 구현 - Hybrid P2P 서버
![image](https://user-images.githubusercontent.com/30948477/147924185-dedabd4b-7c91-4c99-9b73-b43f028fb643.png)

###  WebRTC 시리즈 1.
+ CatchMind : https://github.com/unooo/CatchMind
###  WebRTC 시리즈 2. 
+ p2p SFU 서버 구현 :  https://github.com/unooo/WebRTC_Mesh
###  WebRTC 시리즈 4. 
+ CatchMind_Renewal :  https://github.com/unooo/CatchMind_Renewal

---
## 프로젝트 목적
### 1. WebRTC 기술 이해 및 Useability Upgrade
   - Native WebRTC 를 이용해 SFU 서버 직접 구현
### 2. WebSoccket 기술 이해 및 Useability Upgrade
   - WebSocket을 이용해 Signaling 서버 직접 구현
### 3. 오픈소스 Useability Upgrade
   - Turn(with sturn) 서버 직접 구축 - coturn
### 4. Node.js 및 백엔드 구조 설계 능력 Upgrade
   - Sinaling Server 와 SFU Server NodeJS로 구현
   - Sinaling Server 와 SFU Server 를 분리해 MSA 구조 구현
---
## 사용 기술

#### Node.js

#### WebRTC
- https://developer.mozilla.org/ko/docs/Web/API/WebRTC_API
- https://webrtc.github.io/samples/
#### Socket.io
- https://socket.io/docs/v4/
#### Coturn
- https://github.com/coturn/coturn
#### Docker
- https://hub.docker.com/r/instrumentisto/coturn
---
## 서버 구조

![sfu서버구조2](https://user-images.githubusercontent.com/30948477/147922715-e8815849-0442-4ea2-87c4-772164c4fcfc.jpg)

## 
