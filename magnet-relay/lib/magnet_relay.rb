# frozen_string_literal: true

require_relative 'magnet_relay/version'
require_relative 'magnet_relay/validator'
require_relative 'magnet_relay/classifier'
require_relative 'magnet_relay/path_resolver'
require_relative 'magnet_relay/transmission'
require_relative 'magnet_relay/server'

module MagnetRelay
  class Error < StandardError; end

  class << self
    def root
      File.expand_path('..', __dir__)
    end

    def config_path
      File.join(root, 'config')
    end

    def settings
      @settings ||= load_settings
    end

    def categories
      @categories ||= load_categories
    end

    def reset!
      @settings = nil
      @categories = nil
    end

    private

    def load_settings
      path = File.join(config_path, 'settings.yml')
      example_path = File.join(config_path, 'settings.yml.example')

      if File.exist?(path)
        YAML.load_file(path)
      elsif File.exist?(example_path)
        YAML.load_file(example_path)
      else
        raise Error, "No configuration found. Copy settings.yml.example to settings.yml"
      end
    end

    def load_categories
      path = File.join(config_path, 'categories.yml')
      raise Error, "Categories config not found: #{path}" unless File.exist?(path)

      YAML.load_file(path)['categories']
    end
  end
end
