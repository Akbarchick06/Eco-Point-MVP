const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'school.json');
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
console.log('Данные удалены. Запустите npm start, чтобы создать демо-базу заново.');
