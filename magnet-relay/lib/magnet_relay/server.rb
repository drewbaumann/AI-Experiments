# frozen_string_literal: true

require 'sinatra/base'
require 'json'
require 'yaml'

module MagnetRelay
  class Server < Sinatra::Base
    configure do
      set :root, MagnetRelay.root
      set :public_folder, File.join(MagnetRelay.root, 'public')
      set :views, File.join(MagnetRelay.root, 'views')
      set :show_exceptions, false
    end

    helpers do
      def json_response(data, status_code = 200)
        content_type :json
        status status_code
        data.to_json
      end

      def authenticate!
        api_key = MagnetRelay.settings.dig('server', 'api_key')
        return if api_key.nil? || api_key.empty?

        provided = request.env['HTTP_X_API_KEY'] || params['api_key']
        halt 401, json_response({ success: false, error: 'Unauthorized' }, 401) unless provided == api_key
      end

      def classifier
        @classifier ||= Classifier.new
      end

      def path_resolver
        @path_resolver ||= PathResolver.new
      end

      def transmission
        @transmission ||= Transmission.new
      end
    end

    # CORS for API access
    before do
      headers['Access-Control-Allow-Origin'] = '*'
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
      headers['Access-Control-Allow-Headers'] = 'Content-Type, X-API-Key'
    end

    options '*' do
      200
    end

    # Health check & status
    get '/health' do
      status_info = transmission.status
      json_response({
        status: 'ok',
        version: VERSION,
        transmission: status_info[:connected],
        vpn_active: status_info[:vpn_active],
        vpn_required: status_info[:vpn_required]
      })
    end

    # List categories
    get '/api/categories' do
      cats = classifier.category_names.map do |key, name|
        {
          key: key,
          name: name,
          path_template: path_resolver.template_for(key),
          fields: classifier.category_fields(key)
        }
      end

      json_response({ categories: cats })
    end

    # Get existing items for autocomplete
    get '/api/suggest/:category/:field' do
      category = params[:category]
      field = params[:field]

      items = path_resolver.list_existing(category, field)
      json_response({ items: items })
    end

    # Preview download path
    post '/api/preview' do
      authenticate!

      body = parse_json_body
      category = body['category']
      metadata = body['metadata'] || {}

      path = path_resolver.preview(category, metadata)
      json_response({
        path: path,
        base_path: path_resolver.base_path
      })
    end

    # Analyze a magnet URL (detect category & extract metadata)
    post '/api/analyze' do
      authenticate!

      body = parse_json_body
      magnet_url = body['magnet']

      unless Validator.valid?(magnet_url)
        halt 400, json_response({ success: false, error: 'Invalid magnet URL' })
      end

      name = Validator.extract_name(magnet_url)
      category = classifier.classify(name)
      metadata = classifier.extract_metadata(name, category)
      fields = classifier.category_fields(category)
      path = path_resolver.preview(category, metadata)

      json_response({
        success: true,
        name: name,
        hash: Validator.extract_hash(magnet_url),
        detected_category: category,
        metadata: metadata,
        fields: fields,
        preview_path: path
      })
    end

    # Add magnet URL to Transmission
    post '/api/add' do
      authenticate!

      body = parse_json_body
      magnet_url = body['magnet']
      category = body['category']
      metadata = body['metadata'] || {}

      # Validate magnet
      unless Validator.valid?(magnet_url)
        halt 400, json_response({ success: false, error: 'Invalid magnet URL' })
      end

      # Use detected category if none provided
      if category.nil? || category.empty?
        name = Validator.extract_name(magnet_url)
        category = classifier.classify(name)
        metadata = classifier.extract_metadata(name, category) if metadata.empty?
      end

      # Validate category
      unless classifier.all_categories.include?(category)
        halt 400, json_response({ success: false, error: "Invalid category: #{category}" })
      end

      # Resolve download path
      download_dir = path_resolver.resolve(category, metadata)

      # Add to Transmission
      result = transmission.add_torrent(magnet_url, download_dir: download_dir)

      if result[:success]
        status_code = result[:duplicate] ? 200 : 201
        json_response({
          success: true,
          message: result[:message],
          name: result[:name],
          hash: result[:hash],
          category: category,
          download_dir: download_dir,
          duplicate: result[:duplicate] || false
        }, status_code)
      else
        halt 500, json_response({ success: false, error: result[:message] })
      end
    rescue Transmission::VPNError => e
      halt 503, json_response({ success: false, error: e.message, vpn_required: true })
    rescue Transmission::ConnectionError => e
      halt 503, json_response({ success: false, error: e.message })
    rescue Transmission::AuthError => e
      halt 500, json_response({ success: false, error: e.message })
    end

    # Web interface
    get '/' do
      content_type :html
      send_file File.join(settings.public_folder, 'index.html')
    end

    # Error handlers
    error JSON::ParserError do
      json_response({ success: false, error: 'Invalid JSON' }, 400)
    end

    error do
      json_response({ success: false, error: env['sinatra.error'].message }, 500)
    end

    private

    def parse_json_body
      request.body.rewind
      raw = request.body.read
      return {} if raw.empty?

      JSON.parse(raw)
    end
  end
end
