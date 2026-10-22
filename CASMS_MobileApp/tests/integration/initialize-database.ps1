param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\16\bin')
$ErrorActionPreference = 'Stop'
$mobileRoot = Split-Path (Split-Path $PSScriptRoot)
$qaRoot = Join-Path $mobileRoot '.expo\postgres-qa'
$passwordFile = Join-Path $mobileRoot '.expo\postgres-qa-password.txt'
New-Item -ItemType Directory -Path (Join-Path $mobileRoot '.expo') -Force | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $qaRoot 'PG_VERSION'))) {
  if ((Test-Path -LiteralPath $qaRoot) -and (Get-ChildItem -LiteralPath $qaRoot -Force | Measure-Object).Count -gt 0) {
    throw 'The QA directory is not empty; inspect it before initializing.'
  }
  $password = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
  [System.IO.File]::WriteAllText($passwordFile, $password, [System.Text.UTF8Encoding]::new($false))
  & (Join-Path $PostgresBin 'initdb.exe') -D $qaRoot -U casms_qa --auth-local=scram-sha-256 --auth-host=scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C
  if ($LASTEXITCODE -ne 0) { throw 'QA initdb failed.' }
}
if (!(Test-Path -LiteralPath $passwordFile)) { throw 'The existing cluster password file is missing.' }
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $qaRoot status
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $PostgresBin 'pg_ctl.exe') -D $qaRoot -l (Join-Path $mobileRoot '.expo\postgres-qa.log') -o '-h 127.0.0.1 -p 55432' -w start
  if ($LASTEXITCODE -ne 0) { throw 'QA PostgreSQL did not start.' }
}
$env:PGPASSWORD = [System.IO.File]::ReadAllText($passwordFile)
$env:PGCONNECT_TIMEOUT = '5'
$exists = & (Join-Path $PostgresBin 'psql.exe') -X -w -h 127.0.0.1 -p 55432 -U casms_qa -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname='casms_mobile_qa'"
if ($LASTEXITCODE -ne 0) { throw 'Cannot connect to the QA cluster.' }
if ($exists -ne '1') {
  & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U casms_qa casms_mobile_qa
  if ($LASTEXITCODE -ne 0) { throw 'Cannot create the QA database.' }
}
& (Join-Path $PostgresBin 'psql.exe') -X -w -h 127.0.0.1 -p 55432 -U casms_qa -d casms_mobile_qa -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'bootstrap-qa.sql')
if ($LASTEXITCODE -ne 0) { throw 'QA bootstrap failed.' }
Remove-Item Env:PGPASSWORD
