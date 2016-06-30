module.exports = BTCE;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");

var REQUEST_INTERVAL = 3000;

function BTCE(core) {
	var self = this;
	Exchange.apply(this,arguments);

	// ---

	var baseURL = "https://btc-e.com/api/2/"

	function fetch(op, callback) {

		self.fetch(baseURL+op, callback);
	}

	self.syncTickers = function(callback) {

		var pairs = ["BTC/USD"];

		var out = { }

		_.asyncMap(pairs, function(pair, callback) {

			var ident = pair.replace('/','_').toLowerCase();

			fetch(ident+'/ticker', function(err, data) {
				//console.log(arguments);
				if(err)
					return callback(err);

				var o = data.ticker;

				var volume = [parseFloat(o.vol), parseFloat(o.vol_cur)];
				
				out[pair] = {
					ask : parseFloat(o.sell),
					bid : parseFloat(o.buy),
					volume : volume,
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

util.inherits(BTCE, events.EventEmitter);
