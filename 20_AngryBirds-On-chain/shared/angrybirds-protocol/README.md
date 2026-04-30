# Angry Birds Shared Protocol

This folder is the single source of truth for cross-language Angry Birds gameplay evidence rules.

- `spec.json`: fixed protocol constants and canonical JSON field order
- `fixtures/valid-run-evidence.json`: valid evidence shared by TS and Rust tests
- `fixtures/invalid-checkpoint-gap-run-evidence.json`: invalid evidence shared by TS and Rust tests

The frontend and Rust backend should both derive evidence hashing and run id generation from this protocol layer.
