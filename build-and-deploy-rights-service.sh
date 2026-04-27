#!/bin/bash
# Сборка eec-rights-service (WAR) и scp в webapps на REMOTE_HOST (см. deploy-rights-service-to-remote.sh).
# Использование: ./build-and-deploy-rights-service.sh

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
./build-rights-service.sh
./deploy-rights-service-to-remote.sh
