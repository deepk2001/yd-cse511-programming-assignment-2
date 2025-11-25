const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const { validateOperation, executeInstruction } = require("./utils.js");
const isEmpty = require('lodash/isEmpty');

const args = process.argv.slice(2);
const numberofServers = args[0];

const serverPorts = ["3000", "3001", "3002", "3003", "3004"];
const gatewayPort = "3005";
const isSystemInitialized = false;
const gatewayServer = new Server(gatewayPort);
const savedData = {}
const EventEmitter = require('node:events');

/* class ObservableArray extends EventEmitter {
    constructor() {
        super();
        this.data = [];
    }

    enqueue(item) {
        this.data.push(item);
        if (this.data.length === 1) {
            // Manually emit a custom event when the condition is met
            this.emit('nonEmpty');
        }
        this.emit('change', this.data);
    }

    dequeue() {
        const item = this.data.shift();
        return item;
    }
}

const instructionQueue = new ObservableArray(); */
console.log(`Gateway Server listening on port ${gatewayPort}`);
gatewayServer.on('connection', (socket) => {
    console.log('a user connected');
    // write methods to handle the connection
    socket.on("client-message-system-init", (data) => {
        if (!isSystemInitialized) {
            console.log("initializing servers");
            // logic for initializing servers like creating common timestamp
            isSystemInitialized = true;
        } else {
            console.log("system already initialized");
        }
    })
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
        // add operation to queue.
        executeInstruction(data?.operation, savedData);
        console.log(savedData);
        /*         instructionQueue.enqueue({
                    socketId: socket?.id,
                    operation: data?.operation
                })
                console.log("instruction Queue: ", instructionQueue) */
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