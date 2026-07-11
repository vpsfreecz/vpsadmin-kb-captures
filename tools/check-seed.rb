# frozen_string_literal: true

require_relative '../cluster/seed-production-shape'

confirmed = capture_nas_confirmation_state(Array.new(4, :confirmed))
pending = capture_nas_confirmation_state(Array.new(4, :confirm_create))
mixed = capture_nas_confirmation_state([:confirmed, :confirm_create, :confirmed, :confirmed])
incomplete = capture_nas_confirmation_state(Array.new(3, :confirm_create))
unsupported = capture_nas_confirmation_state(Array.new(4, :confirm_destroy))

raise "unexpected confirmed state: #{confirmed.inspect}" unless confirmed == :confirmed
raise "unexpected pending state: #{pending.inspect}" unless pending == :pending
raise "mixed confirmation state accepted: #{mixed.inspect}" unless mixed == :drift
raise "incomplete confirmation state accepted: #{incomplete.inspect}" unless incomplete == :drift
raise "unsupported confirmation state accepted: #{unsupported.inspect}" unless unsupported == :drift
