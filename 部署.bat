@echo off
chcp 65001 >nul
title 简账 · 构建并部署
cd /d "%~dp0"

echo [简账] 正在构建生产包（约 10 秒）...
call npm run build
if errorlevel 1 (
  echo [简账] 构建失败，请检查上方报错
  pause
  exit /b 1
)

echo.
echo [简账] 构建完成！dist 文件夹已打开。
echo [简账] 正在打开 Cloudflare Pages 上传页面...
echo.
echo [操作步骤] 1. 登录（没有账号先免费注册）
echo            2. 点「Create」创建项目
echo            3. 把打开的 dist 文件夹整个拖进上传框
echo            4. 等十几秒，出现网址即部署成功
start "" "https://dash.cloudflare.com/?to=/:account/pages/new/upload"
explorer "%~dp0dist"

pause
