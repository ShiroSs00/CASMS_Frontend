"""Access only the isolated local QA database; credentials stay in ignored .expo."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
env = dict(os.environ)
env.update(PGPASSWORD=(ROOT / '.expo/postgres-qa-password.txt').read_text(),
           PGCONNECT_TIMEOUT='5', PGCLIENTENCODING='UTF8')
command = [r'C:\Program Files\PostgreSQL\16\bin\psql.exe', '-X', '-w',
           '-h', '127.0.0.1', '-p', '55432', '-U', 'casms_qa',
           '-d', 'casms_mobile_qa', '-v', 'ON_ERROR_STOP=1', '-P', 'pager=off']
if len(sys.argv) == 3 and sys.argv[1] == '--file':
    command += ['-f', str(Path(sys.argv[2]).resolve())]
elif len(sys.argv) == 3 and sys.argv[1] == '--query':
    command += ['-At', '-c', sys.argv[2]]
else:
    raise SystemExit('Use --file SQL_PATH or --query SQL')
result = subprocess.run(command, env=env, capture_output=True, encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
print(result.stdout, end='')
if result.returncode:
    print(result.stderr, file=sys.stderr)
raise SystemExit(result.returncode)
