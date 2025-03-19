const express = require('express');
const PORT = 5000;
const app = express();
const AWS = require('aws-sdk');
require("dotenv").config();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('./view'));

app.set('view engine', 'ejs');
app.set('views', './view');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const Db = new AWS.DynamoDB.DocumentClient();
const table_name = "Subject";


app.get('/', (req, res) => {
    const params = {
        TableName: table_name,
    };

    Db.scan(params, (err, data) => {
        if (err) {
            console.error("Error fetching data from DynamoDB:", err);
            return res.send("Error retrieving data from the database.");
        } else {
            return res.render('index', { subjects: data.Items });
        }
    });
});

app.post('/save', (req, res) => {
    const { id, tenMon, loaiMon, hocKy, khoa  } = req.body;

    const params = {
        TableName: table_name,
        Item: {
            id,
            tenMon,
            loaiMon,
            hocKy,
            khoa
        },
    };

    Db.put(params, (err, data) => {
        if (err) {
            console.error("Error adding data to DynamoDB:", err);
            return res.send("Error adding data to the database.");
        } else {
            return res.redirect('/');
        }
    });
});

app.post('/delete', (req, res) => {
    let selectedIds = req.body.ids;

    console.log("Received IDs:", selectedIds); // Kiểm tra dữ liệu đầu vào

    if (!selectedIds) {
        return res.send("No subjects selected for deletion.");
    }

    try {
        selectedIds = JSON.parse(selectedIds); // Lỗi xảy ra ở đây
    } catch (error) {
        console.error("Invalid JSON format:", error);
        return res.send("Invalid data format.");
    }

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        return res.send("No valid subjects selected.");
    }

    console.log("Deleting subjects with IDs:", selectedIds);

    // Xóa từng item theo ID
    const deletePromises = selectedIds.map(id => {
        const params = {
            TableName: table_name,
            Key: { id: id.toString() }
        };
        return Db.delete(params).promise();
    });

    Promise.all(deletePromises)
        .then(() => {
            console.log("Subjects deleted successfully.");
            res.redirect('/');
        })
        .catch(err => {
            console.error("Error deleting subjects:", err);
            res.send("Error deleting subjects.");
        });
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});