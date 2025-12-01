const validateOperation = (operation) => {
    //for PUT operation we need at least 2 args key and value
    if (operation?.type === "PUT" && operation?.args?.length >= 2) {
        return true;
    }
    //for GET operation we simply need the value of the key
    if (operation?.type === "GET" && operation?.args?.length >= 1) {
        return true;
    }
    return false;
}

const executeInstruction = (operation, savedData) => {
    switch (operation?.type) {
        case "GET":
            const keyToGet = operation?.args[0];
            return savedData[keyToGet];
        case "PUT":
            const keyToPut = operation?.args[0];
            const value = operation?.args[1];
            const timestamp = operation?.timestamp;
            const currentValueTimestamp = savedData[keyToPut]?.timestamp || 0;
            if (timestamp > currentValueTimestamp) {
                savedData[keyToPut] = { value, timestamp };
            }
            return;
        default:
            return;
    }
}

const waitForQuorum = (sockets, quorumSize, requestEvent, data, responseEvent) => {
    const responses = [];

    // Returns a Promise that resolves when responses.length === quorumSize
    return new Promise((resolve) => {
        const handleResponse = (response) => {
            // Store the response
            responses.push(response);
            // Check if the quorum is reached (Non-blocking check)
            if (responses.length === quorumSize) {
                // Quorum reached!
                console.log("Quorum reached");
                // 2. Resolve the Promise 
                resolve(responses);
            }
        };


        sockets.forEach(socket => {
            // Attach the response handler to each socket
            socket.on(responseEvent, handleResponse);
            // Send the request
            socket.emit(requestEvent, data);
        });

    });
}

const calculateNewTimestamp = (quorumTimestamps) => {
    const timestamps = [];
    quorumTimestamps.forEach((quorumTimestampObj) => {
        timestamps.push(quorumTimestampObj.timestamp);
    });
    return Math.max(...timestamps) + 1;
}

const getLatestValue = (responseData, dataKey) => {
    let latestValue = { timestamp: 0, value: undefined };
    responseData?.forEach((responseValue) => {
        if (responseValue?.[dataKey]?.timestamp > latestValue.timestamp) {
            latestValue = responseValue[dataKey];
        }
    })
    return latestValue;
}

module.exports = {
    validateOperation,
    executeInstruction,
    waitForQuorum,
    calculateNewTimestamp,
    getLatestValue
};