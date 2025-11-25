const { io } = require("socket.io-client");

const args = process.argv.slice(2);

const GATEWAY_URL = "http://localhost:3005";

const socket = io(GATEWAY_URL);
console.log("Client connected to gateway");
socket.on("connect", () => {
    console.log(`✅ Connected to server at ${GATEWAY_URL}`);
    if (args.length >= 2) {
        console.log("here")
        const operationType = args.shift();
        socket.emit("client-message-issue-operation", {
            operation: {
                type: operationType,
                args,
            }
        })
    }
})