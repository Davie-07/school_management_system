# Create project structure for Kandara Technical College
$dirs = @(
    "server",
    "server\config",
    "server\models",
    "server\routes",
    "server\middleware",
    "server\utils",
    "client",
    "client\css",
    "client\js", 
    "client\dashboards",
    "client\assets",
    "client\components"
)

foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir
}

Write-Host "Project structure created successfully!" -ForegroundColor Green
