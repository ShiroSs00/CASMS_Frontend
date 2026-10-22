$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path (Split-Path $PSScriptRoot)
$frontendRoot = Split-Path $mobileRoot
$backendRoot = Join-Path (Split-Path $frontendRoot) 'CASMS_Backend'
$passwordFile = Join-Path $mobileRoot '.expo\postgres-qa-password.txt'
if (!(Test-Path -LiteralPath $passwordFile)) { throw 'Initialize the isolated PostgreSQL QA cluster first; see docs/real-api-qa.md.' }
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:55432/casms_mobile_qa?stringtype=unspecified'
$env:DB_USERNAME = 'casms_qa'
$env:DB_PASSWORD = [System.IO.File]::ReadAllText($passwordFile)
$env:SPRING_PROFILES_ACTIVE = 'dev'
Push-Location -LiteralPath $backendRoot
try {
  & mvn.cmd -q spring-boot:run '-Dspring-boot.run.arguments=--server.port=18080 --spring.jpa.hibernate.ddl-auto=update --spring.jpa.show-sql=false --spring.flyway.enabled=false --logging.level.com.casms=INFO --logging.level.org.hibernate.SQL=WARN --logging.level.org.hibernate.type.descriptor.sql=WARN'
  if ($LASTEXITCODE -ne 0) { throw "Backend exited with code $LASTEXITCODE" }
} finally { Pop-Location }
