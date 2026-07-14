// Merges all part_*.json files (sorted) into the final output array.
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const outFile = process.argv[2];

const files = fs.readdirSync(dir)
  .filter(f => /^part_\d+\.json$/.test(f))
  .sort();

let all = [];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  all = all.concat(data);
}

fs.writeFileSync(outFile, JSON.stringify(all, null, 0));
console.error(`Merged ${files.length} part files -> ${all.length} entries -> ${outFile}`);
