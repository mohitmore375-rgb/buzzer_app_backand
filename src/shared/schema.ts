import { z } from "zod";

export type ConnectionMode = "local" | "online";

export const ConnectionModeSchema = z.enum(["local", "online"]);

export interface LocalServerInfo {
    hostName: string;
    ipAddress: string;
    port: number;
    roomCode: string;
}

export interface Player {
    id: string;
    name: string;
    teamName?: string;
    role: "host" | "participant";
    score: number;
    connected?: boolean; // Kept for backend internal use if needed, but not in frontend schema? Wait, frontend schema has strict types. Let's make it compatible.
}

export interface BuzzResult {
    playerId: string;
    playerName: string;
    teamName?: string;
    timestamp: number;
}

export interface GameRoom {
    code: string;
    hostId: string;
    hostName: string;
    maxParticipants: number;
    timerEnabled: boolean;
    timerDuration: number;
    participants: Player[];
    isGameStarted: boolean;
    isBuzzerLocked: boolean;
    buzzResults: BuzzResult[];
    currentRound: number;
    status?: "waiting" | "active" | "completed"; // Kept for compatibility with backend logic, optional
    createdAt?: Date; // Backend specific
}

export interface ServerToClientEvents {
    roomCreated: (room: GameRoom) => void;
    playerJoined: (player: Player) => void;
    playerLeft: (playerId: string) => void;
    gameStarted: () => void;
    buzzerLocked: (result: BuzzResult) => void;
    buzzerReset: () => void;
    timerUpdate: (secondsLeft: number) => void;
    timerExpired: () => void;
    roomClosed: () => void;
    error: (message: string) => void;
    roomUpdate: (room: GameRoom) => void;
    serverDiscovered: (serverInfo: LocalServerInfo) => void;
    serverAnnouncement: (serverInfo: LocalServerInfo) => void;
}

export interface ClientToServerEvents {
    createRoom: (data: {
        hostName: string;
        maxParticipants: number;
        timerEnabled: boolean;
        timerDuration: number;
    }, callback?: (response: any) => void) => void; // Added callback for ack if needed, but frontend doesn't seem to use it in types, but socket.io client might.
    joinRoom: (data: {
        code: string;
        playerName: string;
        teamName?: string;
    }, callback?: (response: any) => void) => void;
    startGame: (code: string) => void;
    pressBuzzer: (code: string) => void;
    resetBuzzer: (code: string) => void;
    leaveRoom: (code: string) => void;
}

export type SocketData = {
    roomId: string;
    playerId: string;
    name: string;
    isHost: boolean;
    role: "host" | "participant";
};
