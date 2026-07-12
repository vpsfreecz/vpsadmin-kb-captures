#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'optparse'
require 'yaml'

options = {}
OptionParser.new do |parser|
  parser.on('--candidate-index FILE') { |value| options[:input] = File.expand_path(value) }
  parser.on('--output FILE') { |value| options[:output] = File.expand_path(value) }
end.parse!

abort 'provide --candidate-index and --output' unless options.values_at(:input, :output).all?

index = JSON.parse(File.read(options.fetch(:input)))
bindings = index.fetch('annotations').group_by do |item|
  item.values_at('language', 'page', 'path')
end.map do |(language, page, path), items|
  {
    'language' => language,
    'page' => page,
    'path' => path,
    'count' => items.sum { |item| item.fetch('count') }
  }
end.sort_by { |item| item.values_at('language', 'page', 'path') }

contract = {
  'schema' => 1,
  'bindings' => bindings,
  'exceptions' => index.fetch('exceptions').sort_by do |item|
    item.values_at('language', 'page', 'path')
  end
}
File.write(options.fetch(:output), YAML.dump(contract))
puts "Imported #{bindings.length} annotation bindings and #{contract.fetch('exceptions').length} exceptions"
