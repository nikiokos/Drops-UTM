export default () => ({
  port: parseInt(process.env.APP_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    path: process.env.DATABASE_PATH || './data/drops_utm.sqlite',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiration: process.env.JWT_EXPIRATION || '24h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  websocket: {
    port: parseInt(process.env.WS_PORT || '3002', 10),
    corsOrigin: process.env.WS_CORS_ORIGIN || 'http://localhost:3000',
  },
  weather: {
    apiKey: process.env.WEATHER_API_KEY || '',
    apiUrl: process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5',
  },
  dagr: {
    // Official Greek UAS geographical-zones WMS (HCAA / HASP). No key required.
    wmsUrl:
      process.env.DAGR_WMS_URL ||
      'https://dagr.hasp.gov.gr/cgi-bin/mapserv.exe?map=C:/ms4w_3.1.4/MAPFILES/dagr_public_wms.map',
  },
  openaip: {
    // openAIP airspace data + map tiles. Key kept server-side (REST + tile proxy).
    apiKey: process.env.OPENAIP_API_KEY || '',
  },
  anthropic: {
    // Claude API key for the AI authorization agent. Server-side only.
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  autorouter: {
    // NOTAM feed (OAuth2 client_credentials = autorouter account email + password).
    clientId: process.env.AUTOROUTER_CLIENT_ID || '',
    clientSecret: process.env.AUTOROUTER_CLIENT_SECRET || '',
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
  },
});
