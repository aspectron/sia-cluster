module.exports = YUNBI;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");

var REQUEST_INTERVAL = 3000;

function YUNBI(core) {
	var self = this;
	Exchange.apply(this,arguments);

	// ---

	var baseURL = "https://yunbi.com/api/v2/"

	function fetch(op, callback) {

		self.fetch(baseURL+op, callback);
	}

	self.syncTickers = function(callback) {

		var pairs = ["SC/CNY"];

		var out = { }

		_.asyncMap(pairs, function(pair, callback) {

			var ident = pair.replace('/','').toLowerCase();

			fetch('tickers/'+ident+'.json', function(err, data) {
				//console.log(arguments);
				if(err)
					return callback(err);

				var o = data.ticker;

				out[pair] = {
					ask : parseFloat(o.sell),
					bid : parseFloat(o.buy),
					volume : parseFloat(o.vol),
					high : parseFloat(o.high),
					low : parseFloat(o.low)
				}

				// dpc(self.ctx.ts ? REQUEST_INTERVAL : 100, callback);
				dpc(callback);
				
			})

		}, function() {

			self.ctx.tickers = out;
			self.ctx.ts = Date.now();
			callback();
		})


	}

}

util.inherits(YUNBI, events.EventEmitter);
