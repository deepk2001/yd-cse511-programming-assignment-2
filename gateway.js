const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const { validateOperation, executeInstruction, waitForQuorum, calculateNewTimestamp, getLatestValue } = require("./utils.js");
const isEmpty = require('lodash/isEmpty');
const { gatewayPort, serverPorts, NUM_SERVERS, QUORUM_SIZE, SOCKET_EVENTS } = require("./constants.js");

const gatewayServer = new Server(gatewayPort);

const serverConnections = []

for (i = 0; i < NUM_SERVERS; i++) {
    const SERVER_URL = `http://localhost:${serverPorts[i]}`;
    serverConnections.push(io(SERVER_URL));
    console.log("Connected to server number: ", i + 1, " at port : ", serverPorts[i]);
}

serverConnections.forEach((serverConnection) => {
    serverConnection.emit(SOCKET_EVENTS.GATEWAY_INITIALIZE_SERVER_SOCKETS, {});
    console.log("initialized all server connections.")
})

console.log(`Gateway Server listening on port ${gatewayPort}`);
gatewayServer.on('connection', (socket) => {
    console.log('a user connected');
    // handling client and server connections
    socket.on(SOCKET_EVENTS.CLIENT_ISSUE_OPERATION, async (data) => {
        console.log("data from client", data)
        //validate operation at the gateway.
        if (isEmpty(data?.operation) || !validateOperation(data?.operation)) {
            socket.emit(
                SOCKET_EVENTS.GATEWAY_OPERATION_VALIDATION_ERROR,
                { status: "400", message: "Incorrect Operation definition", clientId: data?.clientId }
            );
            return;
        }
        const quorumTimestamps = await waitForQuorum(
            serverConnections,
            QUORUM_SIZE,
            SOCKET_EVENTS.SERVER_REQUEST_TIMESTAMP,
            data,
            SOCKET_EVENTS.SERVER_RESPONSE_TIMESTAMP_ACK
        )
        console.log(quorumTimestamps, "QUORUM TIMESTAMPS");
        const newTimestamp = calculateNewTimestamp(quorumTimestamps);
        data.operation["timestamp"] = newTimestamp;
        console.log("updated timestamp to operation: ", data?.operation);

        const quorumResponses = await waitForQuorum(
            serverConnections,
            QUORUM_SIZE,
            SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
            data,
            SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
        )

        console.log("quorum-responses ", quorumResponses, QUORUM_SIZE)
        let response = {}

        if (data?.operation?.type === "GET") {
            response = getLatestValue(quorumResponses, data?.operation?.args[0]);
            const writeBackData = {
                operation: {
                    type: "PUT",
                    args: [data?.operation?.args[0], response.value],
                    timestamp: response.timestamp,
                }
            }
            console.log("writing back data to all servers ", writeBackData);
            await waitForQuorum(
                serverConnections,
                QUORUM_SIZE,
                SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
                writeBackData,
                SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
            );
        }
        console.log("recieved server-operation-ack with data :", data);
        console.log("emitting client script disconnect");
        socket.emit(SOCKET_EVENTS.GATEWAY_RESPONSE_OPERATION_SUCCESS, { ...data, response });
    });
});
