#!/usr/bin/env ruby
# frozen_string_literal: true

require 'digest'
require 'json'
require 'optparse'
require 'yaml'

class ContractError < StandardError; end

class PoCatalog
  def self.read(path)
    entries = {}
    msgid = nil
    msgstr = nil
    field = nil

    flush = lambda do
      entries[msgid] = msgstr if msgid && msgstr
      msgid = msgstr = field = nil
    end

    File.foreach(path) do |line|
      case line
      when /^msgid "(.*)"$/
        flush.call
        msgid = JSON.parse(%{"#{Regexp.last_match(1)}"})
        field = :msgid
      when /^msgstr "(.*)"$/
        msgstr = JSON.parse(%{"#{Regexp.last_match(1)}"})
        field = :msgstr
      when /^"(.*)"$/
        value = JSON.parse(%{"#{Regexp.last_match(1)}"})
        msgid = "#{msgid}#{value}" if field == :msgid
        msgstr = "#{msgstr}#{value}" if field == :msgstr
      end
    end
    flush.call
    entries
  end
end

def normalize_source(value)
  value.gsub(/\s+/, ' ').strip
end

def context_fragments(path, pattern, radius)
  lines = File.readlines(path)
  lines.each_index.filter_map do |index|
    next unless lines[index].match?(pattern)

    first = [index - radius, 0].max
    last = [index + radius, lines.length - 1].min
    normalize_source(lines[first..last].join)
  end
end

def documentation_id_pattern(id)
  escaped = Regexp.escape(id)
  /(?:data-vpsadmin-doc-id=(?:"#{escaped}"|'#{escaped}')|(?:"#{escaped}"|'#{escaped}'))/
end

options = {
  contract: File.expand_path('../contract/navigation.yml', __dir__),
  captures: File.expand_path('../captures.json', __dir__),
  capture_source: File.expand_path('..', __dir__),
  vpsadmin: ENV['VPSADMIN_KB_VPSADMIN_SOURCE']
}
OptionParser.new do |parser|
  parser.on('--contract FILE') { |value| options[:contract] = File.expand_path(value) }
  parser.on('--captures FILE') { |value| options[:captures] = File.expand_path(value) }
  parser.on('--capture-source DIR') { |value| options[:capture_source] = File.expand_path(value) }
  parser.on('--vpsadmin-source DIR') { |value| options[:vpsadmin] = File.expand_path(value) }
end.parse!

raise ContractError, 'vpsAdmin source is required' if options[:vpsadmin].to_s.empty?

contract = YAML.safe_load_file(options.fetch(:contract))
captures = JSON.parse(File.read(options.fetch(:captures)))

raise ContractError, 'contract schema must be 1' unless contract.fetch('schema') == 1
unless contract.fetch('vpsadmin_revision') == captures.fetch('vpsadmin_commit')
  raise ContractError, 'contract and capture vpsAdmin revisions differ'
end

languages = contract.fetch('languages')
raise ContractError, 'contract languages must be cs and en' unless languages == %w[cs en]

page_namespaces = contract.fetch('page_namespaces')
unless page_namespaces.keys.sort == languages.sort &&
       page_namespaces.values.all? { |values| values.is_a?(Array) && !values.empty? }
  raise ContractError, 'page namespaces must be non-empty for cs and en'
end

context_lines = contract.fetch('source_context_lines')
raise ContractError, 'source context lines must be a non-negative integer' unless context_lines.is_a?(Integer) && context_lines >= 0

