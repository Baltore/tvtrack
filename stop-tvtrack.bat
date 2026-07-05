@echo off
title TVTrack - Arret
cd /d "%~dp0"

echo Arret de TVTrack en cours...

REM --- Fermer les fenetres backend et frontend (et leurs process node) ---
taskkill /FI "WINDOWTITLE eq TVTrack Backend*"  /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TVTrack Frontend*" /T /F >nul 2>&1

REM --- Arreter MongoDB (le conteneur, les donnees sont conservees) ---
docker compose stop >nul 2>&1

echo.
echo Termine : backend, frontend et MongoDB sont arretes.
timeout /t 3 >nul
exit
