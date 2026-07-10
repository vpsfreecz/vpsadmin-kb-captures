#!/usr/bin/env ruby
# frozen_string_literal: true

require 'devcluster_runner'

exit DevClusters::OsVmRunner.run(
  ARGV,
  hash_base: 'vpsadmin-devcluster',
  priority_machines: ['services']
)
