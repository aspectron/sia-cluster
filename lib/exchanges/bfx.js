module.exports = BFX;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");

var REQUEST_INTERVAL = 3000;

function BFX(core) {
	var self = this;
	Exchange.apply(this,arguments);

	// ---

	var baseURL = "https://api.bitfinex.com/v1"

	function fetch(op, callback) {

		self.fetch(baseURL+op, callback);
	}

	self.syncTickers = function(callback) {

		var pairs = ["BTC/USD","LTC/USD","ETH/USD"];

		var out = { }

		_.asyncMap(pairs, function(pair, callback) {

			var ident = pair.replace('/','');

			fetch('/pubticker/'+ident, function(err, o) {
				if(err)
					return callback(err);

				out[pair] = {
					ask : parseFloat(o.ask),
					bid : parseFloat(o.bid),
					volume : parseFloat(o.volume),
					high : parseFloat(o.high),
					low : parseFloat(o.low)
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

util.inherits(BFX, events.EventEmitter);
