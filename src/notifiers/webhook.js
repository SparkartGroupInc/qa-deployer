var json_request = require('../utils/json-request.js');

exports.init = function(options) {
  var notify = function(review_url, callback) {
    var body = options.body ? options.body(review_url) : {review_url: review_url};

    console.log('Notifying webhook: ' + options.url);
    json_request[options.method || 'post'](options.url, {headers: options.headers, body: body}, function(body) {
      callback();
    });
  };

  return {notify: notify, options: options};
};
