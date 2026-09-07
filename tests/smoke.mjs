import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function expect(condition,message){if(!condition)throw new Error(message)}

const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.json'));

expect(sw.includes("const CACHE = 'devis-acj-v31';"),'Le cache PWA doit être v31');
for(const asset of ['index.html','manifest.json','ai-v17.js','auth-v29-2.js','ogust-write-v19.js','client-step-v21.js','multi-ogust-v28.js','prestation-sync-v24.js','costs-v28-1.js','ogust-units-v25.js','history-v29.js','history-delete-v29-1.js','ux-v30.js','availability-v31.js']){
  expect(fs.existsSync(asset),`Asset manquant: ${asset}`);
  expect(sw.includes(`./${asset}`),`Asset non préchargé dans sw.js: ${asset}`);
}
for(const legacy of ['ai-v12.js','ai-v14.js','ai-v15.js','ai-v16.js']){
  expect(!fs.existsSync(legacy),`Ancien module encore présent: ${legacy}`);
  expect(!sw.includes(legacy),`Ancien module encore référencé: ${legacy}`);
}
expect(manifest.name&&manifest.short_name,'Manifest PWA incomplet');
expect(Array.isArray(manifest.icons)&&manifest.icons.length>=2,'Icônes PWA manquantes');
expect(manifest.theme_color==='#ffffff','Le thème PWA doit rester clair');
expect(read('auth-v29-2.js').includes("/api/ogust-devis"),'Détection auth v29.2 absente');
expect(read('multi-ogust-v28.js').includes('/api/ogust-quotation'),'Routage multi-Ogust devis absent');
expect(read('ux-v30.js').includes("STEP_LABELS=['Client','Chantier','Chiffrage','Validation']"),'Stepper UX v30 incomplet');
const availability=read('availability-v31.js');
for(const name of ['Jean-Baptiste','Vincent','Yohann'])expect(availability.includes(name),`Règle Google manquante pour ${name}`);
expect(availability.includes("others:'ogust'"),'Règle Ogust des autres intervenants absente');
expect(availability.includes("activity()"),'Le métier du devis doit piloter la recherche de disponibilité');

console.log('Smoke tests Devis ACJ: OK');
