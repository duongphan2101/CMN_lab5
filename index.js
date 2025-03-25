const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const { v4: uuid } = require('uuid');
require("dotenv").config();

const app = express();
const PORT = 5000;

// Cấu hình AWS
AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const Db = new AWS.DynamoDB.DocumentClient();
const table_name = "Subject";

// Cấu hình Multer (upload file vào bộ nhớ)
const Storage = multer.memoryStorage();
const upload = multer({
    storage: Storage,
    limits: { fileSize: 2000000 },
    fileFilter(req, file, cb) {
        const fileType = /jpeg|jpg|png|gif/;
        const extname = fileType.test(file.originalname.split('.').pop().toLowerCase());
        const mimetype = fileType.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        return cb(new Error("Error: Only images are allowed!"));
    }
});

// Cấu hình Express
app.use(express.urlencoded({ extended: true }));
app.use(express.static('./view'));
app.set('view engine', 'ejs');
app.set('views', './view');

// Route lấy danh sách môn học
app.get('/', (req, res) => {
    const params = { TableName: table_name };

    Db.scan(params, (err, data) => {
        if (err) {
            console.error("Error fetching data from DynamoDB:", err);
            return res.send("Error retrieving data from the database.");
        } else {
            return res.render('index', { subjects: data.Items });
        }
    });
});

// Route thêm môn học
app.post('/save', upload.single('hinhAnh'), (req, res) => {
    if (!req.file) return res.send("No file uploaded.");

    const fileExt = req.file.originalname.split('.').pop();
    const filePath = `${uuid()}_${Date.now()}.${fileExt}`;

    const param = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: filePath,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
    };

    s3.upload(param, (err, data) => {
        if (err) {
            console.error("Error uploading file to S3:", err);
            return res.send("Error uploading file to S3.");
        }

        const newSubject = {
            TableName: table_name,
            Item: {
                id: req.body.id,
                tenMon: req.body.tenMon,
                loaiMon: req.body.loaiMon,
                hocKy: req.body.hocKy,
                hinhAnh: data.Location,
                khoa: req.body.khoa
            }
        };

        Db.put(newSubject, (err) => {
            if (err) {
                console.error("Error adding data to DynamoDB:", err);
                return res.send("Error adding data to the database.");
            }
            res.redirect('/');
        });
    });
});

// Route xóa môn học
app.post('/delete', (req, res) => {
    let selectedIds = req.body.ids;

    if (!selectedIds) return res.send("No subjects selected for deletion.");

    try {
        selectedIds = JSON.parse(selectedIds);
    } catch (error) {
        console.error("Invalid JSON format:", error);
        return res.send("Invalid data format.");
    }

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
        return res.send("No valid subjects selected.");
    }

    console.log("Deleting subjects with IDs:", selectedIds);

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

// Khởi chạy server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
