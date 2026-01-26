# frozen_string_literal: true

module MagnetRelay
  class Classifier
    # Patterns to detect content type from torrent name
    PATTERNS = {
      show: [
        /\bS(\d{1,2})E\d{1,2}\b/i,                    # S01E01
        /\bS(\d{1,2})\b(?!ample)/i,                   # S01 (not "Sample")
        /\b(\d{1,2})x\d{2}\b/,                        # 1x01
        /\bSeason\s*(\d{1,2})\b/i,                    # Season 1
        /\bComplete\s*Series\b/i,                     # Complete Series
      ],
      movie: [
        /\b(19|20)\d{2}\b.*\b(720p|1080p|2160p|4k|bluray|brrip|webrip|web-dl)\b/i,
        /\b(720p|1080p|2160p|4k)\b.*\b(19|20)\d{2}\b/i,
      ],
      book: [
        /\.(epub|mobi|azw3?|pdf)\b/i,
        /\bebook\b/i,
        /\bcbr\b|\bcbz\b/i,                           # Comics
      ],
      audiobook: [
        /\baudiobook\b/i,
        /\bunabridged\b/i,
        /\bnarrated\s+by\b/i,
        /\.m4b\b/i,
      ],
      music: [
        /\b(flac|320kbps|v0|lossless)\b/i,
        /\b(album|discography|ep)\b.*\b(19|20)\d{2}\b/i,
      ],
      software: [
        /\b(macos|mac\s*os|osx|dmg)\b/i,
        /\b(windows|win)\s*(10|11|x64|x86)\b/i,
        /\.(iso|dmg|pkg)\b/i,
      ],
      game: [
        /\b(repack|fitgirl|gog|codex|skidrow)\b/i,
        /\b(ps[45]|xbox|switch|nintendo)\b/i,
      ],
    }.freeze

    def initialize(categories = nil)
      @categories = categories || MagnetRelay.categories
      @default_category = find_default_category
    end

    def classify(name)
      return @default_category if name.nil? || name.empty?

      PATTERNS.each do |category, patterns|
        next unless @categories.key?(category.to_s)

        patterns.each do |pattern|
          return category.to_s if name.match?(pattern)
        end
      end

      @default_category
    end

    def extract_metadata(name, category)
      return {} if name.nil? || name.empty?

      case category.to_s
      when 'movie'
        extract_movie_metadata(name)
      when 'show'
        extract_show_metadata(name)
      when 'book', 'audiobook'
        extract_book_metadata(name)
      when 'music'
        extract_music_metadata(name)
      else
        {}
      end
    end

    def category_fields(category)
      @categories.dig(category.to_s, 'fields') || []
    end

    def category_names
      @categories.transform_values { |v| v['name'] }
    end

    def all_categories
      @categories.keys
    end

    private

    def find_default_category
      @categories.find { |_, v| v['default'] }&.first || 'other'
    end

    def extract_movie_metadata(name)
      # Try: Title (Year) or Title.Year or Title Year
      clean = name.gsub(/[._]/, ' ')

      if (match = clean.match(/^(.+?)\s*[\(\[]?((?:19|20)\d{2})[\)\]]?\s*/))
        title = match[1].strip.gsub(/\s+/, ' ')
        # Remove quality tags from title
        title = title.sub(/\s*(720p|1080p|2160p|4k|bluray|brrip|webrip|web-dl).*$/i, '').strip
        {
          'title' => title,
          'year' => match[2]
        }
      else
        {}
      end
    end

    def extract_show_metadata(name)
      clean = name.gsub(/[._]/, ' ')

      # Try: Show Name S01E01 or Show Name Season 1
      if (match = clean.match(/^(.+?)\s*S(\d{1,2})(?:E\d{1,2})?/i))
        {
          'show_name' => match[1].strip,
          'season' => match[2].to_i.to_s.rjust(2, '0')
        }
      elsif (match = clean.match(/^(.+?)\s*Season\s*(\d{1,2})/i))
        {
          'show_name' => match[1].strip,
          'season' => match[2].to_i.to_s.rjust(2, '0')
        }
      elsif (match = clean.match(/^(.+?)\s*(\d{1,2})x\d{2}/))
        {
          'show_name' => match[1].strip,
          'season' => match[2].to_i.to_s.rjust(2, '0')
        }
      else
        {}
      end
    end

    def extract_book_metadata(name)
      clean = name.gsub(/[._]/, ' ')

      # Try: Author - Title or Title by Author
      if (match = clean.match(/^(.+?)\s*-\s*(.+?)(?:\s*[\(\[]|$)/))
        {
          'author' => match[1].strip,
          'title' => match[2].strip.sub(/\.(epub|mobi|pdf|azw3?|m4b)$/i, '')
        }
      elsif (match = clean.match(/^(.+?)\s+by\s+(.+?)(?:\s*[\(\[]|$)/i))
        {
          'title' => match[1].strip,
          'author' => match[2].strip
        }
      else
        {}
      end
    end

    def extract_music_metadata(name)
      clean = name.gsub(/[._]/, ' ')

      # Try: Artist - Album (Year)
      if (match = clean.match(/^(.+?)\s*-\s*(.+?)(?:\s*[\(\[](?:19|20)\d{2}|$)/))
        {
          'artist' => match[1].strip,
          'album' => match[2].strip.sub(/\s*(flac|320|v0|mp3).*$/i, '')
        }
      else
        {}
      end
    end
  end
end
