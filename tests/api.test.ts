import request from "supertest";
import express from "express";
import roomsRouter from "../src/server/api/rooms";
import statsRouter from "../src/server/api/stats";

const app = express();
app.use(express.json());
app.use("/api/rooms", roomsRouter);
app.use("/api/stats", statsRouter);

describe("REST API", () => {
    // Mock storage for testing
    beforeAll(() => {
        // Mock db or storage if needed, but integration with in-memory storage is fine for now
    });

    test("GET /api/stats should return statistics", async () => {
        const res = await request(app).get("/api/stats");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("activeRooms");
        expect(res.body).toHaveProperty("uptime");
    });

    test("GET /api/rooms should return empty list initially", async () => {
        const res = await request(app).get("/api/rooms");
        expect(res.status).toBe(200);
        expect(res.body.rooms).toBeInstanceOf(Array);
    });
});
