#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

// Using namespace std::chrono for timing utilities
using namespace std::chrono;

// Structure to hold results of a single operation
struct OpResult {
  std::string type;
  double duration_ms;
};

// Global mutex for thread-safe printing to the console
std::mutex print_mutex;

// Helper function for statistical calculations
double calculate_percentile(std::vector<double> &data, double percentile) {
  if (data.empty())
    return 0.0;
  // Sort the data to find percentiles
  std::sort(data.begin(), data.end());
  std::reverse(data.begin(), data.end());
  // Calculate index: P * N / 100. Use ceiling to match common percentile
  // definitions. Index is 0-based, size is 1-based, so N-1 is the last valid
  // index.
  size_t n = data.size();
  size_t index = (size_t)std::ceil(percentile / 100.0 * n) - 1;

  // Ensure index is within bounds (0 to n-1)
  if (index >= n) {
    index = n - 1;
  }

  return data[index];
}

// Function to execute command, measure time, and return result
OpResult execute_single_command(const std::string &operation, int thread_id,
                                int op_num) {
  auto start_time = high_resolution_clock::now();

  const std::string baseCommand = "npm run abd:client ";
  std::string fullCommand = baseCommand + operation;

  char buffer[128];
  std::string type = operation.substr(0, operation.find(' '));

#ifdef _WIN32
  FILE *pipe = _popen(fullCommand.c_str(), "r");
#else
  FILE *pipe = popen(fullCommand.c_str(), "r");
#endif

  if (!pipe) {
    std::lock_guard<std::mutex> lock(print_mutex);
    std::cerr << "[T" << thread_id << " OP" << op_num
              << "] Error: popen failed for: " << fullCommand << std::endl;
    return {type, 0.0};
  }

  {
    std::lock_guard<std::mutex> lock(print_mutex);
    std::cout << "\n>>> [T" << thread_id << " OP" << op_num
              << "] Starting: " << operation << std::endl;
  }

  std::string command_output;
  while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
    command_output += buffer;
  }

  int exit_code;
#ifdef _WIN32
  exit_code = _pclose(pipe);
#else
  exit_code = pclose(pipe);
#endif

  auto end_time = high_resolution_clock::now();

  // Calculate duration in milliseconds
  double duration_ms =
      duration_cast<duration<double, std::milli>>(end_time - start_time)
          .count();

  {
    std::lock_guard<std::mutex> lock(print_mutex);
    std::cout << "[T" << thread_id << " OP" << op_num
              << "] --- Command Output ---" << std::endl;
    std::cout << command_output;
    std::cout << "[T" << thread_id << " OP" << op_num << "] Finished in "
              << duration_ms << " ms (Exit Code: " << exit_code << ")"
              << std::endl;
    std::cout << "----------------------------------------------------"
              << std::endl;
  }

  return {type, duration_ms};
}

// Worker Function for Thread Execution
void worker_thread(int thread_id, const std::vector<std::string> &operations,
                   int start_op_num, std::vector<OpResult> *results_out) {
  for (size_t i = 0; i < operations.size(); ++i) {
    int current_op_num = start_op_num + i;
    OpResult result =
        execute_single_command(operations[i], thread_id, current_op_num);

    // Safely push result to the shared vector
    std::lock_guard<std::mutex> lock(print_mutex);
    results_out->push_back(result);
  }
}

// Main Execution Logic
int main() {
  const std::string INPUT_FILE_PATH = "tests/testcase3/input.txt";
  const int NUM_THREADS = 16;

  std::vector<std::string> all_operations;
  std::ifstream inputFile(INPUT_FILE_PATH);

  if (!inputFile.is_open()) {
    std::cerr << "Error: Could not open input file at " << INPUT_FILE_PATH
              << std::endl;
    return 1;
  }

  std::string line;
  while (std::getline(inputFile, line)) {
    if (!line.empty() && line.find_first_not_of(' ') != std::string::npos) {
      all_operations.push_back(line);
    }
  }
  inputFile.close();

  if (all_operations.empty()) {
    std::cout << "Input file is empty. Exiting." << std::endl;
    return 0;
  }

  size_t total_ops = all_operations.size();
  size_t chunk_size = (size_t)std::ceil((double)total_ops / NUM_THREADS);

  std::vector<std::thread> threads;
  std::vector<OpResult> all_results;

  auto simulation_start_time = high_resolution_clock::now();

  for (int i = 0; i < NUM_THREADS; ++i) {
    size_t start_index = i * chunk_size;
    size_t end_index = std::min(start_index + chunk_size, total_ops);

    if (start_index < total_ops) {
      std::vector<std::string> thread_operations;
      for (size_t j = start_index; j < end_index; ++j) {
        thread_operations.push_back(all_operations[j]);
      }

      int start_op_num = start_index + 1;
      threads.emplace_back(worker_thread, i + 1, thread_operations,
                           start_op_num, &all_results);
    }
  }

  for (auto &t : threads) {
    if (t.joinable()) {
      t.join();
    }
  }

  auto simulation_end_time = high_resolution_clock::now();
  double total_runtime_s = duration_cast<duration<double>>(
                               simulation_end_time - simulation_start_time)
                               .count();

  // --- Metric Calculation ---
  std::vector<double> get_latencies;
  std::vector<double> put_latencies;

  for (const auto &result : all_results) {
    if (result.type == "GET") {
      get_latencies.push_back(result.duration_ms);
    } else if (result.type == "PUT") {
      put_latencies.push_back(result.duration_ms);
    }
  }

  size_t total_success_ops = get_latencies.size() + put_latencies.size();

  // Throughput calculation (requests/sec)
  double sustainable_throughput =
      (total_runtime_s > 0) ? (double)total_success_ops / total_runtime_s : 0.0;

  // Latency metrics
  double median_get_latency = calculate_percentile(get_latencies, 50.0);
  double p95_get_latency = calculate_percentile(get_latencies, 95.0);
  double median_put_latency = calculate_percentile(put_latencies, 50.0);
  double p95_put_latency = calculate_percentile(put_latencies, 95.0);

  // --- Final Output Report ---
  std::cout << "\n\n========================================================"
            << std::endl;
  std::cout << "               PERFORMANCE METRICS REPORT               "
            << std::endl;
  std::cout << "========================================================"
            << std::endl;
  std::cout << "TOTAL EXECUTION TIME: " << total_runtime_s << " seconds"
            << std::endl;
  std::cout << "TOTAL SUCCESSFUL OPERATIONS: " << total_success_ops
            << std::endl;
  std::cout << "SUSTAINABLE THROUGHPUT: " << sustainable_throughput
            << " requests/sec" << std::endl;
  std::cout << "--------------------------------------------------------"
            << std::endl;
  std::cout << "LATENCY (GET Operations):" << std::endl;
  std::cout << "  Count: " << get_latencies.size() << std::endl;
  std::cout << "  Median (50th Percentile): " << median_get_latency << " ms"
            << std::endl;
  std::cout << "  95th Percentile: " << p95_get_latency << " ms" << std::endl;
  std::cout << "--------------------------------------------------------"
            << std::endl;
  std::cout << "LATENCY (PUT Operations):" << std::endl;
  std::cout << "  Count: " << put_latencies.size() << std::endl;
  std::cout << "  Median (50th Percentile): " << median_put_latency << " ms"
            << std::endl;
  std::cout << "  95th Percentile: " << p95_put_latency << " ms" << std::endl;
  std::cout << "========================================================"
            << std::endl;

  return 0;
}