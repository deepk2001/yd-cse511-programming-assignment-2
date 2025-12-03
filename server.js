const { Server } = require('socket.io');
const { io } = require("socket.io-client")
const { serverPorts, SOCKET_EVENTS, NUM_SERVERS, QUORUM_SIZE } = require("./constants.js");
const { executeInstruction, sleep, waitForQuorum, calculateNewTimestamp, getLatestValue, releaseMutex } = require('./utils.js');
const serverArgs = process.argv.slice(2);
const savedData = {}
const { Mutex } = require('async-mutex');
const mutex = new Mutex();
const replicaServer = new Server(serverPorts[serverArgs[0] - 1])

if (replicaServer) {
    console.log(`Server Number ${serverArgs[0]} is online.`);
}

const otherReplicaServers = []

for (i = 1; i < NUM_SERVERS; i++) {
    console.log("here", serverArgs);
    if (serverArgs[0] === '1') {
        const SERVER_URL = `http://localhost:${serverPorts[i]}`;
        otherReplicaServers.push(io(SERVER_URL));
        console.log("Connected to server number: ", i + 1, " at port : ", serverPorts[i]);
    }
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

    //ONLY FOR BLOCKING GATEWAY
    socket.on(SOCKET_EVENTS.BLOCKING_SERVER_OPERATION_REQUEST, async (data) => {
        const release = await mutex.acquire();
        if (NUM_SERVERS === 1) {
            console.log("executing operation for server count = 1");
            const executionResult = executeInstruction(data?.operation, savedData);
            const responseData = {};
            if (data?.operation?.type === "GET") {
                const objKey = data?.operation?.args[0];
                responseData[objKey] = { ...executionResult };
            }
            await releaseMutex(release);
            socket.emit(SOCKET_EVENTS.BLOCKING_SERVER_OPERATION_RESPONSE_ACK, { ...data, response: responseData });
            return;
        }

        await waitForQuorum(
            otherReplicaServers,
            NUM_SERVERS - 1,
            SOCKET_EVENTS.SERVER_REQUEST_TIMESTAMP,
            data,
            SOCKET_EVENTS.SERVER_RESPONSE_TIMESTAMP_ACK
        ).then(async (quorumTimestamps) => {
            console.log(quorumTimestamps, "QUORUM TIMESTAMPS");
            const newTimestamp = calculateNewTimestamp(quorumTimestamps);
            data.operation["timestamp"] = newTimestamp;
            console.log("updated timestamp to operation: ", data?.operation);
            await waitForQuorum(
                otherReplicaServers,
                NUM_SERVERS - 1,
                SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
                data,
                SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
            ).then(async (quorumResponses) => {
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
                        otherReplicaServers,
                        NUM_SERVERS - 1,
                        SOCKET_EVENTS.SERVER_OPERATION_REQUEST,
                        writeBackData,
                        SOCKET_EVENTS.SERVER_OPERATION_RESPONSE_ACK
                    );
                }
                console.log("recieved server-operation-ack with data :", data);
                console.log("emitting client script disconnect");
                socket.emit(SOCKET_EVENTS.BLOCKING_SERVER_OPERATION_RESPONSE_ACK, { ...data, response });
                await releaseMutex(release);
            })
        })
    });
})

