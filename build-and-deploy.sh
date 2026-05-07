#!/bin/bash
# Обратная совместимость: вызывает сборку и развёртывание DPA.
# Использование: ./build-and-deploy.sh  (то же, что ./build-and-deploy-dpa.sh)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$SCRIPT_DIR/build-and-deploy-dpa.sh"
