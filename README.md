# WebRTC_SFU
SFU(Selective Forwarding Unit) 서버 구현 - Hybrid P2P 서버
![Mesh_SFU_MCU](https://user-images.githubusercontent.com/30948477/146751325-1ba6aed2-e645-4404-8d9e-d5434527c747.png)

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
- https://hub.docker.com/r/instrumentisto/coturn
---
## 서버 구조

![sfu서버구조2](https://user-images.githubusercontent.com/30948477/147922715-e8815849-0442-4ea2-87c4-772164c4fcfc.jpg)
