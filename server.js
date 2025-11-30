const { Server } = require('socket.io');
const { io } = require("socket.io-client")
const { serverPorts, SOCKET_EVENTS, NUM_SERVERS, QUORUM_SIZE } = require("./constants.js");
const { executeInstruction, sleep, waitForQuorum, calculateNewTimestamp, getLatestValue } = require('./utils.js');
const serverArgs = process.argv.slice(2);
const savedData = {}
const replicaServer = new Server(serverPorts[serverArgs[0] - 1])

if (replicaServer) {
    console.log(`Server Number ${serverArgs[0]} is online.`);
}



replicaServer.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.SERVER_OPERATION_REQUEST, (data) => {
        console.log("recieved request for operation: ", data?.operation);
        let currentKeyTimestamp = savedData?.[data?.operation?.args[0]]?.timestamp || 0;
        const responseData = {};
        if (data?.operation?.timestamp > currentKeyTimestamp) {
            const executionResult = executeInstruction(data?.operation, savedData);
            currentKeyTimestamp = data?.operation?.timestamp;
            console.log("updated data: ", savedData);
            console.log("current key timestamp now, ", currentKeyTimestamp);
            if (data?.operation?.type === "GET") {
                const objKey = data?.operation?.args[0];
                responseData[objKey] = { ...executionResult };
            }
        }
        socket.emit(SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK, responseData);
    })

    socket.on(SOCKET_EVENTS.SERVER_REQUEST_TIMESTAMP, (data) => {
        console.log("recieved timestamp request...");
        let currentKeyTimestamp = savedData?.[data?.operation?.args[0]]?.timestamp || 0;
        socket.emit(SOCKET_EVENTS.SERVER_RESPONSE_TIMESTAMP_ACK, {
            timestamp: currentKeyTimestamp,
        })
    })
})

