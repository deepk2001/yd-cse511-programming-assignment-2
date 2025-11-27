const { Server } = require('socket.io');
const { serverPorts } = require("./constants.js");
const { executeInstruction } = require('./utils.js');
const serverArgs = process.argv.slice(2);
const savedData = {}
const replicaServer = new Server(serverPorts[serverArgs[0] - 1])

if (replicaServer) {
    console.log(`Server Number ${serverArgs[0]} is online.`);
}

replicaServer.on("connection", (socket) => {
    socket.on("gateway-operation-request", (data) => {
        console.log("recieved operation request from gateway", data);
        executeInstruction(data?.operation, savedData);
        socket.emit("server-operation-ack", { status: "200", operationState: "completed", clientId: data?.clientId })
    });
})

