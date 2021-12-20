# WebRTC_SFU
SFU(Selective Forwarding Unit) 서버 구현 - Hybrid P2P 서버
![Mesh_SFU_MCU](https://user-images.githubusercontent.com/30948477/146751325-1ba6aed2-e645-4404-8d9e-d5434527c747.png)

---
## 프로젝트 목적
1. Native WebRTC 를 이용해 SFU 서버 직접 구현
2. WebSocket을 이용해 Signaling 서버 직접 구현
3. Turn(with sturn) 서버 직접 구축 - coturn
4. Sinaling Server 와 SFU Server 를 분리해 MSA 구조 구현
5. 오픈소스 및 Node.js Useability Upgrade
---
## 사용 기술

#### Node.js, WebRTC, Socket.io, Coturn

---
## 서버 구조

![sfu구조이미지](https://user-images.githubusercontent.com/30948477/146756536-b32d0c83-9bb7-47f4-a189-a7f9757627e2.JPG)
