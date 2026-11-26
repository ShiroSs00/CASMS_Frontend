import { uuid } from './pos-contracts';

export type TerminalIdentity = { terminalId: string; shipId: string; areaId: string; cruiseId: string };
export type LabeledTerminalChoice = TerminalIdentity & { name: string; code: string; areaName?: string | null; cruiseName?: string | null };

/** Physical terminal, ship, operating area and voyage form one selectable context. */
export function terminalChoiceKey(choice: TerminalIdentity) {
  return [choice.terminalId, choice.shipId, choice.areaId, choice.cruiseId]
    .map(value => uuid.parse(value).toLowerCase()).join(':');
}

export function selectedTerminalChoice<T extends TerminalIdentity>(rows: readonly T[], key: string) {
  return key ? rows.find(row => terminalChoiceKey(row) === key) : undefined;
}

export function terminalChoiceItems(rows: readonly LabeledTerminalChoice[]) {
  const labels = rows.map(row => `${row.name} · ${row.code} · ${row.areaName?.trim() || `Khu vực chưa có tên (${row.areaId})`} · ${row.cruiseName?.trim() || `Chuyến ${row.cruiseId}`}`);
  return rows.map((row, index) => ({
    id: terminalChoiceKey(row),
    label: labels.some((label, other) => other !== index && label === labels[index])
      ? `${labels[index]} · Tàu ${row.shipId} · Khu vực ${row.areaId} · Chuyến ${row.cruiseId}` : labels[index],
  }));
}
