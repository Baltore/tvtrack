@echo off
setlocal enabledelayedexpansion
title TVTrack - Lancement
cd /d "%~dp0"

echo ==========================================
echo    TVTrack - Demarrage du projet
echo ==========================================
echo.

REM --- 1. Verifier / demarrer Docker Desktop ---
docker info >nul 2>&1
if not errorlevel 1 goto dockerready

echo [Docker] Docker n'est pas lance. Demarrage de Docker Desktop...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo [Docker] Attente du demarrage de Docker (30 a 60 secondes)...
set /a _tries=0
:waitdocker
timeout /t 3 >nul
docker info >nul 2>&1
if not errorlevel 1 goto dockerready
set /a _tries+=1
if !_tries! lss 40 goto waitdocker
echo [Docker] Docker ne repond pas. Lance Docker Desktop a la main puis relance ce fichier.
pause
exit /b 1

:dockerready
echo [Docker] Docker est pret.
echo.

REM --- 2. Lancer MongoDB ---
echo [MongoDB] Demarrage du conteneur MongoDB...
docker compose up -d
echo.

REM --- 3. Backend et Frontend, chacun dans sa propre fenetre ---
echo [Backend]  Fenetre backend  sur le port 5000...
start "TVTrack Backend"  /D "%~dp0backend"  cmd /k npm run dev

echo [Frontend] Fenetre frontend sur le port 5173...
start "TVTrack Frontend" /D "%~dp0frontend" cmd /k npm run dev

REM --- 4. Ouvrir le navigateur ---
echo.
echo [Navigateur] Ouverture de http://localhost:5173 dans quelques secondes...
timeout /t 8 >nul
start "" http://localhost:5173

echo.
echo Tout est lance. Tu peux fermer cette fenetre.
timeout /t 4 >nul
exit
