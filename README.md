# Enterprise Chat Platform

![Project Banner](https://github.com/user-attachments/assets/d8984424-a207-47a0-b6a8-48ae9a6afcc1)
> A production-grade, full-stack real-time communication platform built with scalability, security, and modern UI/UX principles in mind.

### [🌐 View Live Demo](https://fred-chat-app.vercel.app/)
> **Note:** The backend is hosted on a free-tier instance (Render), so the initial request might take **30-60 seconds** to wake up the server.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Node JS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?style=for-the-badge&logo=neon&logoColor=black)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
[![Live Demo](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://fred-chat-app.vercel.app/)

## 📖 Overview

This application demonstrates a clean-architecture approach to building complex real-time systems. Unlike simple chat demos, this project handles enterprise-level concerns such as **optimistic UI updates**, **strict validation**, **role-based privacy**, and **state deduplication** to ensure data integrity across WebSocket streams.

## ✨ Key Features

### 🎨 Modern UI/UX (Frontend)
* **Dynamic Theming:** Custom enterprise color palettes (Ocean, Midnight, Aurora) using HSL variables for real-time opacity handling.
* **Glassmorphism Design:** Modern aesthetic with backdrop blurs and responsive layouts.
* **Optimistic Updates:** Instant feedback for messages and interactions before server confirmation.
* **Smart Sidebar:** Real-time sorting based on activity, online status, and unread counters.
* **Media Handling:**
    * Image & Video support with strict client-side validation.
    * Custom video player overlays.
    * Lightbox view for attachments.

### 🛡️ Robust Architecture (Backend)
* **Scalable Socket Architecture:** `Socket <-> REST` bridging allows API controllers to emit real-time events.
* **Data Integrity:**
    * **Deduplication Layer:** Custom hooks ensure unique message/user rendering even during network hiccups.
    * **Atomic Transactions:** Prisma transactions ensure chat history and metadata remain synced.
* **Security & Privacy:**
    * **Zod Validation:** Strict schema validation for all inputs (Registration, Login, Messages).
    * **Privacy Mode:** Users can hide their online status/last seen.
    * **Blocking System:** Enterprise-grade blocking logic (restricts messages, profiles, and status updates).
* **Performance:**
    * Cloudinary integration for optimized media delivery.
    * Database indexing strategies for fast conversation retrieval.

## 🛠️ Tech Stack

### Frontend
* **Framework:** Next.js 15 (App Router)
* **State Management:** Zustand (Persisted Store)
* **Styling:** Tailwind CSS v4, Lucide React
* **Real-time:** Socket.io Client
* **Forms:** React Hook Form + Zod

### Backend
* **Runtime:** Node.js / Express
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Real-time:** Socket.io Server
* **Storage:** Cloudinary

---

## 📂 Project Structure

```text
chat-app-enterprise/
├── backend/
│   ├── src/
│   │   ├── config/         # DB & Cloudinary Config
│   │   ├── controllers/    # Request Handlers
│   │   ├── middlewares/    # Auth & File Upload (Multer)
│   │   ├── services/       # Business Logic (User, Chat)
│   │   └── routes/         # API Definitions
│   └── prisma/             # Schema & Migrations
│
└── frontend/
    ├── src/
    │   ├── app/            # Next.js Pages
    │   ├── components/     # Modular UI Components
    │   │   ├── auth/       # Login/Register Forms
    │   │   ├── chat/       # Sidebar, Window, Inputs
    │   │   └── modals/     # Profile, Block logic
    │   ├── hooks/          # Custom Hooks (useChatList, useSocket)
    │   ├── store/          # Zustand State Stores
    │   └── lib/            # Utilities (API, Date formatting)
```
## 📐 Architecture Highlights

### The "Socket-REST Bridge"
I utilize a pattern where the Socket.io instance is attached to the Express app. This allows standard REST controllers (like `updateProfile`) to broadcast real-time events (`user_update`) to connected clients without forcing the client to establish a separate socket emission.

### Deduplication Strategy
To prevent "ghost" messages or duplicate users in the sidebar—common issues in React `strict-mode` or poor network conditions—I implemented a custom `Map`-based deduplication layer within the `useChatList` and `useConversation` hooks.

### Modular Upload Middleware
I separated concerns for file uploads:
* **Profile:** Strict 1MB limit, Images only.
* **Chat Media:** Higher 5MB limit, Video/Images allowed.
  This logic lives in reusable middleware factories.
