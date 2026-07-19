const mongoose = require('mongoose');
require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(process.env.MONGODB_URI, { family: 4 })
.then(async () => {
    console.log('Connected');
    try {
        await mongoose.connection.collection('holidays').dropIndex('name_1');
        console.log('Index dropped');
    } catch(e) {
        console.log('Index not dropped or doesn''t exist', e.message);
    }
    process.exit(0);
})
.catch(e => {
    console.error(e);
    process.exit(1);
});
