#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'fileutils'
require 'minitest/autorun'
require 'open3'
require 'tmpdir'
require 'yaml'
require_relative 'kb_navigation_discovery'

class KbAnnotationsCheckerTest < Minitest::Test
  CHECKER = File.expand_path('check-kb-annotations.rb', __dir__)

  def test_valid_candidate
    _out, error, status = run_checker

    assert(status.success?, error)
  end

  def test_missing_candidate_annotation_is_rejected
    _out, error, status = run_checker(body: 'Navigation without a tag')

    refute(status.success?)
    assert_match(/candidate annotation counts differ/, error)
  end

  def test_unknown_candidate_path_is_rejected
    body = '<vpsadmin-nav id="missing.path">Navigation</vpsadmin-nav>'
    _out, error, status = run_checker(body:)

    refute(status.success?)
    assert_match(/unknown annotation path missing\.path/, error)
  end

  def test_every_affected_page_requires_binding_or_exception
    _out, error, status = run_checker(bindings: [], body: 'No annotation')

    refute(status.success?)
    assert_match(/annotation inventory mismatch/, error)
  end

  def test_independently_discovered_navigation_requires_classification
    body = '<vpsadmin-nav id="member.public-keys.open">vpsAdmin -> Edit profile</vpsadmin-nav>'
    _out, error, status = run_checker(body:, inventory_discoveries: [])

    refute(status.success?)
    assert_match(/independent navigation inventory mismatch/, error)
  end

  private

  def run_checker(
    bindings: [binding],
    body: '<vpsadmin-nav id="member.public-keys.open">Navigation</vpsadmin-nav>',
    inventory_discoveries: nil
  )
    Dir.mktmpdir do |dir|
      navigation = {
        'languages' => %w[cs en],
        'paths' => [
          {
            'id' => 'member.public-keys.open',
            'pages' => { 'cs' => ['navody:test'], 'en' => [] }
          }
        ]
      }
      annotations = { 'schema' => 1, 'bindings' => bindings, 'exceptions' => [] }
      candidate = {
        'pages' => [
          { 'language' => 'cs', 'id' => 'navody:test', 'file' => 'cs/navody/test.txt' }
        ]
      }
      navigation_path = File.join(dir, 'navigation.yml')
      annotations_path = File.join(dir, 'annotations.yml')
      candidate_path = File.join(dir, 'index.json')
      inventory_path = File.join(dir, 'inventory.yml')
      page_path = File.join(dir, 'cs/navody/test.txt')
      FileUtils.mkdir_p(File.dirname(page_path))
      File.write(navigation_path, YAML.dump(navigation))
      File.write(annotations_path, YAML.dump(annotations))
      File.write(candidate_path, JSON.dump(candidate))
      File.write(page_path, body)
      discoveries = inventory_discoveries || KbNavigationDiscovery.discover(
        language: 'cs',
        page: 'navody:test',
        content: body
      )
      File.write(
        inventory_path,
        YAML.dump('schema' => 1, 'page_counts' => { 'cs' => 1 }, 'discoveries' => discoveries)
      )

      Open3.capture3(
        RbConfig.ruby,
        CHECKER,
        '--navigation', navigation_path,
        '--annotations', annotations_path,
        '--inventory', inventory_path,
        '--candidate-index', candidate_path
      )
    end
  end

  def binding
    {
      'language' => 'cs',
      'page' => 'navody:test',
      'path' => 'member.public-keys.open',
      'count' => 1
    }
  end
end
