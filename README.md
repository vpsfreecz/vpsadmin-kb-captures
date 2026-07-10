# vpsAdmin KB captures

This repository makes vpsAdmin documentation screenshots reproducible. It
contains the complete asset inventory, its own pinned vpsAdmin development
cluster, deterministic screenshot fixtures, and Playwright capture scenarios
for the WebUI, remote console, and CLI.

It is self-contained at runtime. The Nix lock file pins upstream vpsAdmin,
vpsAdminOS, and supporting sources; no external checkout layout or helper
repository is required.

## Quick start

Enter the pinned shell, start an isolated cluster, and run the captures:

```sh
nix develop
bin/devcluster start kb-captures --topology single
bin/capture --cluster kb-captures --language cs
bin/validate --update
bin/validate
bin/devcluster stop kb-captures
```

Bridge networking is the default. Use `--network local` when another bridge
cluster is active or bridge privileges are unavailable. Runtime state,
certificates, SSH keys, logs, and generated cluster configuration are stored in
the ignored `.devcluster/` directory.

The capture command reads the cluster's generated test accounts, verifies the
pinned vpsAdmin revision, creates or reuses only fixtures owned by this
repository, selects the requested locale, and writes PNG files under
`screenshots/<topic>/<language>/`. Fixtures can create the two documentation
VPSes, a labeled snapshot, a public key, an unconfirmed TOTP device, console
generation metadata, and network traffic. Never point the tooling at a shared
or production cluster.

Use `--scenario NAME` to recapture a functional group or
`--checkpoint TOPIC/VIEW` for one asset. Run `bin/devcluster --help` for cluster
lifecycle and inspection commands.

## Naming and inventory

Screenshots use stable semantic paths, for example:

```text
screenshots/console/cs/web-console.png
screenshots/datasets/cs/create-dataset-form.png
```

The corresponding DokuWiki media IDs follow the same topic, language, and
semantic slug. Display-order prefixes and revision suffixes are deliberately
absent: scenario code defines capture order, while Git and DokuWiki provide
revision history.

`captures.json` records the legacy KB media ID and source pages, canonical
draft and permanent media IDs, language, topic, scenario/checkpoint, driver,
fixtures, pinned vpsAdmin commit, viewport, dimensions, SHA-256, and capture
provenance. One scenario can emit several related screenshots, but every
individual bitmap has an independently addressable semantic checkpoint.

`bin/validate --update` accepts capture results only when their ID, checkpoint,
driver, output path, and SHA-256 agree with the manifest and generated file.
Review the image and manifest diffs, then run strict `bin/validate`.
`bin/contact-sheet [TOPIC_OR_SCENARIO]` writes an ignored visual review sheet
under `tmp/`.

Captures are intentionally operator-run. This repository contains no GitHub
Actions workflow and no DokuWiki uploader.
