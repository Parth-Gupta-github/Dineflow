require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("DATABASE_URL is missing. Add your Supabase connection string to .env first.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

const schemaPath = path.join(__dirname, "..", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

pool.query(schema)
    .then(() => {
        console.log("Database initialized successfully.");
    })
    .catch((error) => {
        console.error("Database initialization failed:");
        console.error(error.message || error);
        if (error.code) {
            console.error(`Code: ${error.code}`);
        }
        if (error.detail) {
            console.error(`Detail: ${error.detail}`);
        }
        if (error.stack) {
            console.error(error.stack);
        }
        process.exitCode = 1;
    })
    .finally(() => pool.end());
