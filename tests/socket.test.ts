import { createServer } from "node:http";
import { type AddressInfo } from "node:net";
import { io as ioc, type Socket as ClientSocket } from "socket.io-client";
import { Server, type Socket as ServerSocket } from "socket.io";
import { registerSocketRoutes } from "../src/server/routes";
import { ClientToServerEvents, ServerToClientEvents } from "../src/shared/schema";

describe("Socket.IO Server", () => {
    let io: Server;
    let serverSocket: ServerSocket;
    let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
    let httpServer: any;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer);
        registerSocketRoutes(io);

        httpServer.listen(() => {
            const port = (httpServer.address() as AddressInfo).port;
            clientSocket = ioc(`http://localhost:${port}`);
            io.on("connection", (socket) => {
                serverSocket = socket;
            });
            clientSocket.on("connect", done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
        httpServer.close();
    });

    test("should create a room", (done) => {
        clientSocket.emit("createRoom", {
            hostName: "HostUser",
            maxParticipants: 10,
            timerEnabled: false,
            timerDuration: 30
        }, (response: any) => {
            expect(response.success).toBe(true);
            expect(response.room).toBeDefined();
            expect(response.room.code).toBeDefined();
            expect(response.room.code.length).toBe(6);
            done();
        });
    });

    test("should join a room", (done) => {
        clientSocket.emit("createRoom", {
            hostName: "HostUser",
            maxParticipants: 10,
            timerEnabled: false,
            timerDuration: 30
        }, (response: any) => {
            const code = response.room.code;

            // Create another client to join
            const port = (httpServer.address() as AddressInfo).port;
            const playerSocket = ioc(`http://localhost:${port}`);

            playerSocket.on("connect", () => {
                playerSocket.emit("joinRoom", {
                    code,
                    playerName: "PlayerOne"
                }, (res: any) => {
                    expect(res.success).toBe(true);
                    expect(res.room).toBeDefined();
                    expect(res.room.code).toBe(code);
                    playerSocket.close();
                    done();
                });
            });
        });
    });
});
