#!/bin/bash
# Скрипт для запуска dev сервера с правильной версией Node.js

# Загружаем nvm если доступен
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Переключаемся на версию из .nvmrc если файл существует
if [ -f .nvmrc ]; then
  nvm use
fi

# Проверяем версию Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Ошибка: Требуется Node.js версии 20.19+ или 22.12+"
  echo "Текущая версия: $(node -v)"
  echo ""
  echo "Используйте nvm для переключения версии:"
  echo "  nvm install 20"
  echo "  nvm use 20"
  exit 1
fi

# Запускаем vite
exec npm run dev -- "$@"


