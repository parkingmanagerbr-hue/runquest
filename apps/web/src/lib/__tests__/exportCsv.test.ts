import { describe, it, expect } from 'vitest';
import { runsToCsv, runToCsvRow, CSV_HEADER, type CsvRun } from '../exportCsv';

const base: CsvRun = {
  startedAt: '2026-07-15T10:30:00.000Z',
  distanceMeters: 5000,
  durationSec: 1500,
  avgPaceSecPerKm: 300,
  source: 'GPS',
};

describe('runToCsvRow', () => {
  it('formata uma corrida normal', () => {
    expect(runToCsvRow(base)).toBe('"2026-07-15 10:30:00",5.00,25.0,"5:00","GPS"');
  });

  it('C.5: corrida sem GPS (pace 0) → campo de pace vazio, nunca "NaN:NaN"', () => {
    const row = runToCsvRow({ ...base, avgPaceSecPerKm: 0 });
    expect(row).toContain(',"",'); // pace vazio
    expect(row).not.toContain('NaN');
  });

  it('C.5: campos numéricos ausentes não viram "NaN"', () => {
    const row = runToCsvRow({ ...base, distanceMeters: NaN, durationSec: NaN, avgPaceSecPerKm: NaN });
    expect(row).not.toContain('NaN');
    expect(row).toContain(',0.00,'); // distância cai para 0.00
    expect(row).toContain(',0.0,'); // duração cai para 0.0
  });

  it('data inválida → campo de data vazio (sem "Invalid Date")', () => {
    const row = runToCsvRow({ ...base, startedAt: 'not-a-date' });
    expect(row).not.toContain('Invalid');
    expect(row.startsWith('"",')).toBe(true);
  });

  it('escapa aspas na fonte (sem quebrar o CSV)', () => {
    expect(runToCsvRow({ ...base, source: 'Strava "import"' })).toContain('"Strava ""import"""');
  });
});

describe('runsToCsv', () => {
  it('inclui o cabeçalho e uma linha por corrida', () => {
    const csv = runsToCsv([base, base]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(3);
  });

  it('lista vazia → só o cabeçalho', () => {
    expect(runsToCsv([])).toBe(CSV_HEADER);
  });
});
