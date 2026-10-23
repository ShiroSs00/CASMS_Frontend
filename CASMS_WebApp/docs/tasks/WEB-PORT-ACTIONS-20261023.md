# Port detail actions

User requests all port actions beside Edit and removal of the Validate data and Check availability buttons shown in the attached screenshot.

Base: ee89e6cfb53876951070c386a59d0333faf94aae. Baseline diff contains the preceding admin-navigation.ts menu change; existing untracked documents are preserved. Allowed paths: this contract and src/features/itineraries/pages/MasterDataPages.tsx.

Move port activate/deactivate and delete controls into the existing detailActions header row. Remove the separate port actions panel and the two unused check handlers. Preserve permissions, busy locks, confirmation dialogs, destination behavior and all backend APIs. Existing wrapping handles narrow screens. No tests or automated checks per the user's session preference; inspect final source diff.
