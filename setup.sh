#!/usr/bin/env bash
# Download and go: installs dependencies, downloads the finished clips, checks them, starts the show software.
set -e
cd "$(dirname "$0")/controller"
node setup.js "$@"
node launch.js
