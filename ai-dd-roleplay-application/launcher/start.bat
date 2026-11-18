@echo off
chcp 65001 >nul
title Летописец — ИИ-мастер D&D
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Не найден Node.js. Установите его с https://nodejs.org или используйте готовый exe-пакет.
  pause
  exit /b 1
)
node launcher\launcher.mjs
pause
