const NUM_SERVERS = 1;
const QUORUM_SIZE = Math.ceil(NUM_SERVERS / 2) // simplified as number of servers is always odd. (2f + 1)
const serverPorts = ["3000", "3001", "3002", "3003", "3004"];
const gatewayPort = "3005";

const SOCKET_EVENTS = {
    CLIENT_ISSUE_OPERATION: "client-message-issue-operation",
    GATEWAY_OPERATION_VALIDATION_ERROR: "gateway-operation-validation-failed",
    GATEWAY_OPERATION_REQUEST: "gateway-operation-request",
    SERVER_OPERATION_ACK: "server-operation-ack",
    GATEWAY_RESPONSE_OPERATION_SUCCESS: "gateway-operation-successful",
    GATEWAY_INITIALIZE_SERVER_SOCKETS: "gateway-init-server-connections",
    SERVER_OPERATION_REQUEST: "server-operation-request",
    SERVER_OPERATION_RESPONSE_ACK: "server-operation-response-ack",
    SERVER_REQUEST_TIMESTAMP: "server-request-timestamp",
    SERVER_RESPONSE_TIMESTAMP_ACK: "server-response-timestamp-ack",
    BLOCKING_SERVER_OPERATION_REQUEST: "blocking-server-operation-request",
    BLOCKING_SERVER_OPERATION_RESPONSE_ACK: "blocking-server-operation-response-ack",
}
module.exports = {
    NUM_SERVERS,
    QUORUM_SIZE,
    serverPorts,
    gatewayPort,
    SOCKET_EVENTS
}