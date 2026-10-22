param([ValidateRange(1024, 65535)][int]$BackendPort = 8080)
$ErrorActionPreference = 'Stop'
$webRoot = Split-Path (Split-Path $PSScriptRoot)
$frontendRoot = Split-Path $webRoot
$backendRoot = Join-Path (Split-Path $frontendRoot) 'CASMS_Backend'
$qaRuntime = Join-Path $frontendRoot 'CASMS_MobileApp\.expo'
$qaCluster = Join-Path $qaRuntime 'postgres-qa'
$qaPassword = Join-Path $qaRuntime 'postgres-qa-password.txt'
$postgresBin = 'C:\Program Files\PostgreSQL\16\bin'
if (!(Test-Path -LiteralPath $qaPassword) -or !(Test-Path -LiteralPath (Join-Path $qaCluster 'PG_VERSION'))) { throw 'The existing isolated QA PostgreSQL runtime is required. See README.md.' }
& (Join-Path $postgresBin 'pg_ctl.exe') -D $qaCluster status
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $postgresBin 'pg_ctl.exe') -D $qaCluster -l (Join-Path $qaCluster 'webapp-postgres.log') -o '-h 127.0.0.1 -p 55432' -w start
  if ($LASTEXITCODE -ne 0) { throw 'Cannot start QA PostgreSQL.' }
}
$env:PGPASSWORD = [System.IO.File]::ReadAllText($qaPassword)
$qaDatabase = & (Join-Path $postgresBin 'psql.exe') -X -w -h 127.0.0.1 -p 55432 -U casms_qa -d casms_mobile_qa -At -c 'SELECT current_database();'
Remove-Item Env:PGPASSWORD
if ($LASTEXITCODE -ne 0 -or $qaDatabase -ne 'casms_mobile_qa') { throw 'Refusing to run against an unverified database.' }
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:55432/casms_mobile_qa?stringtype=unspecified'
$env:DB_USERNAME = 'casms_qa'
$env:DB_PASSWORD = [System.IO.File]::ReadAllText($qaPassword)
$env:SPRING_PROFILES_ACTIVE = 'dev'
Push-Location -LiteralPath $backendRoot
try {
  & mvn.cmd -q spring-boot:run "-Dspring-boot.run.arguments=--server.port=$BackendPort --spring.jpa.hibernate.ddl-auto=update --spring.jpa.show-sql=false --spring.flyway.enabled=false --logging.level.com.casms=INFO --logging.level.org.hibernate.SQL=WARN"
  if ($LASTEXITCODE -ne 0) { throw 'QA backend stopped with an error.' }
} finally { Pop-Location; Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue }
