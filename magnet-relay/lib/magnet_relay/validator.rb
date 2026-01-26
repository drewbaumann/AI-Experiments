# frozen_string_literal: true

require 'uri'
require 'cgi'

module MagnetRelay
  module Validator
    MAGNET_PATTERN = /\Amagnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/i

    module_function

    def valid?(url)
      return false if url.nil? || url.empty?

      url.strip.match?(MAGNET_PATTERN)
    end

    def extract_name(magnet_url)
      return nil unless valid?(magnet_url)

      query = magnet_url.split('?', 2).last
      params = CGI.parse(query)

      name = params['dn']&.first
      return nil unless name

      URI.decode_www_form_component(name)
    end

    def extract_hash(magnet_url)
      return nil unless valid?(magnet_url)

      match = magnet_url.match(/xt=urn:btih:([a-zA-Z0-9]{32,40})/i)
      match[1].downcase if match
    end

    def normalize(magnet_url)
      return nil unless valid?(magnet_url)

      magnet_url.strip
    end
  end
end
