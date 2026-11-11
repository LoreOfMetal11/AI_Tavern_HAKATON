#!/usr/bin/env bash
echo "========================================================"
echo "  MythicTavern: D&D AI Master Studio Запускается..."
echo "========================================================"

if command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000 &
elif command -v open > /dev/null; then
  open http://localhost:3000 &
fi

npm run dev
