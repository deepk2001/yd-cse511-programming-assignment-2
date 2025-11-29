const { Server } = require('socket.io');
const { io } = require("socket.io-client")
const { serverPorts, SOCKET_EVENTS, NUM_SERVERS, QUORUM_SIZE } = require("./constants.js");
const { executeInstruction, sleep, waitForQuorum } = require('./utils.js');
const serverArgs = process.argv.slice(2);
const savedData = {}
const replicaServer = new Server(serverPorts[serverArgs[0] - 1])

if (replicaServer) {
    console.log(`Server Number ${serverArgs[0]} is online.`);
}

const otherServerPorts = serverPorts.filter((_, index) => index !== serverArgs[0] - 1);
const otherServerConnections = []

const createOtherSockets = () => {
    otherServerPorts.forEach((port) => {
        const SERVER_URL = `http://localhost:${port}`;
        otherServerConnections.push(io(SERVER_URL));
    })
    console.log("connection successful to servers at ports ", otherServerPorts.slice(0, NUM_SERVERS - 1));
}


replicaServer.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.GATEWAY_INITIALIZE_SERVER_SOCKETS, createOtherSockets);
    socket.on(SOCKET_EVENTS.GATEWAY_OPERATION_REQUEST, async (data) => {
        console.log("recieved operation request from gateway", data);
        executeInstruction(data?.operation, savedData);
        console.log("updated data: ", savedData);
        const quorumResponses = await waitForQuorum(
            otherServerConnections,
            QUORUM_SIZE - 1,
            SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
            data,
            SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
        )
        console.log("quorum-responses ", quorumResponses, QUORUM_SIZE)
        socket.emit(SOCKET_EVENTS.SERVER_OPERATION_ACK, { status: "200", operationState: "completed", clientId: data?.clientId });

    });
    socket.on(SOCKET_EVENTS.SERVER_OPERATION_REQUEST, (data) => {
        console.log("recieved request for operation: ", data?.operation);
        executeInstruction(data?.operation, savedData);
        socket.emit(SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK, {});
    })
})

