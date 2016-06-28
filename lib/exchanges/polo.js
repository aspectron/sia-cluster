module.exports = POLO;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");

function POLO(core) {
	var self = this;
	Exchange.apply(this,arguments);

	// ---

	var baseURL = "https://poloniex.com/public?command="

	function fetch(op, callback) {

		self.fetch(baseURL+op, callback);
	}

	self.syncTickers = function(callback) {
		fetch('returnTicker', function(err, data) {
			if(err)
				return callback(err);

			var out = { }
			_.each(data, function(o, pair) {
				// console.log(arguments);

				
				var impl = pair;
				pair = pair.split('_');
				var denom = pair[0];
				var nom = pair[1];
				pair[0] = nom;
				pair[1] = denom;
				pair = pair.join('/');
				//var chg24h = { }
				//chg24h[denom.toLowerCase()] = parseFloat(o.percentChange)*100;

				out[pair] = {
					//impl : impl,
					//ident : pair,
					//chg24h : chg24h,
					ask : parseFloat(o.lowestAsk),
					bid : parseFloat(o.highestBid),
					volume : [ parseFloat(o.baseVolume), parseFloat(o.quoteVolume) ],
					high : parseFloat(o.high24hr),
					low : parseFloat(o.low24hr)
				}


			})

			self.ctx.tickers = out;
			self.ctx.ts = Date.now();
			callback(null);
		})

	}

}

util.inherits(POLO, events.EventEmitter);
