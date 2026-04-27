#!/bin/bash
# Сборка eec-rights-service (WAR) и копия в $TOMCAT_HOME/webapps (см. deploy-rights-service-local.sh).
# Использование: ./build-and-deploy-rights-service-local.sh

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
./build-rights-service.sh
./deploy-rights-service-local.sh
