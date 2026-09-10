export default () => ({
    port: parseInt(process.env.PORT, 10) || 3002,
    database: {
        url: process.env.DATABASE_URL,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiration: process.env.JWT_EXPIRATION,
        refreshSecret: process.env.JWT_REFRESH_SECRET,
        refreshExpiration: process.env.JWT_REFRESH_EXPIRATION,
    },
    swagger: {
        path: process.env.SWAGGER_PATH || '/api/docs',
        user: process.env.SWAGGER_USER,
        password: process.env.SWAGGER_PASSWORD,
    },
});
