@echo off
echo Starting Merrouch Gaming Voice Chat...

SET BASE_DIR=%~dp0
cd %BASE_DIR%voicehcat

echo Checking for Go server binary...
IF NOT EXIST voicechat-server.exe (
    echo Go server binary not found. Building...
    go build -o voicechat-server.exe
    IF NOT EXIST voicechat-server.exe (
        echo Failed to build Go server!
        exit /b 1
    )
)

echo Starting Go server...
start /B voicechat-server.exe

echo Starting Next.js server...
cd ..
cross-env NODE_ENV=production ts-node --project tsconfig.server.json server.ts 