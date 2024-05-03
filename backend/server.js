// server.js 
const express = require('express'); 
const app = express(); 
const port = 3000; 
 
const mysql = require("mysql2"); 
 
app.use(express.json()) 
 
var cors = require('cors'); 
app.use(cors()); 
 
const connection = mysql.createConnection({ 
    host: "csdeml.ugatu.su", 
    user: "hunting_prey", 
    database: "hunter2.0", 
    password: "c2h5oh#", 
}); 
 
connection.connect(function (err) { 
    if (err) { 
        return console.error("Ошибка: " + err.message); 
    } 
    else { 
        console.log("Подключение к серверу MySQL успешно установлено"); 
    } 
}) 
 
app.get('/api/sendData', (req, res) => { 
    const { photo, latitude, longtitude, prey_date, prey_time } = req.query; 
 
    const query = 'INSERT INTO hunting_prey SET photo = ?, latitude = ?, longtitude = ?, prey_date = ?, prey_time = ?'; 
 
    connection.query(query, [photo, latitude, longtitude, prey_date, prey_time], (err, result) => { 
        if (err) throw err; 
 
        res.send({ message: 'Данные успешно отправлены в MySQL.' }); 
    }); 
}); 
 
app.listen(port, () => { 
    console.log(`Сервер запущен на порту ${port}`); 
});