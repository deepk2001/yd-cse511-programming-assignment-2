const { io } = require("socket.io-client");

const args = process.argv.slice(2);
const { v4 } = require('uuid')
const GATEWAY_URL = "http://localhost:3005";
const { SOCKET_EVENTS } = require("./constants.js")

const clientId = v4()
const socket = io(GATEWAY_URL);
console.log("Client connected to gateway");
socket.on("connect", () => {
    console.log(`✅ Connected to server at ${GATEWAY_URL}`);
    if (args.length >= 2) {
        console.log("here");
        const operationType = args.shift();
        socket.emit(SOCKET_EVENTS.CLIENT_ISSUE_OPERATION, {
            operation: {
                type: operationType,
                args,
            },
            clientId,
        })
    }
    socket.on(SOCKET_EVENTS.GATEWAY_RESPONSE_OPERATION_SUCCESS, (data) => {
        console.log("clientIDs", clientId, data);
        if (data?.clientId === clientId) {
            console.log("recieved confirmation ack");
            socket.disconnect();
        }
    })
})