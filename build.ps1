# Compila todos los ejecutables en bin\ (Windows con MinGW-w64 g++ en el PATH)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$flags = @("-O3", "-march=native", "-std=c++17", "-Wall", "-Wextra")
New-Item -ItemType Directory -Force bin | Out-Null

g++ @flags src/main_seq.cpp src/ecosystem.cpp -o bin/ecosystem_seq.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
g++ @flags -fopenmp src/main_omp.cpp src/ecosystem.cpp -o bin/ecosystem_omp.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
g++ @flags -pthread src/main_pthreads.cpp src/ecosystem.cpp -o bin/ecosystem_pthreads.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
g++ -O2 -std=c++17 tools/gen_input.cpp -o bin/gen_input.exe
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "Compilacion completa: bin\"
