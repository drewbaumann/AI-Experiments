# frozen_string_literal: true

require 'fileutils'

module MagnetRelay
  class PathResolver
    def initialize(config = nil, categories = nil)
      config ||= MagnetRelay.settings['download'] || {}
      @base_path = config['base_path'] || '/Volumes/Media'
      @auto_create = config.fetch('auto_create_dirs', true)
      @categories = categories || MagnetRelay.categories
    end

    attr_reader :base_path

    def resolve(category, metadata = {})
      category_config = @categories[category.to_s]
      raise ArgumentError, "Unknown category: #{category}" unless category_config

      template = category_config['path']
      path = expand_template(template, metadata)

      full_path = File.join(@base_path, path)
      ensure_directory(File.dirname(full_path)) if has_placeholders?(template)
      ensure_directory(full_path) unless has_placeholders?(template)

      full_path
    end

    def preview(category, metadata = {})
      category_config = @categories[category.to_s]
      return nil unless category_config

      template = category_config['path']
      path = expand_template(template, metadata)

      File.join(@base_path, path)
    end

    def template_for(category)
      @categories.dig(category.to_s, 'path')
    end

    def list_existing(category, field = nil)
      category_config = @categories[category.to_s]
      return [] unless category_config

      template = category_config['path']
      category_base = template.split('/').first
      search_path = File.join(@base_path, category_base)

      return [] unless File.directory?(search_path)

      case field
      when 'show_name', 'artist', 'author'
        # List top-level directories
        Dir.children(search_path)
           .select { |f| File.directory?(File.join(search_path, f)) }
           .sort
      when 'season'
        # Would need show_name context - return empty for now
        []
      else
        []
      end
    rescue Errno::ENOENT
      []
    end

    private

    def expand_template(template, metadata)
      result = template.dup

      # Replace placeholders with metadata values
      metadata.each do |key, value|
        placeholder = "{#{key}}"
        result.gsub!(placeholder, value.to_s) if value && !value.to_s.empty?
      end

      # Remove any remaining empty placeholders and clean up path
      result.gsub!(/\{[^}]+\}/, '')
      result.gsub!(/\/+/, '/')
      result.gsub!(/\/$/, '')
      result.gsub!(/\(\s*\)/, '')  # Remove empty parentheses like "()"
      result.strip

      result
    end

    def has_placeholders?(template)
      template.include?('{')
    end

    def ensure_directory(path)
      return unless @auto_create
      return if File.directory?(path)

      FileUtils.mkdir_p(path)
    end
  end
end
