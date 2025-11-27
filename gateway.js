const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const { validateOperation, executeInstruction } = require("./utils.js");
const isEmpty = require('lodash/isEmpty');
const { gatewayPort, serverPorts, NUM_SERVERS, QUORUM_SIZE } = require("./constants.js");

const args = process.argv.slice(2);

const gatewayServer = new Server(gatewayPort);
const savedData = {};

const serverConnections = []

for (i = 0; i < NUM_SERVERS; i++) {
    const SERVER_URL = `http://localhost:${serverPorts[i]}`;
    serverConnections.push(io(SERVER_URL));
    console.log("Connected to server number: ", i + 1, " at port : ", serverPorts[i]);
}

console.log(`Gateway Server listening on port ${gatewayPort}`);
gatewayServer.on('connection', (socket) => {
    console.log('a user connected');
    // write methods to handle the connection
    socket.on("client-message-issue-operation", (data) => {
        console.log("data from client", data)
        //validate operation 
        if (isEmpty(data?.operation) || !validateOperation(data?.operation)) {
            socket.emit(
                "gateway-operation-validation-failed",
                { status: "400", message: "Incorrect Operation definition", operation: data?.operation }
            );
            return;
        }
        executeInstruction(data?.operation, savedData);
        console.log(savedData);
        serverConnections?.[0]?.emit("gateway-operation-request", data);
    })
    serverConnections?.[0]?.on("server-operation-ack", (data) => {
        console.log("recieved server-operation-ack with data :", data);
        console.log("emitting client script disconnect");
        socket.emit("gateway-operation-successful", data)
    })
});



gatewayServer.on('disconnect', (socket) => {
    console.log('disconnected ID: ', socket?.id);
});

gatewayServer.on('error', (error) => {
    console.log('error', error);
});

gatewayServer.on('message', (message) => {
    console.log('message', message);
});