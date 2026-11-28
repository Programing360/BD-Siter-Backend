const path = require('path');
const fs = require('fs');
const mongoose = require(path.resolve(__dirname, '../../node_modules/mongoose'));
const dotenv = require(path.resolve(__dirname, '../../node_modules/dotenv'));

const envPath = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env')
].find(p => fs.existsSync(p));

if (envPath) dotenv.config({ path: envPath });

async function fixOrders() {
  const uri = process.env.MONGO_URI;
  console.log('Connecting to MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const orderCol = db.collection('orders');

  const indexes = await orderCol.indexes();
  console.log('Order indexes:', indexes.map(i => i.name));

  const hasOrderNum = indexes.some(i => i.name === 'orderNumber_1');
  if (hasOrderNum) {
    console.log('Dropping orderNumber_1 index...');
    await orderCol.dropIndex('orderNumber_1');
    console.log('Dropped orderNumber_1 index.');
  }

  // Backfill any orders missing orderNumber
  const nullOrders = await orderCol.find({
    $or: [{ orderNumber: null }, { orderNumber: { $exists: false } }]
  }).toArray();

  console.log('Found orders without orderNumber:', nullOrders.length);
  for (const ord of nullOrders) {
    const num = 'BDS-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
    await orderCol.updateOne({ _id: ord._id }, { $set: { orderNumber: num } });
    console.log('Updated order', ord._id.toString(), 'with orderNumber', num);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

fixOrders().catch(e => {
  console.error(e);
  process.exit(1);
});
