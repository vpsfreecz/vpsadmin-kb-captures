# Screenshot development cluster

This directory contains the complete NixOS/vpsAdminOS cluster definition and
seed configuration used by `bin/devcluster`. The flake lock pins its upstream
software revisions.

The default `single` topology contains a services VM and one vpsAdminOS node.
Seed data uses only `example.test` identities and documentation address ranges.
Screenshot scenarios add their labeled, idempotent fixtures through the WebUI
after the base cluster is ready.

All mutable state is outside this directory in the ignored `.devcluster/`
tree. Do not place credentials, generated certificates, SSH keys, or VM state
in Git.
