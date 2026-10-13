# Screen map

Status: CONFIRMED for WEB-REG-001 mappings; other product screens remain UNCONFIRMED.

Source: `docs/tasks/WEB-REG-001.md` and Figma file `BKLkzpHzVteitEbRhx3oKg`, page node `30:5`.

| Technical ID | Route | Implementation | Figma | Status |
| --- | --- | --- | --- | --- |
| TECH-WEB-001 | `/` | `src/features/home` | UNCONFIRMED | CONFIRMED technical shell; not a product screen |
| WEB-OIM-LIST | `/admin/issues` | `src/features/operational-issues` | `135:4588`, `135:5293`, `135:5361` | CONFIRMED mock UI; FOREP.sql current-state boundary |
| WEB-OIM-DETAIL | `/admin/issues/:issueId` | `src/features/operational-issues` | `135:4689`, `135:4835`, `135:5001`, `135:5077`, `135:5143`, `135:5417` | CONFIRMED mock UI; no persisted audit/history |
| WEB-REG-R01 | `/admin/regulations` | `src/features/regulations` | `231:6742` | List/search/filter |
| WEB-REG-R02 | `/admin/regulations/:regulationId` | `src/features/regulations` | `231:6827` | Detail/status actions |
| WEB-REG-R03/R04 | `/admin/regulations/new`, `/admin/regulations/:regulationId/edit` | `src/features/regulations` | `231:6883`, `232:6798` | Create/edit/validation/value lock |
| WEB-REG-R05/R11/R12 | Same owning route; dialog or state | `src/features/regulations` | `232:6865`, `233:6994`, `233:7038` | Status confirmation, conflicts and feedback states |
| WEB-REG-R06/R08/R10 | `/admin/ships/:shipId/regulations` | `src/features/regulations` | `232:6901`, `233:6838`, `233:6960` | Ship assignments/dialogs |
| WEB-REG-R07/R09/R10 | `/admin/cruises/:cruiseId/regulations` | `src/features/regulations` | `232:6962`, `233:6899`, `233:6960` | Cruise assignments/dialogs |

R08–R12 là dialog/state thuộc route sở hữu, không tạo route độc lập. R13 (`235:6912`) là handoff map, không phải màn hình runtime.
