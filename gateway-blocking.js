const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const { validateOperation } = require("./utils.js");
const isEmpty = require('lodash/isEmpty');
const { gatewayPort, serverPorts, NUM_SERVERS, QUORUM_SIZE, SOCKET_EVENTS } = require("./constants.js");

const gatewayServer = new Server(gatewayPort);

const primaryConnection = io(`http://localhost:${serverPorts[0]}`);

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


        primaryConnection.emit(SOCKET_EVENTS.BLOCKING_SERVER_OPERATION_REQUEST, data);

    });
    primaryConnection.on(SOCKET_EVENTS.BLOCKING_SERVER_OPERATION_RESPONSE_ACK, (data) => {
        socket.emit(SOCKET_EVENTS.GATEWAY_RESPONSE_OPERATION_SUCCESS, data);
    });
});
