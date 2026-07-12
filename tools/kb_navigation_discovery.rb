# frozen_string_literal: true

require 'digest'

module KbNavigationDiscovery
  SIGNAL = /(?:
    vpsadmin.{0,240}(?:->|→|\bmenu\b|\bsection\b|\bdetails?\b|\bprofile\b|\bform\b|profil|detail|formulář|panel)|
    (?:\bmenu\b|\bdetails?\b|\bform\b|sidebar|nabídk\w*|detail\w*|formulář\w*|panel\w*).{0,240}(?:->|→|\/\/|\*\*)|
    (?:\/\/|\*\*)[^\n]{0,160}(?:->|→)[^\n]{0,160}(?:\/\/|\*\*)
  )/imx

  module_function

  def discover(language:, page:, content:)
    visible = content.gsub(%r{<(?:code|file)\b.*?</(?:code|file)>}mi, '')
    visible.split(/\n[ \t]*\n+/).filter_map do |paragraph|
      normalized = normalize(paragraph)
      next if normalized.empty? || !normalized.match?(SIGNAL)

      identity = [language, page, normalized].join("\0")
      entry = {
        'id' => Digest::SHA256.hexdigest(identity)[0, 16],
        'language' => language,
        'page' => page,
        'text' => normalized
      }
      paths = paragraph.scan(/<vpsadmin-nav\s+id="([a-z][a-z0-9.-]*)">/).flatten
      entry['paths'] = paths unless paths.empty?
      entry
    end
  end

  def normalize(paragraph)
    paragraph
      .gsub(%r{</?vpsadmin-nav(?:\s+[^>]*)?>}, '')
      .lines
      .reject { |line| line.lstrip.start_with?('{{') }
      .join(' ')
      .gsub(/\s+/, ' ')
      .strip
  end
end
