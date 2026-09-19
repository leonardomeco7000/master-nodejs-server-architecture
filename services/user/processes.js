const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dbPath = path.join(__dirname, "db", "database.sqlite");

let db;


function login(req,res,data) {
    console.log(data);
  const user = getUserByMail(data.jsonParam.email);

  const password = data.modules.crypto.createHash(data.jsonParam.password);
  data.modules.log.log(JSON.stringify(data));

      console.log(password);
  if (!user) {
      return {
          valid: false,
          error: "Email o password non validi"
      };
  }


  if (password !== user.password) {
      return {
          valid: false,
          error: "Email o password non validi"
      };
  }

  const cookie = crypto.randomBytes(32).toString("hex");

  const now = Date.now();
  const expires = now + (30 * 24 * 60 * 60 * 1000);

  db = new DatabaseSync(dbPath);

  db.prepare(`
      INSERT INTO login (
          user_id,
          cookie,
          created_at,
          expires_at
      )
      VALUES (?, ?, ?, ?)
  `).run(
      user.id,
      cookie,
      now,
      expires
  );

  res.setHeader(
      "Set-Cookie",
      `login=${cookie}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`
  );

  return {
      valid: true,
      user: {
          id: user.id,
          email: user.email,
          name: user.name
      }
  };
}

function getUserByLoginToken(token) {

 
  db = new DatabaseSync(dbPath);

  const statement = db.prepare(`
      SELECT user.*
      FROM login
      JOIN user ON user.id = login.user_id
      WHERE login.cookie = ?
        AND login.expires_at > ?
  `).get(token, Date.now());

  return statement;
}

function loadUser(req, res, data) {
  const cookies = req.headers.cookie || "";

  const match = cookies
      .split(";")
      .map(v => v.trim())
      .find(v => v.startsWith("login="));
      
  if (!match) {
    
      return {
          valid: false,
          error: "Utente non autenticato"
      };
  }

  const token = match.substring("login=".length);

  const user =  getUserByLoginToken(token);

  if (!user) {
      return {
          valid: false,
          error: "Sessione non valida"
      };
  }

  data.user = user;

  return {
      valid: true
  };
}

function profile( req, res, data) {
console.log(data);
  return {
      valid: true,
      user: data.user
  };
}

function getUserByMail(email) {

  db = new DatabaseSync(dbPath);

    const statement = db.prepare(`
        SELECT *
        FROM user
        WHERE email = ?
    `);

    return statement.get(email) || null;
}
function initDB() {

    const dir = path.dirname(dbPath);

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new DatabaseSync(dbPath);

    db.exec(`
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            name TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS login (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cookie TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );
    `);

    return db;
}

function logout( req,res,data) {

  const cookies = req.headers.cookie || "";

  const match = cookies.match(/(?:^|;\s*)login=([^;]+)/);

  if (match) {

      const token = match[1];
      db = new DatabaseSync(dbPath);

      db.prepare(`
          DELETE FROM login
          WHERE cookie = ?
      `).run(token);
  }

  res.setHeader(
      "Set-Cookie",
      "login=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
  );

  return {
      valid: true
  };
}

function getDB() {
    if (!db) {
        throw new Error("Database non inizializzato");
    }

    return db;
}

module.exports = {
    initDB,
    getDB,
    getUserByMail,
    loadUser,
    login,
    profile,
    logout
};