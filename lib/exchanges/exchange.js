module.exports = Exchange;

var util = require("util");
var events = require('events');
var request = require("request");
var _ = require("underscore");

function Exchange(core, config) {
	var self = this;
	events.EventEmitter.apply(this);
	self.verbose = config.verbose || false;
	self.ident = 'N/A';
	self.ctx = { ts : 0, tickers : { } }

	self.fetch = function(url, callback) {
		core.verbose > 1 && console.log("-->",url);
		request({
			url : url,
			timeout : 15 * 1000
		}	, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				var data;
				try {
					data = JSON.parse(body);
				}
				catch(err) {
					return callback(err);
				}

				return callback(null, data);
			}
			else 
			if(!error && response.statusCode != 200) {
				console.log('-->', url);
				console.log("Invalid response code: "+response.statusCode);
				return callback(new Error("Invalid response code: "+response.statusCode));
			}
			else
			{
				console.log('-->', url);
				console.log(error.toString().red.bold);
				return callback(error)
			}
		});
	}



}

util.inherits(Exchange, events.EventEmitter);
