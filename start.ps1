# Top Note — arranca backend + frontend y abre el navegador
$root = $PSScriptRoot

# Backend NestJS (puerto 3000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm run start:dev" -WindowStyle Normal

# Frontend — Python http.server (puerto 8000)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root'; python -m http.server 8000" -WindowStyle Normal

# Esperar a que los servidores arranquen y abrir el navegador
Start-Sleep -Seconds 3
Start-Process "http://localhost:8000"
