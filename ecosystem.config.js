module.exports = {
  apps: [
    {
      name: "matchdiary-backend",
      script: "app.js",
      env: {
        NODE_ENV: "production",
        DB_HOST: process.env.HOST,
        DB_USER: process.env.LOCAL_DB_USER,
        DB_PASSWORD: process.env.LOCAL_DB_PASSWORD,
      },
    },
  ],
};
