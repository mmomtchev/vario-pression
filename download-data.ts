import * as fs from 'node:fs';
import axios from 'axios';

async function main(station: string) {

  console.log('Downloading for station', process.argv[2]);

  let date = new Date(Date.parse('2025-08-11T21:00:00Z'));
  console.log('start from ', date.toDateString());

  while (date.getTime() < Date.now()) {
    const url = `https://donneespubliques.meteofrance.fr/donnees_libres/Txt/RS_HR_complet/${process.argv[2]}` +
      `.${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}12.csv`;
    console.log('downloading for', date.toDateString(), 'from', url);
    const data = (await axios.get(url)).data;
    await fs.promises.mkdir(`data/${station}`, { recursive: true });
    await fs.promises.writeFile(`data/${station}/${date.toDateString()}.csv`, data);
    console.log(`wrote data/${station}/${date.toDateString()}.csv`);
    date = new Date(date.getTime() + 24 * 3600 * 1000);
  }
}

main(process.argv[2]);
