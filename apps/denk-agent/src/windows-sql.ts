import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { LOCAL_SQL_SERVERS, localConnectionString, type SqlPort } from "./eta-session.ts";
import { WindowsAuthError } from "./windows-auth.ts";

const execFileAsync = promisify(execFile);

export async function listLocalSqlServers(): Promise<string[]> {
  if (process.platform !== "win32") return [...LOCAL_SQL_SERVERS];
  const script = `
$servers = New-Object System.Collections.Generic.List[string]
$servers.Add('localhost')
$paths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL'
)
foreach ($path in $paths) {
  if (-not (Test-Path $path)) { continue }
  $props = Get-ItemProperty $path
  foreach ($name in $props.PSObject.Properties.Name) {
    if ($name -in @('PSPath','PSParentPath','PSChildName','PSDrive','PSProvider')) { continue }
    if ($name -eq 'MSSQLSERVER') { [void]$servers.Add('localhost') }
    else { [void]$servers.Add(('localhost\\' + $name)) }
  }
}
@($servers | Select-Object -Unique) | ConvertTo-Json -Compress
`;
  try {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      timeout: 8000,
    });
    const parsed = JSON.parse(stdout.trim() || "[]") as unknown;
    const names = (Array.isArray(parsed) ? parsed : [parsed]).map((item) => String(item));
    const safe = names.filter((name) => /^[\w.\\-]+$/.test(name));
    return safe.length > 0 ? safe : ["localhost"];
  } catch {
    return ["localhost"];
  }
}

export function windowsSqlPort(): SqlPort {
  return {
    query(server, database, statement) {
      return queryWindowsSql(server, database, statement);
    },
  };
}

export async function queryWindowsSql(server: string, database: string, statement: string): Promise<Record<string, unknown>[]> {
  if (process.platform !== "win32") {
    throw new WindowsAuthError("Bu ajan yalnız Windows oturumunda çalışır.");
  }
  assertSelect(statement);
  const connectionString = localConnectionString(server, database);
  const script = `
$connection = New-Object System.Data.SqlClient.SqlConnection ${psSingleQuoted(connectionString)}
$connection.Open()
try {
  $command = $connection.CreateCommand()
  $command.CommandText = ${psSingleQuoted(statement)}
  $reader = $command.ExecuteReader()
  $rows = @()
  while ($reader.Read()) {
    $item = [ordered]@{}
    for ($i = 0; $i -lt $reader.FieldCount; $i++) {
      $name = $reader.GetName($i)
      if ($reader.IsDBNull($i)) { $item[$name] = $null } else { $item[$name] = $reader.GetValue($i) }
    }
    $rows += [pscustomobject]$item
  }
  $reader.Close()
  if ($rows.Count -eq 0) { '[]' } else { $rows | ConvertTo-Json -Compress -Depth 5 }
} finally {
  $connection.Close()
}
`;
  let stdout = "";
  try {
    const result = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
      timeout: 20000,
    });
    stdout = result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : "SQL açılamadı.";
    throw new Error(message.replace(connectionString, "Integrated Security").slice(0, 500));
  }
  return parseRows(stdout);
}

function assertSelect(statement: string): void {
  const text = statement.trim();
  if (!/^select\b/i.test(text) || /[;]|--|\/\*|\b(insert|update|delete|drop|alter|exec|execute|xp_)\b/i.test(text)) {
    throw new Error("SQL cümlesi bu kapıdan geçemez.");
  }
}

function psSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseRows(stdout: string): Record<string, unknown>[] {
  const text = stdout.trim();
  if (!text) return [];
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRow);
  if (isRow(parsed)) return [parsed];
  return [];
}

function isRow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