id_pattern = /\A[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*\z/
controls = contract.fetch('controls')
control_ids = controls.map { |control| control.fetch('id') }
raise ContractError, 'duplicate control IDs' unless control_ids.uniq.length == control_ids.length
control_ids.each { |id| raise ContractError, "invalid control ID #{id}" unless id.match?(id_pattern) }
controls_by_id = controls.to_h { |control| [control.fetch('id'), control] }

capture_ids = captures.fetch('assets').map { |capture| capture.fetch('id') }
catalog = PoCatalog.read(
  File.join(options.fetch(:vpsadmin), 'webui/lang/locale/cs_CZ.utf8/LC_MESSAGES/vpsAdmin.po')
)
drifts = []

controls.each do |control|
  id = control.fetch('id')
  labels = control.fetch('label')
  raise ContractError, "#{id}: labels must be bilingual" unless labels.keys.sort == languages.sort
  labels.each do |language, label|
    raise ContractError, "#{id}: blank #{language} label" unless label.is_a?(String) && !label.empty?
  end

  translated = catalog[labels.fetch('en')]
  unless translated == labels.fetch('cs')
    drifts << [
      id,
      "Czech catalog has #{translated.inspect} for #{labels.fetch('en').inspect}, " \
      "expected #{labels.fetch('cs').inspect}"
    ]
  end

  source = control.fetch('source')
  fingerprint = source.fetch('fingerprint')
  unless fingerprint.match?(/\A[0-9a-f]{64}\z/)
    raise ContractError, "#{id}: source fingerprint must be a SHA-256 hex digest"
  end

  source_path = File.join(options.fetch(:vpsadmin), source.fetch('path'))
  if !File.file?(source_path)
    drifts << [id, "source file not found: #{source.fetch('path')}"]
  else
    contexts = context_fragments(source_path, documentation_id_pattern(id), context_lines)

    source.fetch('related', []).each do |related|
      related_path = File.join(options.fetch(:vpsadmin), related.fetch('path'))
      if !File.file?(related_path)
        drifts << [id, "related source file not found: #{related.fetch('path')}"]
        next
      end

      contexts.concat(
        context_fragments(
          related_path,
          Regexp.new(Regexp.escape(related.fetch('contains'))),
          context_lines
        )
      )
    end

    actual_fingerprint = Digest::SHA256.hexdigest(contexts.sort.join("\n"))
    unless actual_fingerprint == fingerprint
      drifts << [
        id,
        "coupled label/route/landmark declaration changed in #{source.fetch('path')} " \
        "(expected #{fingerprint}, got #{actual_fingerprint})"
      ]
    end
  end

  unknown_captures = control.fetch('captures', []) - capture_ids
  unless unknown_captures.empty?
    raise ContractError, "#{id}: unknown capture IDs #{unknown_captures.join(', ')}"
  end
end

paths = contract.fetch('paths')
path_ids = paths.map { |path| path.fetch('id') }
raise ContractError, 'duplicate path IDs' unless path_ids.uniq.length == path_ids.length
path_ids.each { |id| raise ContractError, "invalid path ID #{id}" unless id.match?(id_pattern) }

paths.each do |path|
  id = path.fetch('id')
  steps = path.fetch('steps')
  raise ContractError, "#{id}: navigation path has no steps" if steps.empty?
  unknown_steps = steps - control_ids
  raise ContractError, "#{id}: unknown steps #{unknown_steps.join(', ')}" unless unknown_steps.empty?

  pages = path.fetch('pages')
  raise ContractError, "#{id}: page bindings must be bilingual" unless pages.keys.sort == languages.sort
  pages.each do |language, ids|
    unless ids.is_a?(Array) && !ids.empty? && ids.all? { |page_id| page_id.is_a?(String) && !page_id.empty? }
      raise ContractError, "#{id}: #{language} pages must be a non-empty string array"
    end
    raise ContractError, "#{id}: #{language} pages must be unique" unless ids.uniq.length == ids.length

    invalid_namespaces = ids.reject do |page_id|
      page_namespaces.fetch(language).any? { |namespace| page_id.start_with?("#{namespace}:") }
    end
    unless invalid_namespaces.empty?
      raise ContractError, "#{id}: #{language} pages use invalid namespaces: #{invalid_namespaces.join(', ')}"
    end
  end
end

selectors = contract.fetch('semantic_selectors')
selector_captures = selectors.map { |selector| selector.fetch('capture') }
raise ContractError, 'duplicate semantic selector captures' unless selector_captures.uniq.length == selector_captures.length

selectors.each do |selector|
  capture = selector.fetch('capture')
  control_id = selector.fetch('control')
  raise ContractError, "unknown semantic selector control #{control_id}" unless controls_by_id.key?(control_id)
  raise ContractError, "unknown semantic selector capture #{capture}" unless capture_ids.include?(capture)
  unless controls_by_id.fetch(control_id).fetch('captures', []).include?(capture)
    raise ContractError, "#{capture}: semantic selector is not bound to #{control_id}"
  end

  source = selector.fetch('source')
  declaration = normalize_source(source.fetch('declaration'))
  unless declaration.include?(capture) && declaration.include?(control_id)
    raise ContractError, "#{capture}: selector declaration must contain its capture and control IDs"
  end

  source_path = File.join(options.fetch(:capture_source), source.fetch('path'))
  if !File.file?(source_path) || !normalize_source(File.read(source_path)).include?(declaration)
    drifts << [control_id, "semantic selector changed for #{capture} in #{source.fetch('path')}"]
  end
end

unless drifts.empty?
  warn "Documentation contract drift detected (#{drifts.length}):"
  drifts.sort.each do |control_id, message|
    control = controls_by_id.fetch(control_id)
    affected_paths = paths.select { |path| path.fetch('steps').include?(control_id) }
    pages = languages.to_h do |language|
      [language, affected_paths.flat_map { |path| path.fetch('pages').fetch(language) }.uniq.sort]
    end
    affected_captures = control.fetch('captures', []).sort

    warn "- #{control_id}: #{message}"
    warn "  pages: #{languages.map { |language| "#{language}=#{pages.fetch(language).join(', ')}" }.join('; ')}"
    warn "  captures: #{affected_captures.empty? ? '(none)' : affected_captures.join(', ')}"
  end
  exit 1
end

bound_captures = controls.flat_map { |control| control.fetch('captures', []) }.uniq
puts "Valid documentation contract: #{controls.length} controls, #{paths.length} paths, " \
     "#{bound_captures.length} capture concepts, #{selectors.length} semantic selectors"
