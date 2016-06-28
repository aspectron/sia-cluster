var POLO = require("./exchanges/polo");
var YUNBI = require("./exchanges/yunbi");
var BFX = require("./exchanges/bfx");
var BTCE = require("./exchanges/btc-e");
var KRAKEN = require("./exchanges/kraken");
var ECB = require("./exchanges/ecb");
var _ = require("iris-underscore");


function Markets(core, config) {
	var self = this;
	self.exchanges = {
		polo : new POLO(core, config),
		yunbi : new YUNBI(core, config),
		btce : new BTCE(core, config),
		bfx : new BFX(core, config),
		kraken : new KRAKEN(core, config),
		ecb : new ECB(core, config)
	}

	self.update = function(callback) {

		var list = _.keys(self.exchanges);

		_.asyncMap(list, function(ident, callback) {

			self.exchanges[ident].syncTickers(function(err) {
				if(err)
					console.log(err);
				callback();
			});

		}, function() {
			callback();
		})


	}
}

module.exports = Markets;