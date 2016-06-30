module.exports = KRAKEN;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");

var REQUEST_INTERVAL = 3000;

function KRAKEN(core) {
	var self = this;
	Exchange.apply(this,arguments);

	// ---

	var baseURL = "https://api.kraken.com/0/public/Ticker?pair="

	function fetch(op, callback) {

		self.fetch(baseURL+op, callback);
	}

	self.syncTickers = function(callback) {

		var pairs = ["BTC/USD"];

		var out = { }

		_.asyncMap(pairs, function(pair, callback) {

			var ident = pair.replace('BTC','XBT').replace('/','');

			fetch(ident, function(err, data) {
				//console.log(arguments);
				if(err)
					return callback(err);

				var resp = _.values(data.result);
				if(!resp)
					return callback(err);

				var o = resp.shift();

				out[pair] = {
					ask : parseFloat(o.a[0]),
					bid : parseFloat(o.b[0]),
					volume : [ parseFloat(o.v[1]) ],
					high : parseFloat(o.h[1]),
					low : parseFloat(o.l[1])
				}

				dpc(self.ctx.ts ? REQUEST_INTERVAL : 100, callback);
				
			})

		}, function() {

			self.ctx.tickers = out;
			self.ctx.ts = Date.now();
			callback();
		})


	}

}

util.inherits(KRAKEN, events.EventEmitter);
