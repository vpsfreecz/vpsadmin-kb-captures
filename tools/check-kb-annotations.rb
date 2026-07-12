#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'optparse'
require 'yaml'
require_relative 'kb_navigation_discovery'

options = {
  navigation: File.expand_path('../contract/navigation.yml', __dir__),
  annotations: File.expand_path('../contract/kb-annotations.yml', __dir__),
  inventory: File.expand_path('../contract/kb-navigation-inventory.yml', __dir__)
}
OptionParser.new do |parser|
  parser.on('--navigation FILE') { |value| options[:navigation] = File.expand_path(value) }
  parser.on('--annotations FILE') { |value| options[:annotations] = File.expand_path(value) }
  parser.on('--inventory FILE') { |value| options[:inventory] = File.expand_path(value) }
  parser.on('--candidate-index FILE') { |value| options[:candidate_index] = File.expand_path(value) }
end.parse!

navigation = YAML.safe_load_file(options.fetch(:navigation))
annotations = YAML.safe_load_file(options.fetch(:annotations))
abort 'annotation contract schema must be 1' unless annotations.fetch('schema') == 1

languages = navigation.fetch('languages')
paths = navigation.fetch('paths')
paths_by_id = paths.to_h { |path| [path.fetch('id'), path] }

validate_entry = lambda do |entry, kind|
  language = entry.fetch('language')
  page = entry.fetch('page')
  path_id = entry.fetch('path')
  abort "#{kind}: unknown language #{language}" unless languages.include?(language)
  path = paths_by_id[path_id]
  abort "#{kind}: unknown path #{path_id}" unless path
  unless path.fetch('pages').fetch(language).include?(page)
    abort "#{kind}: #{language}:#{page} is not affected by #{path_id}"
  end
end

bindings = annotations.fetch('bindings')
exceptions = annotations.fetch('exceptions')
bindings.each { |entry| validate_entry.call(entry, 'binding') }
exceptions.each do |entry|
  validate_entry.call(entry, 'exception')
  abort 'annotation exception reason must not be blank' if entry.fetch('reason').strip.empty?
end

binding_keys = bindings.map { |item| item.values_at('language', 'page', 'path') }
exception_keys = exceptions.map { |item| item.values_at('language', 'page', 'path') }
abort 'duplicate KB annotation bindings' unless binding_keys.uniq.length == binding_keys.length
abort 'duplicate KB annotation exceptions' unless exception_keys.uniq.length == exception_keys.length
overlap = binding_keys & exception_keys
abort "annotation bindings overlap exceptions: #{overlap.inspect}" unless overlap.empty?

expected_keys = paths.flat_map do |path|
  languages.flat_map do |language|
    path.fetch('pages').fetch(language).map { |page| [language, page, path.fetch('id')] }
  end
end.uniq.sort
covered_keys = (binding_keys + exception_keys).uniq.sort
unless covered_keys == expected_keys
  missing = expected_keys - covered_keys
  extra = covered_keys - expected_keys
  abort "annotation inventory mismatch; missing=#{missing.inspect}, extra=#{extra.inspect}"
end

if options[:candidate_index]
  index_path = options.fetch(:candidate_index)
  index = JSON.parse(File.read(index_path))
  root = File.dirname(index_path)
  actual = Hash.new(0)
  tag_pattern = /<vpsadmin-nav\s+id="([a-z][a-z0-9.-]*)">(.*?)<\/vpsadmin-nav>/m

  index.fetch('pages').each do |page|
    content = File.read(File.join(root, page.fetch('file')))
    matches = content.scan(tag_pattern)
    unless content.scan('<vpsadmin-nav').length == matches.length &&
           content.scan('</vpsadmin-nav>').length == matches.length
      abort "#{page.fetch('language')}:#{page.fetch('id')}: malformed annotation tags"
    end

    matches.each do |path_id, body|
      abort "unknown annotation path #{path_id}" unless paths_by_id.key?(path_id)
      abort "#{path_id}: annotation body must not be blank" if body.strip.empty?
      actual[[page.fetch('language'), page.fetch('id'), path_id]] += 1
    end
  end

  expected = bindings.to_h do |entry|
    [entry.values_at('language', 'page', 'path'), entry.fetch('count')]
  end
  unless actual == expected
    abort "candidate annotation counts differ; expected=#{expected.inspect}, actual=#{actual.inspect}"
  end

  inventory = YAML.safe_load_file(options.fetch(:inventory))
  abort 'KB navigation inventory schema must be 1' unless inventory.fetch('schema') == 1
  page_counts = index.fetch('pages').group_by { |page| page.fetch('language') }
                     .transform_values(&:length)
  unless page_counts == inventory.fetch('page_counts')
    abort "candidate page inventory differs; expected=#{inventory.fetch('page_counts').inspect}, actual=#{page_counts.inspect}"
  end

  discoveries = index.fetch('pages').flat_map do |page|
    KbNavigationDiscovery.discover(
      language: page.fetch('language'),
      page: page.fetch('id'),
      content: File.read(File.join(root, page.fetch('file')))
    )
  end
  discovered_by_id = discoveries.to_h { |entry| [entry.fetch('id'), entry] }
  inventory_entries = inventory.fetch('discoveries')
  inventory_by_id = inventory_entries.to_h { |entry| [entry.fetch('id'), entry] }
  abort 'duplicate discovered navigation IDs' unless discovered_by_id.length == discoveries.length
  abort 'duplicate inventoried navigation IDs' unless inventory_by_id.length == inventory_entries.length

  unless discovered_by_id.keys.sort == inventory_by_id.keys.sort
    missing = discovered_by_id.keys - inventory_by_id.keys
    stale = inventory_by_id.keys - discovered_by_id.keys
    abort "independent navigation inventory mismatch; unclassified=#{missing.inspect}, stale=#{stale.inspect}"
  end

  discoveries.each do |discovery|
    inventoried = inventory_by_id.fetch(discovery.fetch('id'))
    %w[language page text].each do |key|
      abort "#{discovery.fetch('id')}: inventory #{key} drift" unless inventoried.fetch(key) == discovery.fetch(key)
    end
    expected_paths = inventoried.fetch('paths', []).sort
    actual_paths = discovery.fetch('paths', []).sort
    unless expected_paths == actual_paths
      abort "#{discovery.fetch('id')}: inventoried paths differ; expected=#{expected_paths.inspect}, actual=#{actual_paths.inspect}"
    end
    reason = inventoried['reason']
    if expected_paths.empty?
      abort "#{discovery.fetch('id')}: unbound discovery reason must not be blank" unless reason.is_a?(String) && !reason.strip.empty?
    elsif reason
      abort "#{discovery.fetch('id')}: bound discovery must not have an exception reason"
    end
  end
end

puts "Valid KB annotation inventory: #{bindings.length} bindings, #{exceptions.length} exceptions"
