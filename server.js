const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const bodyParser = require('body-parser');

/*
* status
* 0: normal
* 1: done
* 2: in process
* -1: img not familiar
* */

const app = express();
const port = process.env.PORT || 3004;

console.log("Server starting...");
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});


app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

const uri = "mongodb+srv://conanWinner:Thang2506%40%40@vmdversion0.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Kết nối đến MongoDB một lần và khởi động server sau khi kết nối thành công
client.connect()
    .then(() => {
        console.log("Connected successfully to MongoDB");
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch(err => {
        console.error("MongoDB connection error:", err);
    });

app.get('/api/words', async (req, res) => {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    try {
        const database = client.db('vmd');
        const collection = database.collection('dictionary');
        const words = await collection.find({ status: 0 }).skip(skip).limit(limit).toArray();
        const ids = words.map(word => word._id);
        await collection.updateMany(
            { _id: { $in: ids } },
            { $set: { status: 2, lockedAt: new Date() } }
        );
        res.json(words);
    } catch (err) {
        console.error("Error fetching words:", err);
        res.status(500).send("Error fetching words");
    }
});


app.put('/api/words/:id', async (req, res) => {
    const id = req.params.id;
    const selection = req.body.selection; // ví dụ: { noun: 1, verb: "none" } hoặc { noun: 1 } hoặc { verb: 2 }

    let updateFields = { status: 1 };

    if (selection.noun !== undefined) {
        updateFields["noun.index_img_selected"] = selection.noun;
    }
    if (selection.verb !== undefined) {
        updateFields["verb.index_img_selected"] = selection.verb;
    }
    if (selection.adj !== undefined) {
        updateFields["adj.index_img_selected"] = selection.adj;
    }


    try {
        const database = client.db('vmd');
        const collection = database.collection('dictionary');
        const result = await collection.updateOne(
            { _id: id },
            { $set: updateFields }
        );
        res.json(updateFields);
    } catch (err) {
        console.error("Error updating word:", err);
        res.status(500).send("Error updating word");
    }
});


app.get('/api/stats', async (req, res) => {
    try {
        const database = client.db('vmd');
        const collection = database.collection('dictionary');
        const total = await collection.countDocuments({});
        const status0 = await collection.countDocuments({ status: 0 });
        const status1 = await collection.countDocuments({ status: 1 });
        res.json({ total, status0, status1 });
    } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).send("Error fetching stats");
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

setInterval(async () => {
    try {
        const database = client.db('vmd');
        const collection = database.collection('dictionary');
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const result = await collection.updateMany(
            { status: 2, lockedAt: { $lt: fiveMinutesAgo } },
            { $set: { status: 0 }, $unset: { lockedAt: "" } }
        );
        if(result.modifiedCount > 0) {
            console.log(`${result.modifiedCount} document(s) reset from status 2 to 0`);
        }
    } catch (err) {
        console.error("Error resetting locked words:", err);
    }
}, 60 * 1000);




