const bcrypt = require("bcryptjs");
const db = require("./src/db");

const email = "admin@fifa26.control";
const password = "ChangeMoi123!";

const hash = bcrypt.hashSync(password, 10);

const result = db
  .prepare("UPDATE users SET password_hash = ? WHERE email = ?")
  .run(hash, email);

console.log(`Comptes modifiés : ${result.changes}`);

if (result.changes === 1) {
  console.log("Mot de passe admin réinitialisé avec succès.");
  console.log(`Email : ${email}`);
  console.log(`Mot de passe : ${password}`);
} else {
  console.log("Compte admin introuvable.");
}
