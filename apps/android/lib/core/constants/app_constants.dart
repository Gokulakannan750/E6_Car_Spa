class AppConstants {
 // Environment configurations
 static const String defaultDevApiUrl = 'http://10.0.2.2:5298/api';
 static const String defaultProdApiUrl = 'https://api.e6carspa.com/api';

 // Default values
 static const String appName = 'E6 Car Spa';
 static const String appVersion = '1.0.0';
 static const int connectTimeoutMs = 30000;
 static const int receiveTimeoutMs = 30000;

 // Storage keys
 static const String keyAccessToken = 'access_token';
 static const String keyRefreshToken = 'refresh_token';
 static const String keyUser = 'user';
 static const String keyApiBaseUrl = 'api_base_url';

 // Pagination defaults
 static const int defaultPageSize = 20;
 static const int maxPageSize = 100;
}
