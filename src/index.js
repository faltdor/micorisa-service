const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const readingsRouter = require('./routes/readings');
app.use('/api/readings', readingsRouter);

app.get('/', (req, res) => {
    res.send('micoriza Node.js backend running');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
