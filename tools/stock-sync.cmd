@echo off
rem Twice-daily stock update from OLX (Windows Task Scheduler: "Tractoare Tecuci - stoc OLX").
rem Runs tools\update-stock.mjs --commit and appends everything to .tmp\stock-sync.log.
cd /d "%~dp0.."
if not exist .tmp mkdir .tmp
for %%F in (.tmp\stock-sync.log) do if %%~zF GTR 2000000 move /y .tmp\stock-sync.log .tmp\stock-sync.old.log >nul
echo. >> .tmp\stock-sync.log
echo ==== %date% %time% ==== >> .tmp\stock-sync.log
"C:\Program Files\nodejs\node.exe" tools\update-stock.mjs --commit >> .tmp\stock-sync.log 2>&1
echo exit code %errorlevel% >> .tmp\stock-sync.log
