var _ = require("iris-underscore");

function TO_GB(n) { return n * 1024; }
function TO_TB(n) { return n * 1024 * 1024; }

function PriceAggregator(core, nexus, markets, sia, config) {
	var self = this;
	self.markets = markets;
	self.sia = sia;
	self.ts = 0;
	self.sinks = [ ]
	self.pricing = {
		TARGET_USD_TB_MO : config.TARGET_USD_TB_MO || 5,
		TRACK_STORAGE_PRICE : (config.TRACK_STORAGE_PRICE === undefined ? true : config.TRACK_STORAGE_PRICE),
		TRACK_MODE : (config.TRACK_MODE === undefined ? "PEG" : config.TRACK_MODE),
		AVG_PRICE_FACTOR : config.AVG_PRICE_FACTOR || 1.0,
		MIN_PRICE : config.MIN_PRICE || 100,
		MAX_PRICE : config.MAX_PRICE || 20000,
		PRICE_UPDATE_FREQ : config.PRICE_UPDATE_FREQ || 5
	}

    self.hostStorage = {            
        name : "root", 
        children : [],
        total: 0
    }

	self.data = { }
	_.each(self.markets.exchanges, function(exchange, ident) {
		self.data[ident] = exchange.ctx;
	})

	self.init = function(callback) {
		self.updateLoop(callback);
	}

	self.registerSink = function(fn) {
		self.sinks.push(fn);
	}

	function updateLoop(callback) {
		return self.updateLoop(callback)
	}

	self.updateLoop = function(callback) {

		var ts = Date.now();
		if(ts-self.ts < (self.pricing.PRICE_UPDATE_FREQ*60*1000)) {
			return dpc(1000, updateLoop)
		}

		self.markets.update(function() {

			//_.each(self.data, function(o, ident) {
			//	console.log(ident.toUpperCase(), o.tickers);
			//})
			//console.log(self.data.kraken.tickers);


			self.updatePricing(function(err) {
				if(err)
					console.log(err);

				callback && dpc(function() { callback(null, self.pricing); });

				if(err) {
					dpc(1000, updateLoop);				
				}
				else
					self.flushToSinks(function() {
						dpc(1000, updateLoop);
					})
			});
		})
	}

	self.flushToSinks = function(callback) {
		_.asyncMap(self.sinks, function(fn, callback) {
			fn(self.pricing, function() {
				callback();
			});
		}, function() {
			callback();
		})
	}

	self.UPDATE = function(n, v) {
		if(!_.contains(_.keys(self.pricing), n)) {
			console.log("priceAggregator Error: No such configuration parameter:".magenta.bold, (n+'').bold)
			return;
		}

		if(n == "PRICE_UPDATE_FREQ" && v < 1)
			v = 1;

		self.pricing[n] = v;

		self.updatePricing(function(err) {
			if(err)
				console.log(err);
			else
				self.flushToSinks(_.noop);
		});
	}

	self.SET_TARGET_USD_TB_MO = function(T) {
		console.log("priceAggregator::SET_TARGET_USD_TB_MO is DEPRECATED!".magenta.bold);
		self.pricing.TARGET_USD_TB_MO = T;
		self.updatePricing(function(err) {
			if(err)
				console.log(err);
			else
				self.flushToSinks(_.noop);
		});
	}

	self.USD_TB_to_SC_GB = function(T) {
		return Math.round(T / self.pricing.SC_USD / 1000);
	}

	self.USD_TB_to_SC_TB = function(T) {
		return Math.round(T / self.pricing.SC_USD);
	}

	self.updatePricing = function(callback) {

		self.ts = Date.now();

		var BTC_USD_list = [ ]

		_.each(self.data, function(o, ident) {
			//console.log(ident.toUpperCase(), o.tickers);
			if(o.tickers && o.tickers['BTC/USD'] && o.tickers['BTC/USD'].ask)
				 BTC_USD_list.push(o.tickers['BTC/USD'].ask);
		})

		var SC_CNY_list = [ ]
		_.each(self.data, function(o, ident) {
			//console.log(ident.toUpperCase(), o.tickers);
			if(o.tickers && o.tickers['SC/CNY'] && o.tickers['SC/CNY'].ask)
				 SC_CNY_list.push(o.tickers['SC/CNY'].ask);
		})


		if(!BTC_USD_list.length)
			return callback("Unable to fetch BTC rate from exchanges, aborting price aggregation...");

		self.pricing.BTC_USD = _.reduce(BTC_USD_list, function(m,n) { return m+n; }) / BTC_USD_list.length;
		// console.log("BTC_USD",self.pricing.BTC_USD," ---> ",BTC_USD_list);

		self.pricing.SC_CNY = _.reduce(SC_CNY_list, function(m,n) { return m+n; }) / SC_CNY_list.length;
		// console.log("SC_CNY",self.pricing.SC_CNY," ---> ",SC_CNY_list);

		self.pricing.SC_BTC = self.data.polo.tickers['SC/BTC'].ask;
		// console.log("SC_BTC", self.pricing.SC_BTC);
		
		var SC_USD_list = [ ]
		SC_USD_list.push(self.pricing.SC_BTC * self.pricing.BTC_USD);

		var CNY_USD = self.data.ecb.tickers["CNY/USD"];
		CNY_USD && _.each(SC_CNY_list, function(v) {
			SC_USD_list.push(v / CNY_USD);
		})

		self.pricing.SC_USD = _.reduce(SC_USD_list, function(m,n) { return m+n; }) / SC_USD_list.length;
		// console.log("SC_USD",self.pricing.SC_USD," ---> ",SC_USD_list);
		
		self.pricing.SC_TB_MO = self.USD_TB_to_SC_TB(self.pricing.TARGET_USD_TB_MO);
		// console.log("TARGET",self.pricing.TARGET_USD_TB_MO,"SC_TB_MO",self.pricing.SC_TB_MO);
		// console.log(self.pricing);

//		_.each(self.pricing, function(v,n) {
//			console.log(n.bold+': '+(v+'').bold);
//		})

		self.updateHostAverages(function(err) {

            var SC_TB_MO = self.pricing.SC_TB_MO;
            if(!err)// && !self.pricing.MARKET_USD_PEG)
            {
            	switch(self.pricing.TRACK_MODE) {
            		case "AVG": {
                		SC_TB_MO = self.pricing.AVG_SC_TB_MO * self.pricing.AVG_PRICE_FACTOR;
            		} break;
            		case "WAVG": {
                		SC_TB_MO = self.pricing.W_AVG_SC_TB_MO * self.pricing.AVG_PRICE_FACTOR;
            		} break;
            		default: {
            			// PEG
            		} break;
            	}
            }

            if(SC_TB_MO < self.pricing.MIN_PRICE)
            	SC_TB_MO = self.pricing.MIN_PRICE;
            else
            if(SC_TB_MO > self.pricing.MAX_PRICE)
            	SC_TB_MO = self.pricing.MAX_PRICE;

            self.pricing.SC_TB_MO = Math.round(SC_TB_MO);

            core.verbose && console.log("Cluster SC/TB/MO: ".yellow.bold, self.pricing.SC_TB_MO)

            if(!err)
            	self.pricing.AVG_VS_CLUSTER_PRICE_DIFF = (Math.round(self.pricing.SC_TB_MO / self.pricing.AVG_SC_TB_MO * 100)-100);
            else
            	self.pricing.AVG_VS_CLUSTER_PRICE_DIFF = 'N/A';
            core.verbose && console.log("Price Difference (AVG vs CLUSTER):".cyan.bold, (self.pricing.AVG_VS_CLUSTER_PRICE_DIFF+'%').bold);
            
            core.verbose && _.each(self.pricing, function(v,n) {
                console.log(n.bold+': '+(v+'').bold);
            })

			callback();
			
		})

	}

	self.updateHostAverages = function(callback) {

        self.hostStorage = {             
            name : "root", 
            children : [],
            total : 0
        }

        self.sia.hostdb.all(function(err, resp) {
        	if(!err && resp.hosts) {
        		self.pricing.PEERS_TOTAL = resp.hosts.length;
        	}

	        self.sia.hostdb.active(function(err, resp) {
	            if(err || !resp.hosts) {

	                self.pricing.AVG_SC_TB_MO = 'N/A';
	                self.pricing.AVG_USD_TB_MO = 'N/A';
	                self.pricing.W_AVG_SC_TB_MO = 'N/A';
	                self.pricing.W_AVG_USD_TB_MO = 'N/A';
	                self.pricing.PEERS_TOTAL = 'N/A';
	                self.pricing.PEERS_ACTIVE = 'N/A';
	                self.pricing.PEERS_HOSTING = 'N/A';

	            	if(err) {
	                	console.log("Error averaging host price:".red.bold, err.toString());
	                	return callback(new Error("Error averaging host price"));
	                }
	                else
	                if(!resp.hosts) {
		                console.log("Error averaging host price: No hosts found on the network".red.bold);   
		                return callback(new Error("Error averaging host price"));
	                }
	            }
	            else {

	                // get our local nodes
	                var local = _.map(nexus.nodes,function(node) {
	                	return node.unlockhash;
	                })

	                // filter out duplicate nodes
	                var hostList = _.uniq(resp.hosts, false, 'unlockhash');

	                // mark our own nodes, we do not want our price settings 
	                // to influence our own averages etc.
	                _.each(hostList, function(host) {
	                	host.local = _.contains(local, host.unlockhash);
	                })

	                // mark nodes that have set extreme pricing
	                markOutliers(hostList);

	                // sort by price
	                hostList = _.sortBy(hostList, 'p_');


	                var storageprice = 0;
	                var weighted = 0;
	                var totalstorage = 0;
	                var hosts = 0;

	                _.each(hostList, function(host) {
	                	// exclude non-accepting nodes, outliers and our own nodes
	                    if(!host.acceptingcontracts || host.outlier) {
	                        return;
	                    }

	                    var storageprice_ = parseFloat(host.storageprice);
	                    var totalstorage_ = parseFloat(host.totalstorage);
	                    var remainingstorage_ = parseFloat(host.remainingstorage);

	                    self.hostStorage.children.push({
	                        name : host.netaddress,
	                        local : host.local,
	                        price : storageprice_ * 1e12 * 4320,
	                        size : totalstorage_,
	                        children : [{
	                            name : "Used",
	                            size : totalstorage_ - remainingstorage_
	                        }, {
	                            name : "Free",
	                            size : remainingstorage_
	                        }]
	                    })

	                    // do not add our own hosts to totals
						if(host.local)
							return;

	                    hosts++;
	                    storageprice += storageprice_;
	                    totalstorage += totalstorage_;
	                    weighted += storageprice_ * totalstorage_;
	                })

	                self.pricing.PEERS_ACTIVE = hostList.length;
	                self.pricing.PEERS_HOSTING = hosts;

	                self.hostStorage.total = totalstorage;
	                storageprice = storageprice / hosts / 1e24 * 1e12 * (6*24*30);// / 1e24;

	                self.pricing.AVG_SC_TB_MO = Math.round(storageprice);
	                self.pricing.AVG_USD_TB_MO = storageprice * self.pricing.SC_USD;
	                core.verbose && console.log("Average Network SC/TB/MO:".yellow.bold,(self.pricing.AVG_SC_TB_MO+' SC').bold,(self.pricing.AVG_USD_TB_MO+' USD').bold);
	                
	                weighted = weighted / totalstorage  / 1e24 * 1e12 * (6*24*30);
	                self.pricing.W_AVG_SC_TB_MO = Math.round(weighted);
	                self.pricing.W_AVG_USD_TB_MO = weighted * self.pricing.SC_USD;
	                core.verbose && console.log("Weighted Average Network SC/TB/MO:".yellow.bold,(self.pricing.W_AVG_SC_TB_MO+' SC').bold,(self.pricing.W_AVG_USD_TB_MO+' USD').bold);
	            }

	            callback();
	        })
		})
	}

	function markOutliers(hosts) {

		var sum = 0;
		var sumsq = 0;
		_.each(hosts, function(host) {
			var p = parseFloat(host.storageprice);
			host.p_ = p;
			sum += p;
			sumsq += p*p;
		})
		var l = hosts.length;
		var mean = sum/l;
		var variance = sumsq/l-mean*mean;
		var sd = Math.sqrt(variance);
		var deviations = 3;
		// var outliers = [ ]
		_.each(hosts, function(host) {
			if(host.p_ < mean - deviations * sd || host.p_ > mean + deviations * sd)
				host.outlier = true;
			// outliers.push(host);
		})
	}

}

module.exports = PriceAggregator;