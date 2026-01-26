# frozen_string_literal: true

require 'net/http'
require 'json'
require 'uri'

module MagnetRelay
  class Transmission
    class Error < StandardError; end
    class AuthError < Error; end
    class ConnectionError < Error; end
    class VPNError < Error; end

    CSRF_HEADER = 'X-Transmission-Session-Id'

    def initialize(config = nil)
      config ||= MagnetRelay.settings['transmission'] || {}
      @host = config['host'] || '127.0.0.1'
      @port = config['port'] || 9091
      @username = config['username']
      @password = config['password']
      @use_ssl = config['use_ssl'] || false
      @vpn_check = config.fetch('require_vpn', true)
      @vpn_interface = config['vpn_interface'] || 'utun'
      @session_id = nil
    end

    def add_torrent(magnet_url, download_dir: nil)
      check_vpn! if @vpn_check

      args = { 'filename' => magnet_url }
      args['download-dir'] = download_dir if download_dir

      response = rpc_call('torrent-add', args)

      if response['torrent-added']
        {
          success: true,
          hash: response['torrent-added']['hashString'],
          name: response['torrent-added']['name'],
          id: response['torrent-added']['id'],
          message: 'Torrent added successfully'
        }
      elsif response['torrent-duplicate']
        {
          success: true,
          duplicate: true,
          hash: response['torrent-duplicate']['hashString'],
          name: response['torrent-duplicate']['name'],
          id: response['torrent-duplicate']['id'],
          message: 'Torrent already exists'
        }
      else
        { success: false, message: 'Unknown response from Transmission' }
      end
    end

    def session_stats
      rpc_call('session-stats', {})
    end

    def test_connection
      session_stats
      true
    rescue Error
      false
    end

    def vpn_active?
      # Check for VPN tunnel interface (utun devices on macOS)
      interfaces = `ifconfig 2>/dev/null`.scan(/^(\w+):/).flatten
      interfaces.any? { |iface| iface.start_with?(@vpn_interface) }
    rescue StandardError
      false
    end

    def status
      {
        connected: test_connection,
        vpn_active: vpn_active?,
        vpn_required: @vpn_check
      }
    end

    private

    def check_vpn!
      return if vpn_active?

      raise VPNError, "VPN is not active. Please connect to VPN before downloading."
    end

    def rpc_call(method, arguments)
      uri = URI("#{scheme}://#{@host}:#{@port}/transmission/rpc")

      request = Net::HTTP::Post.new(uri)
      request.content_type = 'application/json'
      request.body = { method: method, arguments: arguments }.to_json
      request[CSRF_HEADER] = @session_id if @session_id
      request.basic_auth(@username, @password) if @username && !@username.empty?

      response = make_request(uri, request)

      case response
      when Net::HTTPConflict
        # CSRF token required - extract and retry
        @session_id = response[CSRF_HEADER]
        return rpc_call(method, arguments)
      when Net::HTTPUnauthorized
        raise AuthError, 'Invalid Transmission credentials'
      when Net::HTTPSuccess
        result = JSON.parse(response.body)
        raise Error, result['result'] unless result['result'] == 'success'

        result['arguments']
      else
        raise Error, "HTTP #{response.code}: #{response.message}"
      end
    rescue Errno::ECONNREFUSED, Errno::EHOSTUNREACH, Errno::ETIMEDOUT => e
      raise ConnectionError, "Cannot connect to Transmission at #{@host}:#{@port} - #{e.message}"
    end

    def make_request(uri, request)
      http = Net::HTTP.new(uri.hostname, uri.port)
      http.use_ssl = @use_ssl
      http.open_timeout = 5
      http.read_timeout = 10
      http.request(request)
    end

    def scheme
      @use_ssl ? 'https' : 'http'
    end
  end
end
