require "json"
require "net/http"
require "rack/utils"
require "sinatra"
require "uri"

set :bind, "0.0.0.0"
set :port, Integer(ENV.fetch("PORT", "10000"))
set :show_exceptions, false

def authorized_request?
  expected = ENV["SMS_SERVICE_TOKEN"]
  supplied = request.env["HTTP_AUTHORIZATION"].to_s.delete_prefix("Bearer ")
  expected && !expected.empty? &&
    supplied.bytesize == expected.bytesize &&
    Rack::Utils.secure_compare(supplied, expected)
end

def semaphore_send(number, message)
  api_key = ENV["SMS_API_KEY"]
  api_key = ENV["SEMAPHORE_API_KEY"] if api_key.nil? || api_key.empty?
  raise "Semaphore is not configured" if api_key.nil? || api_key.empty?

  uri = URI("https://api.semaphore.co/api/v4/messages")
  form = { apikey: api_key, number: number, message: message }
  sender_name = ENV["SMS_SENDER_NAME"]
  form[:sendername] = sender_name unless sender_name.nil? || sender_name.empty?

  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  http.open_timeout = 4
  http.read_timeout = 8

  response = http.post(uri.request_uri, URI.encode_www_form(form), {
    "Content-Type" => "application/x-www-form-urlencoded"
  })
  raise "Semaphore rejected SMS delivery" unless response.is_a?(Net::HTTPSuccess)

  result = JSON.parse(response.body)
  raise "Semaphore rejected SMS delivery" unless result.is_a?(Array) &&
    result.any? &&
    result.all? { |item| %w[pending queued].include?(item["status"].to_s.downcase) }
end

get "/health" do
  content_type :json
  { status: "ok" }.to_json
end

post "/sms" do
  content_type :json
  halt 401, { error: "Unauthorized" }.to_json unless authorized_request?

  body = JSON.parse(request.body.read)
  halt 400, { error: "Invalid SMS request" }.to_json unless body.is_a?(Hash)
  number = body["to"].to_s
  message = body["message"].to_s
  halt 400, { error: "Invalid SMS request" }.to_json unless
    number.match?(/\A\+[1-9]\d{7,14}\z/) &&
    !message.empty? &&
    message.length <= 500

  semaphore_send(number, message)
  status 202
  { accepted: true }.to_json
rescue JSON::ParserError
  halt 400, { error: "Invalid JSON request" }.to_json
rescue StandardError => error
  warn "[sms-service] Delivery failed: #{error.class}"
  halt 502, { error: "SMS delivery failed" }.to_json
end
