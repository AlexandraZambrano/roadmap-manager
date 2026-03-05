import mongoose from 'mongoose';

const uri = 'mongodb+srv://alezambrano03:Simpson2003@newcluster.wljpwue.mongodb.net/f5-dash?appName=newCluster';

try {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const EI = mongoose.model('EI', new mongoose.Schema({}, { strict: false }), 'extendedinfos');
  const docs = await EI.find({}).lean();
  console.log('Total ExtendedInfo docs:', docs.length);

  docs.forEach(d => {
    console.log('\n--- promotionId:', d.promotionId);
    console.log('  team:', (d.team||[]).length, 'items');
    console.log('  resources:', (d.resources||[]).length, 'items');
    console.log('  pildoras:', (d.pildoras||[]).length, 'items');
    console.log('  modulesPildoras:', (d.modulesPildoras||[]).length, 'items');
    console.log('  competences:', (d.competences||[]).length, 'items');
    console.log('  evaluation (60ch):', (d.evaluation||'').substring(0,60));
    console.log('  school:', d.school || '(empty)');
    console.log('  presentialDays:', d.presentialDays || '(empty)');
    console.log('  schedule:', JSON.stringify(d.schedule||{}).substring(0,120));
  });

  await mongoose.disconnect();
  console.log('\nDone.');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
