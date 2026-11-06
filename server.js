const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { MongoClient } = require("mongodb");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.MONGODB_DB || "gridrush";
const client = new MongoClient(MONGODB_URI);
const sessionStore = MongoStore.create({
    client,
    dbName: DB_NAME,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60
});
let users;

async function establishSession(req, user) {
    await new Promise((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.user = { id: user._id ? user._id.toString() : user.id, name: user.name, email: user.email };
    await new Promise((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
    });
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    name: "gridrush.sid",
    secret: process.env.SESSION_SECRET || "gridrush-local-development-secret-change-before-deploying",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/me", (req, res) => {
    if (!req.session.user) return res.json({ loggedIn: false });
    return res.json({ loggedIn: true, user: req.session.user });
});

app.post("/register", async (req, res) => {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!name || !email || password.length < 6) {
        return res.status(400).json({ message: "Enter your name and email, and use a password with at least 6 characters." });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const created = await users.insertOne({ name, email, passwordHash, createdAt: new Date() });
        await establishSession(req, { id: created.insertedId.toString(), name, email });
        return res.status(201).json({ message: "Account created. You are now signed in." });
    } catch (error) {
        if (error.code === 11000) {
            const existing = await users.findOne({ email });
            if (existing && await bcrypt.compare(password, existing.passwordHash)) {
                await establishSession(req, existing);
                return res.json({ message: "This account already exists. You are now signed in." });
            }
            return res.status(409).json({ message: "An account with this email already exists. Log in with its original password." });
        }
        console.error("Registration failed:", error);
        return res.status(500).json({ message: "Unable to create your account right now." });
    }
});

app.post("/login", async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
        return res.status(400).json({ message: "Enter your email and password." });
    }

    try {
        const user = await users.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: "Email or password is incorrect." });
        }
        await establishSession(req, user);
        return res.json({ message: `Welcome back, ${user.name}!` });
    } catch (error) {
        console.error("Login failed:", error);
        return res.status(500).json({ message: "Unable to log in right now." });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((error) => {
        if (error) return res.status(500).json({ message: "Unable to log out right now." });
        res.clearCookie("gridrush.sid", { httpOnly: true, sameSite: "lax" });
        return res.json({ message: "You are signed out." });
    });
});

async function start() {
    await client.connect();
    const db = client.db(DB_NAME);
    users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true });

    app.listen(PORT, () => {
        console.log(`GridRush server running at http://localhost:${PORT}`);
        console.log(`Connected to MongoDB database: ${db.databaseName}`);
    });
}

start().catch(async (error) => {
    console.error("Could not connect to MongoDB:", error.message);
    await client.close().catch(() => {});
    process.exit(1);
});

process.on("SIGINT", async () => {
    await client.close();
    process.exit(0);
});


