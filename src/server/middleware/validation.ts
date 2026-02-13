import { z } from "zod";

export const createRoomSchema = z.object({
    hostName: z.string().min(3).max(20).regex(/^[a-zA-Z0-9 ]+$/, "Name must be alphanumeric"),
    maxParticipants: z.number().min(1).max(200).optional(),
    timerEnabled: z.boolean().optional(),
    timerDuration: z.number().min(5).max(300).optional(),
});

export const joinRoomSchema = z.object({
    code: z.string().length(6).regex(/^[A-Z0-9]+$/, "Invalid room code format"),
    playerName: z.string().min(3).max(20).regex(/^[a-zA-Z0-9 ]+$/, "Name must be alphanumeric"),
    teamName: z.string().max(20).optional(),
});
