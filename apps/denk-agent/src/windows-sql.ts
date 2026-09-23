import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { localConnectionString, type SqlPort } from "./eta-session.ts";
import { WindowsAuthError } from "./windows-auth.ts";

const execFileAsync = promisify(execFile);

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
