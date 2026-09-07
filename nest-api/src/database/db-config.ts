import * as dotenv from 'dotenv';

dotenv.config();

export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  masterUrl: string;
  databaseUrl: string;
}

export function getDbConfig(): DbConfig {
  dotenv.config();

  const urlStr =
    process.env.MASTER_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DB_URL;

  let host = process.env.DB_HOST || '127.0.0.1';
  let port = Number(process.env.DB_PORT) || 3306;
  let user = process.env.DB_USERNAME || 'root';
  let password = process.env.DB_PASSWORD || '';
  let database = process.env.DB_DATABASE || 'zelton';

  if (urlStr) {
    try {
      const parsed = new URL(urlStr);
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) port = Number(parsed.port);
      if (parsed.username) user = decodeURIComponent(parsed.username);
      if (parsed.password) password = decodeURIComponent(parsed.password);

      const dbFromPath = parsed.pathname ? parsed.pathname.replace(/^\//, '') : '';
      if (dbFromPath) database = dbFromPath;
    } catch (e) {
      console.warn('Could not parse database connection string, falling back to DB_* environment variables.');
    }
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
  const masterUrl = `mysql://${encodedUser}${encodedPass}@${host}:${port}`;
  const databaseUrl = `${masterUrl}/${database}`;

  return {
    host,
    port,
    user,
    password,
    database,
    masterUrl,
    databaseUrl,
  };
}
