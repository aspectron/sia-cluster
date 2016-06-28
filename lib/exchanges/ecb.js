module.exports = ECB;

var util = require("util");
var events = require('events');
var request = require("request");
var Exchange = require("./exchange");
var _ = require("underscore");
var xml2json = require("xml2json");

function ECB(core) {
	var self = this;
	Exchange.apply(this,arguments);
	self.last_ts = 0;

	// ---

	var baseURL = "http://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"

	self.syncTickers = function(callback) {

		// skip updates if less than 15 minutes
		var ts = Date.now();
		if(ts - self.last_ts < 1000 * 60 * 15)
			return callback();

        self.verbose && console.log("-->",baseURL);

		request({
            url: baseURL,
            timeout : 15 * 1000
        }, function(err, response, body){
            if(err) 
                return callback(err);

            if(response.statusCode !== 200)
                return callback("Response status code:"+response.statusCode);

            var out = { }
            var currencies = ['USD'];

		    try {
                var json = xml2json.toJson(body, { object : true })
                var data = json['gesmes:Envelope'].Cube.Cube.Cube;
                _.each(data, function(o) {
                    out[o.currency+'/EUR'] = parseFloat(o.rate);
                    currencies.push(o.currency);
                })
                _.each(data, function(o) {
                	if(o.currency == 'USD')
                		return;
                    out[o.currency+'/USD'] = out[o.currency+'/EUR'] / out['USD/EUR'];
                })

                // console.log(out);
                // console.log(data);
                // console.log(self.rates_EUR);
                // console.log(self.rates_USD);
            }
            catch (ex) { console.log("Error fetching exchange rates:",ex); }


            self.last_ts = Date.now();

			self.ctx.tickers = out;
			self.ctx.currencies = currencies;
			self.ctx.ts = Date.now();

			callback(null);
		})

	}

}

util.inherits(ECB, events.EventEmitter);
