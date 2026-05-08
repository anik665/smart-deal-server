// encode.js
const fs = require("fs");
const key = fs.readFileSync(
  "./smart-deal-ee1ad-firebase-adminsdk-fbsvc-913f32b252.json",
  "utf8",
);
const base64 = Buffer.from(key).toString("base64");
console.log(base64);
