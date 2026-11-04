#!/usr/bin/env python3
"""log_counter.py - Training script for Cyber Threat Monitoring Level I.

Reads a web server access log and prints:
  1. the number of requests per client IP address, and
  2. the HTTP status codes each IP received.
It only READS the file given on the command line. It does not modify
anything and does not connect to the network.

Usage: python3 log_counter.py web_access.log
"""
import sys
from collections import Counter, defaultdict

if len(sys.argv) != 2:
    print("Usage: python3 log_counter.py <access_log_file>")
    sys.exit(1)

requests_per_ip = Counter()
statuses_per_ip = defaultdict(Counter)

with open(sys.argv[1], encoding="utf-8") as log:
    for line in log:
        parts = line.split('"')
        if len(parts) < 3:
            continue
        ip = line.split()[0]
        status = parts[2].split()[0]
        requests_per_ip[ip] += 1
        statuses_per_ip[ip][status] += 1

print(f"{'IP ADDRESS':<18}{'REQUESTS':>9}   STATUS CODES")
for ip, count in requests_per_ip.most_common():
    codes = ", ".join(f"{code} x{n}" for code, n in statuses_per_ip[ip].items())
    print(f"{ip:<18}{count:>9}   {codes}")
