@echo off
chcp 65001 >nul
title 简账 · 启动器
cd /d "%~dp0"

:: 首次运行自动安装依赖
if not exist node_modules (
  echo [简账] 首次运行，正在安装依赖（约 1-2 分钟）...
  call npm install
  if errorlevel 1 (
    echo [简账] 依赖安装失败，请检查网络后重试
    pause
    exit /b 1
  )
)

:: 检查端口是否已被占用（已在运行就直接开浏览器）
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo [简账] 服务已在运行，直接打开浏览器
  start "" http://localhost:5173
  exit /b 0
)

echo [简账] 正在启动服务...
start "" http://localhost:5173
call npm run dev
