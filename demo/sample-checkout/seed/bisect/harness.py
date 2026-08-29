"""Runs one candidate's checkout handler against every latency sample and
reports the observed timeout rate.
Usage: python3 harness.py <path-to-candidate-module> <commit-sha>
"""
import importlib.util
import json
import sys


def load_candidate(path):
    spec = importlib.util.spec_from_file_location("candidate", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    candidate_path, commit_sha = sys.argv[1], sys.argv[2]

    with open("upstream_latency.json") as f:
        latencies = json.load(f)

    candidate = load_candidate(candidate_path)

    timeouts = 0
    for simulated_upstream_latency_ms in latencies:
        result = candidate.handle_checkout_request(simulated_upstream_latency_ms)
        if result["timed_out"]:
            timeouts += 1

    print(json.dumps({
        "commit": commit_sha,
        "timeout_rate_pct": (timeouts / len(latencies)) * 100,
        "sample_size": len(latencies),
    }))


if __name__ == "__main__":
    main()
