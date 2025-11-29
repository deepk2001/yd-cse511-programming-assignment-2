const { Server } = require('socket.io');
const { io } = require("socket.io-client")
const { serverPorts, SOCKET_EVENTS, NUM_SERVERS, QUORUM_SIZE } = require("./constants.js");
const { executeInstruction, sleep, waitForQuorum, calculateNewTimestamp, getLatestValue } = require('./utils.js');
const serverArgs = process.argv.slice(2);
const savedData = {}
let currentServerTimestamp = 1;
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
        console.log("getting timestamp value");


        const quorumTimestamps = await waitForQuorum(
            otherServerConnections,
            QUORUM_SIZE - 1,
            SOCKET_EVENTS.SERVER_REQUEST_TIMESTAMP,
            {},
            SOCKET_EVENTS.SERVER_RESPONSE_TIMESTAMP_ACK
        )
        console.log(quorumTimestamps, "QUORUM TIMESTAMPS");
        const newTimestamp = calculateNewTimestamp(quorumTimestamps, currentServerTimestamp);
        data.operation["timestamp"] = newTimestamp;
        console.log("updated timestamp to operation: ", data?.operation);

        const quorumResponses = await waitForQuorum(
            otherServerConnections,
            QUORUM_SIZE - 1,
            SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
            data,
            SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
        )
        executeInstruction(data?.operation, savedData);
        currentServerTimestamp = data?.operation?.timestamp;
        console.log("updated data: ", savedData);
        console.log("quorum-responses ", quorumResponses, QUORUM_SIZE)
        let response = {}

        if (data?.operation?.type === "GET") {
            const responseData = [savedData[data?.operation?.args[0]], ...quorumResponses];
            response = getLatestValue(responseData);
            //write-back here
            const writeBackData = {
                operation: {
                    type: "PUT",
                    args: [data?.operation?.args[0], response.value],
                    timestamp: response.timestamp,
                }
            }
            console.log("writing back data to all servers ", writeBackData);
            await waitForQuorum(
                otherServerConnections,
                QUORUM_SIZE - 1,
                SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
                writeBackData,
                SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
            );
        }
        socket.emit(SOCKET_EVENTS.SERVER_OPERATION_ACK, { status: "200", operationState: "completed", clientId: data?.clientId, response });

    });
    socket.on(SOCKET_EVENTS.SERVER_OPERATION_REQUEST, (data) => {
        console.log("recieved request for operation: ", data?.operation);
        const executionResult = executeInstruction(data?.operation, savedData);
        currentServerTimestamp = data?.operation?.timestamp;
        console.log("updated data: ", savedData);
        const responseData = {};
        if (data?.operation?.type === "GET") {
            const objKey = data?.operation?.args[0];
            responseData[objKey] = { ...executionResult };
        }
        socket.emit(SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK, responseData);
    })

    socket.on(SOCKET_EVENTS.SERVER_REQUEST_TIMESTAMP, () => {
        console.log("recieved timestamp request...");
        socket.emit(SOCKET_EVENTS.SERVER_RESPONSE_TIMESTAMP_ACK, {
            timestamp: currentServerTimestamp,
        })
    })
})

