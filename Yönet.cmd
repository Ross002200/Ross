@echo off
chcp 65001 >nul
title Yönetim Paneli
cd /d "%~dp0"
node yonet\sunucu.mjs
if errorlevel 1 pause
