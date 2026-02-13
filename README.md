# Local Buzzer System Backend

Real-time backend server for the Local Buzzer System game show application. Built with Node.js, Express, Socket.IO, and PostgreSQL.

## Features

- **Real-time Gameplay**: Low-latency buzzer system using Socket.IO
- **Game Management**: Create, join, and manage game rooms
- **Persistence**: Store game history and player stats in PostgreSQL
- **REST API**: Endpoints for server statistics and room management
- **Production Ready**: Rate limiting, security headers, logging, and Docker support

## Prerequisites

- Node.js (v18+)
- Docker and Docker Compose (optional, for containerized run)
- PostgreSQL (if running locally without Docker)

## Getting Started

### 1. Clone & Install

```bash
cd buzzer_app_backand
npm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your database credentials if running locally.

### 3. Database Setup

If you have Docker installed, you can start a database easily:

```bash
docker-compose up -d postgres
```

Then run migrations:

```bash
npm run db:migrate
```

### 4. Running the Server

**Development Mode:**
```bash
npm run dev
```

**Production Build:**
```bash
npm run build
npm start
```

## Docker Deployment

To run the entire stack (Server + Database) with Docker:

```bash
docker-compose up --build -d
```

The server will be available at `http://localhost:5000`.

## API Documentation

### Socket.IO Events

- `create_room(hostName)` -> Returns `{ code }`
- `join_room(code, playerName)` -> Returns `{ success, room }`
- `buzz(timestamp)`
- `reset_buzzers()`
- `start_game()`

### REST API

- `GET /api/health` - Server health check
- `GET /api/stats` - Global server statistics
- `GET /api/rooms` - List active rooms
