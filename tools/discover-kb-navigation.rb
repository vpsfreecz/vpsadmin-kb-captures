#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'optparse'
require 'yaml'
require_relative 'kb_navigation_discovery'

options = {}
OptionParser.new do |parser|
  parser.on('--index FILE') { |value| options[:index] = File.expand_path(value) }
end.parse!
abort 'usage: discover-kb-navigation.rb --index FILE' unless options[:index]

index_path = options.fetch(:index)
index = JSON.parse(File.read(index_path))
root = File.dirname(index_path)
pages = index['pages'] || index.flat_map do |language, entries|
  entries.map { |entry| entry.merge('language' => language) }
end

discoveries = pages.flat_map do |page|
  KbNavigationDiscovery.discover(
    language: page.fetch('language'),
    page: page.fetch('id'),
    content: File.read(File.join(root, page.fetch('file')))
  )
end.sort_by { |entry| entry.values_at('language', 'page', 'id') }

puts YAML.dump('schema' => 1, 'discoveries' => discoveries)
