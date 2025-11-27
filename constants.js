const NUM_SERVERS = 1;
const QUORUM_SIZE = Math.ceil(NUM_SERVERS / 2) // simplified as number of servers is always odd. (2f + 1)
const serverPorts = ["3000", "3001", "3002", "3003", "3004"];
const gatewayPort = "3005";
module.exports = {
    NUM_SERVERS,
    QUORUM_SIZE,
    serverPorts,
    gatewayPort
}