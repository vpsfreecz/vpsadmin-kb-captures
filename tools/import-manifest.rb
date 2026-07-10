#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'yaml'

SOURCE = ARGV.fetch(0)
RESULTS = ARGV[1]
TARGET = File.expand_path('../captures.json', __dir__)

SCENARIOS = {
  'getting-started' => 'getting-started',
  'ssh-keys' => 'getting-started',
  'datasets' => 'storage',
  'exports' => 'storage',
  'restore-backups' => 'storage',
  'backups' => 'storage',
  'traffic' => 'networking',
  'networking' => 'networking',
  'reverse-dns' => 'networking',
  'playground' => 'playground',
  'environments' => 'environments',
  'vps-details' => 'vps-management',
  'vps-management' => 'vps-management',
  'userns' => 'vps-management',
  'account' => 'account',
  'console' => 'console',
  'start-menu' => 'console',
  'rescue-mode' => 'console'
}.freeze

FIXTURES = {
  'account' => %w[account],
  'environments' => %w[base-vps],
  'getting-started' => %w[base-vps public-key],
  'networking' => %w[base-vps traffic-samples],
  'playground' => %w[base-vps second-vps],
  'storage' => %w[base-vps snapshot],
  'vps-management' => %w[base-vps],
  'console' => %w[base-vps nixos-generations]
}.freeze

def driver(topic, view)
  return 'cli' if topic == 'traffic' && view == '04-live-monitor-cli'
  return 'console' if %w[console start-menu rescue-mode].include?(topic) &&
                      view != '01-open-web-console' &&
                      !(topic == 'start-menu' && view == '01-vps-action') &&
                      !(topic == 'rescue-mode' && view == '01-boot-form')

  'webui'
end

source = YAML.safe_load_file(SOURCE)
results = if RESULTS && File.exist?(RESULTS)
            parsed = JSON.parse(File.read(RESULTS))
            items = parsed.is_a?(Hash) ? parsed.fetch('assets', []) : parsed
            items.to_h do |item|
              media_id = item['legacy_media'] || item.dig('legacy', 'media_id')
              [media_id, item]
            end
          else
            {}
          end

assets = source.fetch('assets').map do |asset|
  topic = asset.fetch('topic')
  view = asset.fetch('view')
  slug = view.sub(/\A\d+-/, '')
  scenario = SCENARIOS.fetch(topic)
  prototype = results[asset.fetch('legacy_media')]

  {
    'id' => "#{topic}/#{slug}",
    'legacy' => {
      'media_id' => asset.fetch('legacy_media'),
      'revision' => asset.fetch('legacy_revision'),
      'md5' => asset.fetch('legacy_hash'),
      'sha256' => asset.fetch('legacy_sha256')
    },
    'wiki' => {
      'source_pages' => asset.fetch('source_pages'),
      'draft_media_id' => [
        source.fetch('draft_namespace'), 'media', 'vpsadmin', topic,
        asset.fetch('language'), "#{slug}.png"
      ].join(':'),
      'permanent_media_id' => [
        'screenshots', 'vpsadmin', topic, asset.fetch('language'), "#{slug}.png"
      ].join(':')
    },
    'language' => asset.fetch('language'),
    'topic' => topic,
    'scenario' => scenario,
    'checkpoint' => "#{topic}/#{slug}",
    'driver' => driver(topic, view),
    'fixtures' => FIXTURES.fetch(scenario),
    'description' => prototype && (prototype['description'] || prototype['capture']),
    'vpsadmin_commit' => asset.fetch('vpsadmin_commit'),
    'viewport' => asset.fetch('viewport'),
    'output' => "screenshots/#{topic}/#{asset.fetch('language')}/#{slug}.png",
    'capture' => nil,
    'dimensions' => nil,
    'sha256' => nil,
    'review_status' => 'pending'
  }
end

manifest = {
  'schema' => 2,
  'project' => 'vpsAdmin KB screenshot inventory',
  'wiki' => source.fetch('wiki'),
  'draft_namespace' => source.fetch('draft_namespace'),
  'assets' => assets
}

File.write(TARGET, "#{JSON.pretty_generate(manifest)}\n")
warn "Wrote #{assets.length} assets to #{TARGET}"
