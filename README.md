This is the project 2 submission for Team YD, for cse-511. This project implements a replicated linearizable key-value store using the non-blocking ABD protocol.

## Project Components Overview

This project implements a replicated linearizable key-value store, offering both a non-blocking ABD protocol and a blocking variant for performance comparison.

## Getting Started

The project is built on Node.js and uses Socket.IO for inter-component communication.

### Prerequisites

- Node.js (v18+ or higher)
- C++ Compiler (for the client-simulator.cpp)

### Installation

Clone the repository.

Install dependencies:

```
npm install
```

Compile the C++ client simulator:

```
g++ -std=c++11 -o client-simulator client-simulator.cpp
# You may need to add -pthread depending on your OS/Compiler for threading support
```

## Execution

The system must be started in the following order: Servers, Gateway, then Clients/Simulator.

### Start Replica Servers (N=3)
Open three separate terminal windows and run the server script, providing a unique server number as an argument (1, 2, or 3).

```
npm run abd:server 1
npm run abd:server 2
npm run abd:server 3
```

### Start Gateway (Non-blocking ABD)
Open a fourth terminal window and start the non-blocking gateway.

```
npm run abd:gateway
```

### Blocking Variant
To run the blocking variant for experimental comparison, use the following command (if implemented as gateway-blocking.js):

```
npm run abd:gateway-blocking
```

### Run Client Operations (Manual)
To test individual PUT or GET operations.

```
npm run abd:client PUT key value    # Example: npm run abd:client PUT myKey 42
npm run abd:client GET key          # Example: npm run abd:client GET myKey
```

### Run Client Simulator (Automated)
For performance testing and concurrent workload generation.

```
g++ client-simulator.cpp -o client-simulator -pthread -std=c++17
./client-simulator <relative path to testcase input>
```

## Code Structure

The distributed system is composed of several modular Node.js files implementing the ABD protocol logic, plus a C++ simulator for automated testing.

**gateway.js / gateway-blocking.js**: The entry point for client requests. It implements the two-phase ABD read and write operations.

- **GET Operation**: Phase 1 involves sending a request to a quorum to gather timestamps/values. Phase 2 involves the write-back of the latest value to a quorum to ensure linearizability.

- **PUT Operation**: Phase 1 involves gathering timestamps from a quorum to calculate a new, unique timestamp. Phase 2 involves writing the new value and timestamp to a quorum.

The non-blocking version uses asynchronous promises and `waitForQuorum` utility to manage concurrency.

**server.js**: The replica component. It stores the key-value data in memory (local key-value map), associated each value with a timestamp, and implements the server-side logic for responding to read/write requests and timestamp requests from the gateway. It ensures that data is only updated if the incoming timestamp is strictly greater than the current local timestamp for that key.

**client.js**: A simple command-line client used by the simulator. It connects to the gateway, issues a single operation (PUT/GET), and disconnects upon receiving a success acknowledgment.

**constants.js**: Defines global configuration: the number of servers (NUM_SERVERS=3), quorum size (QUORUM_SIZE=2), ports, and all inter-component Socket.IO event names.

**utils.js**: Contains core utility functions:

- `validateOperation`: Checks client request format.
- `executeInstruction`: Performs the local storage update (PUT) or retrieval (GET) on a server.
- `waitForQuorum`: A critical asynchronous function that sends a message to a set of sockets and waits for the required number of quorum responses before resolving the promise.
- `calculateNewTimestamp`: Determines the maximum timestamp gathered from a quorum of servers and increments it by one for a new write.
- `getLatestValue`: Identifies the latest value among a set of quorum responses based on the highest timestamp.

## Client Simulator (client-simulator.cpp)

The client-simulator.cpp program is a crucial component used for workload generation and performance evaluation of the distributed key-value store. It is written in C++ and utilizes multi-threading and timing utilities (std::chrono) to rigorously test the system's linearizability properties and measure performance metrics under simulated concurrent load.

### Functionality

- **Workload Generation**: The simulator creates a specified number of concurrent threads, each simulating an independent client issuing requests (GET or PUT operations) to the distributed system via the `npm run abd:client` script.

- **Execution Mechanism**: It executes the Node.js client script commands using the `popen` function, allowing the C++ program to run system commands and capture their output for logging and verification, and most importantly, capture the operation completion time.

- **Performance Measurement**: The primary goal is to collect performance data for both the non-blocking ABD protocol and any blocking variants implemented, allowing for direct comparison as required by the assignment.

### Scripts
```
g++ client-simulator.cpp -o client-simulator -pthread -std=c++17
./client-simulator <relative path to testcase input>
```

### Output Metrics

The simulator generates a comprehensive performance report, including the following key metrics:

- **Total Execution Time**: The overall time taken to complete all simulated operations.

- **Total Successful Operations**: The count of client operations that successfully received an acknowledgment from the gateway.

- **Sustainable Throughput**: Calculated as the number of successful operations divided by the total execution time, measured in requests per second.

- **Latency Analysis**: Detailed latency statistics (in milliseconds) for both GET and PUT operations, including the:
  - **Median (50th Percentile)**: The time within which 50% of the operations completed.
  - **95th Percentile (P95)**: The time within which 95% of the operations completed, offering insight into the system's worst-case performance under load.
