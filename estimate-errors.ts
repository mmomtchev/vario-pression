import * as fs from 'node:fs';
import * as csv from 'csv';
import * as velitherm from 'velitherm';

const errLevels = [500, 1000, 1500, 2000, 2500, 3000, 4000];

type Errors = {
  fixed: number;
  baro: number;
  hypso: number;
  hypso_temp: number;
};

async function estimateErrors(filename: string): Promise<Errors[]> {
  return new Promise((resolve, reject) => {
    let columns = false;
    let ground = false;
    let T0 = 0;
    let P0 = 0;
    let alt0 = 0;
    const ELR = 0.0065;

    const error = [] as Errors[];

    try {
      const stream = fs.createReadStream(filename, 'utf-8')
        .pipe(csv.parse({ from_line: 3, skip_records_with_error: true }));

      let currentErrors = {
        fixed: 0,
        baro: 0,
        hypso: 0,
        hypso_temp: 0
      };
      stream.on('data', (data) => {
        try {
          if (!columns) {
            columns = true;
            return;
          }
          if (!ground) {
            ground = true;
            P0 = +data[0] / 100;
            alt0 = +data[1];
            T0 = +data[2] - 273.15;
            console.log('First level', P0, "alt", alt0, 'MSL pressure', velitherm.pressureFromAltitude(-alt0, P0, T0));
          }
          const P = +data[0] / 100;
          const alt = +data[1];
          const T = +data[2] - 273.15;

          const Pcalc = velitherm.pressureFromAltitude(alt - alt0, P0, (T + T0) / 2);

          /*if (Math.abs(velitherm.altitudeFromPressure(P, P0) - velitherm.altitudeFromStandardPressure(P, P0)) > 5) {
            console.log('ERROR', P, P0, velitherm.altitudeFromPressure(P, P0), velitherm.altitudeFromStandardPressure(P, P0));
            process.exit(1);
          }*/

          const errorsLevel = {
            fixed: alt - velitherm.altitudeFromStandardPressure(P),
            baro: Math.abs(alt - alt0 - velitherm.altitudeFromStandardPressure(P, P0)),
            hypso: Math.abs(alt - alt0 - velitherm.altitudeFromPressure(P, P0)),
            hypso_temp: Math.abs(alt - alt0 - velitherm.altitudeFromPressure(P, P0, (T0 + T0 - (alt - alt0) * ELR) / 2)),
          } as Errors;
          const error_fullData = alt - alt0 - velitherm.altitudeFromPressure(P, P0, (T + T0) / 2);

          //console.log('At', alt, alt - alt0, 'm', 'pressure', P, 'temp', T, 'predicted', Pcalc, T, );
          for (const f of Object.keys(errorsLevel)) {
            if (errorsLevel[f] > currentErrors[f])
              currentErrors[f] = errorsLevel[f];
          }

          if (alt > errLevels[error.length]) {
            error.push(currentErrors);
            currentErrors = {
              baro: 0,
              hypso: 0,
              hypso_temp: 0,
              fixed: 0
            };
          }
        } catch (err) {
          console.error(err);
        }
      });
      stream.on('end', () => {
        resolve(error);
      });
      stream.on('error', (e) => {
        console.error(e);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  let max: Errors[] = [];
  let sum: Errors[] = [];

  for (let l in errLevels) {
    max[l] = {
      fixed: 0,
      baro: 0,
      hypso: 0,
      hypso_temp: 0
    };
    sum[l] = {
      fixed: 0,
      baro: 0,
      hypso: 0,
      hypso_temp: 0
    };
  }

  const files = await fs.promises.readdir(process.argv[2]);
  for (const file of files) {
    const path = `${process.argv[2]}/${file}`;
    console.log('processing', path);
    const errors = await estimateErrors(path);
    for (const l in errLevels) {
      for (const f of Object.keys(errors[l])) {
        sum[l][f] += errors[l][f];
        if (max[l][f] < errors[l][f])
          max[l][f] = errors[l][f];
      }
    }
  }
  for (const l in errLevels) {
    console.log(`for altitudes up to ${errLevels[l]} m:`);
    for (const f of Object.keys(sum[l])) {
      console.log(`\t - ${f.padStart(10)}: ` +
        `mean ${Math.round(sum[l][f] / files.length)} m, ` +
        `maximum ${Math.round(max[l][f])}m `);
    }
  }

  for (const l in errLevels) {
    console.log(`[tr][td] < ${errLevels[l]} m [/td]`);
    for (const f of Object.keys(sum[l])) {
      console.log(`[td] ${Math.round(sum[l][f] / files.length)} m / ` +
        `${Math.round(max[l][f])}m [/td]`);
    }
    console.log('[/tr]');
  }
}

main();
