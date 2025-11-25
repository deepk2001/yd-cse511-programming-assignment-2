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
            savedData[keyToPut] = value;
            return;
        default:
            return;
    }
}


module.exports = {
    validateOperation,
    executeInstruction
};