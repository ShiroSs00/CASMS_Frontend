
## OceVie UI requirements

Follow the mandatory OceVie checklist in ../AGENTS.md for every UI change in CASMS_WebAdmin. Before editing, read ../design-systems/ocevie/DESIGN.md and ../design-systems/ocevie/tokens.css, then inspect src/shared/ui/AdminUI.tsx and src/shared/ui/admin-v3/, the applicable shared components, and src/shared/ui/Overlay.tsx.

Reuse suitable shared components and extend their variants as needed. Keep a single implementation of Button, Field, Modal, Drawer, Badge, and other primitives in this app. Use the canonical token mapping in src/styles/tokens.css for interface styles and preserve this app's layout and interaction patterns. Check keyboard access and responsive behavior, review consistency with nearby screens, and report deviations. Ask before establishing a new pattern that conflicts with OceVie.
