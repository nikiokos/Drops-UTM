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
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
  },
});
