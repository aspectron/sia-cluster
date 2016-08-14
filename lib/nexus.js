module.exports = Nexus;

var events = require('events');
var util = require("util");
var path = require("path");
var fs = require("fs");
var request = require("request");
var irisRPC = require("iris-rpc")
var irisUTILS = require("iris-utils");
var _ = require("underscore");
var Sia = require("sia-api");
var Markets = require("./markets");
var PriceAggregator = require("./price-aggregator");
var BigInt = require("big-integer");
var Stats = require("iris-stats").Stats;

function SiaNode(core, nexus, uuid, ident) {
    var self = this;
    events.EventEmitter.apply(this);
    self.uuid = uuid;
    self.ident = ident;
    self.nexus = nexus;
    self.nexus.nodes[uuid] = self;
    self.rpc = nexus.rpc;
    if(!self.rpc)
        throw new Error("SiaNode requires nexus::rpc to be initialized before creation");
    self.priceFactor = 1.0;
    self.sia = new Sia({ rpcClient : self.rpc, rpcUUID : uuid })
    self.isOnline = false;
    self.state = { }
    self.unlockhash = null;

    self.init = function() {
        return;
    }

    self.updatePrice = function(_SC_TB_MO) {
        var SC_TB_MO = Math.round(_SC_TB_MO * self.priceFactor);
        core.verbose && console.log("price update".bold+' <-- '+self.uuid+': '+SC_TB_MO);

        var PRICE = BigInt(SC_TB_MO).multiply(1e24).divide(1e12).divide(4320);

        self.rpc.dispatch(self.uuid, {
            op : "setting",
            name : "host.internalsettings.minstorageprice",
            value : PRICE.toString()
        }, function(err) {
            if(err && err.error)
                err = err.error;
            core.verbose && console.log("price update".bold+' --> '+self.uuid+': '+(err ? err.toString().magenta.bold : " Ok".green.bold))
        })
    }

    self.on("settings", function(args){
        console.log("node-settings-updated".greenBG, args.updated)
        if (args.updated.priceFactor)
            self.priceFactor = args.updated.priceFactor;
    })

    self.on('node-state', function(state) {
        self.state = state;
        if(state.host && state.host.externalsettings)
        self.unlockhash =  state.host.externalsettings.unlockhash;
    })

    self.nexus.initDetaultSettings(uuid, {
        priceFactor: 1,
        storageAllocation: 100
    })

    self.setIdent = function(_ident){
        ident = _ident;
        self.ident = ident;
    }
    self.setSetting = function(name, value, callback){
        self.rpc.dispatch(uuid, {op: "setting", name: name, value:value}, function(err, r){
            console.log(arguments);
            if (err)
                return callback(err.error ? err.error : err.toString());

            callback(null, r);
        });
    }
    self.setOnline = function(online){self.isOnline = !!online;}
    self.getOnline = function(){return self.isOnline;}

} 
util.inherits(SiaNode, events.EventEmitter);

function Nexus(core) {
	var self = this;
    self.hosts = { }
    self.nodes = { }
    var settingFilePath = path.join(core.appFolder, "/config/settings.local.json");
    var setupSettings  = getSetupSettings();
    initDetaultSettings("version", setupSettings.version);
    initDetaultSettings("cluster", setupSettings.cluster || {});

    self.sia = new Sia({
        host : core.config.sia.host
    })
    self.stats = new Stats(core, {
        flushInterval: core.config.statsFlushInterval,
        longevity : core.config.statsLongevity
    });
    self.pricing = { }

    var initSettings = getSettings();

    self.getNodes = function(args, callback){
        core.db.nodes.find({}, function(err, cursor){
            if(err)
                return callback(err);

            cursor.toArray(callback);
        });
    }
    self.saveNode = function(args, callback){
        var data = {};
        var newData = {};

        if (!_.isUndefined(args.active)){
            data.active = args.active;
        }else{
            newData.active = true;
        }

        if (!_.isUndefined(args.ident))
            data.ident = args.ident;

        if (_.isEmpty(data))
            return callback(null, {noUpdate: true});

        core.db.nodes.update({uuid: args.uuid}, {$set:data, $setOnInsert:newData}, {upsert: true}, callback);
    }

    self.deleteNode = function(args, callback){
        core.db.nodes.remove({uuid: args.uuid}, callback);
    }


    self.markets = new Markets(core, { verbose : false });
    self.priceAggregator = new PriceAggregator(core, self, self.markets, self.sia, { 
        TARGET_USD_TB_MO : initSettings.cluster.TARGET_USD_TB_MO,
        TRACK_STORAGE_PRICE : initSettings.cluster.TRACK_STORAGE_PRICE,
        TRACK_MODE : initSettings.cluster.TRACK_MODE,
        AVG_PRICE_FACTOR : initSettings.cluster.AVG_PRICE_FACTOR,
        MIN_PRICE : initSettings.cluster.MIN_PRICE,
        MAX_PRICE : initSettings.cluster.MAX_PRICE,
        PRICE_UPDATE_FREQ : initSettings.cluster.PRICE_UPDATE_FREQ
    });

    self.priceAggregator.registerSink(function(pricing, callback) {
        self.pricing = pricing;

        var data = {
            AVG_SC_TB_MO: pricing.AVG_SC_TB_MO,
            AVG_USD_TB_MO: pricing.AVG_USD_TB_MO,
            W_AVG_SC_TB_MO: pricing.W_AVG_SC_TB_MO,
            W_AVG_USD_TB_MO: pricing.W_AVG_USD_TB_MO,
            SC_TB_MO: pricing.SC_TB_MO,
            SC_BTC: pricing.SC_BTC,
            SC_USD: pricing.SC_USD,
            BTC_USD: pricing.BTC_USD,
            AVG_VS_CLUSTER_PRICE_DIFF: pricing.AVG_VS_CLUSTER_PRICE_DIFF
        }

        _.each(data, function(v, k) {
            if(v == 'N/A')
                delete data[k];
        })

        self.stats.push("cluster", data);



        if(pricing.TRACK_STORAGE_PRICE)
            updatePrice(pricing.SC_TB_MO);
        else
            console.log("Skipping price update (DISABLED)".cyan.bold);

        function updatePrice(SC_TB_MO) {
            _.each(self.nodes, function(node) {
                node.updatePrice(SC_TB_MO);
            })
        }

        dpc(300, function() {
            self.notifyUI("price-update", pricing);
        })

        callback();
    })

    self.priceAggregator.init(function(err, pricing) {
        core.verbose && console.log("Price aggregator init done, SC/TB/MO:".green.bold,pricing.SC_TB_MO);
    })    

    self.explorerData = {};
    self.updateExplorer = function(callback) {

        request({
            url: "http://explore.sia.tech/explorer",
            json : true
        }, function(err, response, body){
            if(err) 
                return callback(err);

            if(response.statusCode !== 200)
                return callback(new Error("Bad status code - "+response.statusCode));
            // console.log("TESTING EXPLORER DATA - totalcoins: ".greenBG, body.totalcoins);
            self.notifyUI("net-state", body);
            callback(null, body);
            self.explorerData = body;

            self.stats.push("explorer", {
                difficulty: body.difficulty,
                estimatedhashrate: body.estimatedhashrate,
                activecontractcount: body.activecontractcount,
                activecontractsize: body.activecontractsize,
                totalcontractsize: body.totalcontractsize
            });
        })

    }

    function updateExplorerLoop() {
        self.updateExplorer(function(err) {
            if(err)
                console.log("Error fetching explore.sia.tech data:".red.bold, err.toString());
            dpc(1000 * 60 * 5, updateExplorerLoop);
        })
    }

    dpc(updateExplorerLoop);

    // init RPC
    core.init(function(callback) {

        self.rpc = new irisRPC.Multiplexer({
            uuid : core.uuid,
            certificates: core.certificates,
            designation: 'SIA-CLUSTER',
            pingFreq: 3 * 1000
        }, core.config.rpc,"SIA-CLUSTER");

        self.rpc.on('connect', function(address, uuid, stream) {
            var designation = stream.designation;
            console.log("NODE connect:".green.bold,address,uuid,stream.designation.bold);
            self.initNode(uuid, designation);
        })

        self.rpc.on('disconnect', function(uuid, stream) {
            console.log(((stream.__type__ || 'N/A').toUpperCase()+" disconnect").red.bold, uuid, stream.designation);
            self.nodes[uuid] && self.nodes[uuid].setOnline(false);
            self.notifyUI("node-disconnected", {uuid: uuid});
        });

        self.rpc.on('node-state', function(msg, uuid) {
            if (!self.nodes[uuid])
                return;
            if(core.demo && msg.data.host && msg.data.host.externalsettings)
		msg.data.host.externalsettings.netaddress = '-- DEMO --';
            msg.uuid = uuid;
            self.nodes[uuid].emit('node-state', msg.data);
            self.notifyUI("node-state", msg);
            self.emit("stats", {type: "node", msg: msg});
            saveSettings(uuid, {data: msg.data});


            var data = msg.data;
            // console.log("HOST STATE DATA:".greenBG, data);

            var statsFilters = _.map(core.config.variables.stats, function(e){
                return new RegExp(e);
            });
            var disableGlobalFilters = _.map(core.config.variables.disableGlobal, function(e){
                return new RegExp(e);
            });
            var disableFilters = _.map(core.config.variables.disable, function(e){
                return new RegExp(e);
            });


            var _list = flatObject(data);
            // console.log(list);
            var list = { };

            var globalFields    = {};
            var nodeFields      = {};
            _.each(_list, function(v,n) {
                if(!_.find(disableFilters, function(e) { return e.test(n); } )){
                    if(!_.find(disableGlobalFilters, function(e) { return e.test(n); } )){
                        globalFields[n] = {
                            showVar: false,
                            showGraph: false
                        }
                    }else{
                        nodeFields[n] = {};
                    }
                }
                if(_.find(statsFilters, function(e) { return e.test(n); } )) {
                    n = n.replace(/(\.|\/)+/g,'-');
                    list[n] = parseFloat(v);
                }
            })
            var settings = getSettings();
            mergeNodeFields("cluster", globalFields, settings);
            mergeNodeFields(uuid, nodeFields, settings);

            //console.log("list".redBG, list);
            self.stats.push(uuid, list);
        });

        function mergeNodeFields(nodeId, fields, settings){
            if (settings[nodeId] && settings[nodeId].fields){
                var s = settings[nodeId];
                var newFields = {};
                _.extend(newFields, settings[nodeId].fields, fields, settings[nodeId].fields);//old + new
                var validFields = _.extend({}, setupSettings.cluster.fields || {}, fields);//static + new
                _.each(newFields, function(v, key){
                    if (!validFields[key])
                        delete newFields[key];
                });
                s.fields = newFields;
                saveSettings(nodeId, s, true);
            }else{
                saveSettings(nodeId, {fields: fields});
            }
        }

        callback();
    })

    // load existing nodes (RPC must be initialized before as node constructors use it)
    core.init(function(callback) {
        self.getNodes({}, function(err, nodes){
            if(err)
                return callback(err);

            _.each(nodes, function(node){
                if (self.nodes[node.uuid])
                    return;
                self.nodes[node.uuid] = new SiaNode(core, self, node.uuid, node.ident);
            });

            callback();
        })
    })            


    self.initNode = function(uuid, ident) {
        var node = self.nodes[uuid];
        if(!node)
            node = self.nodes[uuid] = new SiaNode(core, self, uuid, ident);
        node.init();
        node.setIdent(ident);
        node.setOnline(true);

        var settings        = getSettings();
        var nodeSettings    = settings[uuid];
        var nodeData        = nodeSettings.data || {};
        delete nodeSettings.data;

        self.saveNode({uuid:uuid, ident:node.ident}, function(err){
            if(err)
                return console.log(err);

            self.notifyUI("node-connected", {
                uuid: uuid,
                ident: node.ident,
                settings: nodeSettings,
                data: nodeData,
                online: true
            });
        });
    }

    core.on("ws::get-pricing", function(args, callback) {
        callback(null, self.pricing);
    });
    core.on("ws::get-network-data", function(args, callback) {
        var data = _.extend({}, self.pricing, self.explorerData);
        callback(null, data);
    });
    

    self.notifyUI = function(eventName, args){
        args.op = eventName;
        core.helper.emitToPrivate("message", args)
    }

    core.on("ws::init-wallet-passphrase", function(args, callback){
        if(core.demo)
            return callback({error: "Disabled in demo mode."})
        if (!args.passphrase)
            return callback({error: "Invalid Passphrase"});
        if (!args.walletkey)
            return callback({error: "Invalid Wallet Key"});
        if (!args.node)
            return callback({error: "Node uuid is required"});

        var node = args.node;
        var data = {
            op: "init-wallet-passphrase",
            uuid: node,
            passphrase: args.passphrase,
            walletKey: args.walletkey
        };

        self.rpc.dispatch(node, data, function(err, result){
            console.log(data.op.greenBG, err, result);
            if (err)
                return callback(err);
            callback(null, {success: true});
        });
    });

    core.on("ws::lock-wallet", function(args, callback){
        if(core.demo)
            return callback({error: "Disabled in demo mode."})
        if (!args.node)
            return callback({error: "Node uuid is required"});

        var data = {op: "lock-wallet"};
        var uuid = args.node;
        self.rpc.dispatch(uuid, data, function(err, result){
            console.log(data.op.greenBG, err, result);
            if (err)
                return callback(err);

            saveSettings(uuid, {data:{wallet:{unlocked: false}}});
            callback(null, {success: true, unlocked: false});
        });
    });
    core.on("ws::fetch-logfile", function(args, callback){
        if (!args.node)
            return callback({error: "Node uuid is required"});
        self.rpc.dispatch(args.node, {op: "fetch-logfile", type : args.type }, function(err, result){
            if (err)
                return callback(err);

            callback(null, result);
        });
    });
    core.on("ws::unlock-wallet", function(args, callback){
        if(core.demo)
            return callback({error: "Disabled in demo mode."})
        if (!args.passphrase)
            return callback({error: "Invalid Passphrase"});
        if (!args.node)
            return callback({error: "Node uuid is required"});

        var uuid = args.node;
        var settings = getSettings();
        var nodeSettings = settings[uuid];
        var type = args.type || "direct";
        var data = {
            op: "unlock-wallet",
            op_timeout : 1000 * 60 * 5,
            uuid: uuid,
            passphrase: args.passphrase,
            type: type
        };

        self.rpc.dispatch(uuid, data, function(err, result){
            console.log(data.op.greenBG, err, result);
            if (err && _.isString(err)){
                if (err.indexOf("Status Code Returned")){
                    if (type == "direct"){
                        err = "Make sure Wallet key is correct.";
                    }else{
                        err = "Make sure Wallet key is correctly configured under Wallet/Custom Passphrase settings.";
                    }
                }
                err = {error: err};
            }
            if (err){
                if(err.error && err.error.indexOf && err.error.indexOf("bad decrypt") > -1)
                    err.error = "Invalid Custom Passphrase.";
                return callback(err);
            }
            saveSettings(uuid, {data:{wallet:{unlocked: true}}});
            callback(null, {success: true, unlocked: true});
        });
    })

    core.on("ws::save-field-settings", function(args, callback){
        if(core.demo)
            return callback({error: "Disabled in demo mode."})

        var uuid = args.node;
        var settings = args.settings;
        //console.log("settings".greenBG, uuid, settings)
        if (!uuid)
            return callback({error: "Node uuid is required."});
        if (!settings || !_.isObject(settings))
            return callback(null, {success: true});

        var isGlobal = uuid == "cluster";
        if (isGlobal) {
            saveSettings(uuid, {fields: settings});
            self.notifyNodeSettingFields(_.keys(getSettings()));
        }else{
            var s = getSettings()[uuid] || {};
            s.fields = settings;
            saveSettings(uuid, s, true);
            self.notifyNodeSettingFields(uuid);
        }
        callback(null, {success: true});
    });

    core.on("ws::get-setting-fields", function(args, callback){
        self.getNodeSettingFields(args, callback);
    });


    self.notifyNodeSettingFields = function(uuids){
        if (!_.isArray(uuids))
            uuids = [uuids];
        _.each(uuids, function(uuid){
            self.getNodeSettingFields({node: uuid}, function(err, r){
                if (!err && r)
                    self.notifyUI("setting-fields", {uuid: uuid, fields: r.fields});
            });
        });
    }

    self.getNodeSettingFields = function(args, callback){
        var uuid = args.node;
        if (!uuid)
            return callback({error: "Node uuid is required."});

        var settings = getSettings();
        var nodeFields = settings[uuid] && settings[uuid].fields;
        nodeFields = nodeFields || {};

        var globalFields = settings.cluster.fields;
        if (!globalFields)
            return callback(null, {fields: []});

        var _nodeFields = merge(_.extend({}, globalFields), nodeFields ||{});

        var regExps = _.map(core.config.variables.stats, function(e){return new RegExp(e)});
        var disableGlobalFilters = _.map(core.config.variables.disableGlobal, function(e){ return new RegExp(e); });

        var fields = [];
        var isNode = uuid != "cluster";
        var disableGlobal;
        var invalidGlobalVars = false;
        _.each(_nodeFields, function(info, key){
            info.key = key;
            info = _.extend({
                showGraph: false,
                showVar: false,
                overridable: false
            }, info)
            disableGlobal = _.find(disableGlobalFilters, function(e){ return e.test(key)});
            if (isNode){
                if (!disableGlobal){
                    info.overridable    = true;
                    info.override       = nodeFields[key] && !_.isEmpty(nodeFields[key]);
                }else if(!nodeFields[key]){
                    return;
                }
            }else if(disableGlobal){
                delete globalFields[key];
                invalidGlobalVars = true;
                return
            }

            if (_.isUndefined(info.graphCompatible)){
                info.graphCompatible = !!_.find(regExps, function(e) {
                    return e.test(key);
                });
            }
            fields.push(info);
        });

        //console.log("invalidGlobalVars".greenBG, invalidGlobalVars)
        if(invalidGlobalVars){
            var s = getSettings().cluster || {};
            s.fields = globalFields;
            saveSettings("cluster", s, true);
            self.notifyNodeSettingFields("cluster");
        }

        callback(null, {fields: fields});
    }

    self.setSetting = function(name, value, callback){
        self.rpc.dispatch({op: "setting", name: name, value:value});
        callback(null)
    }

    core.on("ws::get-cluster-data", function(args, callback){

        var settings = getSettings();

        var storage = {
            total:  100,
            used: 10
        }

        var nodes = [], nodeSettings, nodeData;
        _.each(self.nodes, function(n, uuid){
            nodeSettings = settings[uuid];
            nodeData = nodeSettings.data || {unlocked: false};
            if (_.isUndefined(nodeData.unlocked))
                nodeData.unlocked = false;
            delete nodeSettings.data;
            nodes.push({
                uuid: uuid,
                ident: n.ident,
                settings: nodeSettings,
                data: nodeData,
                online: n.getOnline()
            })
        });

        callback(null, {settings:settings.cluster, storage:storage, nodes:nodes})
    });

    core.on("ws::delete-node", function(args, callback) {
        if(core.demo)
            return callback({error: "Disabled in demo mode."})

        var uuid = args.uuid;
        if(!uuid)
            return callback({error: "Node uuid is required."});

        var node  = self.nodes[uuid];
        if (!node)
            return callback(null, {success: true});

        self.deleteNode({uuid: uuid}, function(err){
            if (err)
                return callback(err);

            delete self.nodes[uuid];
            deleteNodeSettings(uuid);

            self.stats.removeAllStats(uuid, function(err){
                if (err)
                    return callback(err);

                callback(null, {success: true});
                self.notifyUI("node-removed", {
                    uuid: uuid,
                    ident: node.ident
                });
            })
        });
    });

    core.on("ws::setting", function(args, callback){
        if(core.demo)
            return callback({error: "Disabled in demo mode."})

        console.log("setting::args".greenBG, args);
        var name      = args.name;
        var value     = args.value;
        var uuid      = "";
        if(_.contains(_.keys(self.priceAggregator.pricing), name)) {
            uuid    = "cluster";
        } else {
            name    = name.split("/");
            uuid    = name[0];
            name    = name[1];
        }

        if (!uuid)
            return callback({error: "Invalid setting name '"+name+"'."})

        var isGlobal = uuid == "cluster";
        var node;
        if (!isGlobal) {
            node = self.nodes[uuid];
            if (!node)
                return callback({error: "Invalid setting name '"+name+"'. No such Node."});
        };

        if (_.contains(_.keys(self.priceAggregator.pricing),name) && _.isNumber(self.priceAggregator.pricing[name]))
            value = Math.abs(value);

        var currentSettings = getSettings();
        var settings        = {};
        var fields          = currentSettings.cluster.fields;
        if (uuid != "cluster" && currentSettings[uuid] && currentSettings[uuid].fields)
            fields          = merge(fields, currentSettings[uuid].fields);


        if (fields[name]) {

            if (isGlobal) {
                self.setSetting(name, value, function(err){
                    if (err)
                        return callback(err);

                    callback(null, {value: value, name: name});
                });
                return;
            };

            node.setSetting(name, value, function(err){
                if (err)
                    return callback(err);

                callback(null, {value: value, name: name});
            });
            return;
        }else{
            settings[name] = value;
            saveSettings(uuid, settings);
        }

        if(isGlobal) {
            self.priceAggregator.UPDATE(name, value);
        }

        callback(null, {value: value, name: name})
    });

    core.on("ws::get-cluster-stats", function(args, callback){

        function getSCTBMOParser(name){
            return function(item){
                return {name: name, value: item.value}
            }
        }

        var names = {
            SC_TB_MO: getSCTBMOParser("SC/TB/MO"),
            AVG_SC_TB_MO: getSCTBMOParser("AVG SC/TB/MO"),
            W_AVG_SC_TB_MO: getSCTBMOParser("W AVG SC/TB/MO"),
            ts: "x"
        };

        var result = {
            SC_TB_MO:{
                data: [],
                dateFormat: "%Y-%m-%dT%H:%M:%S.%LZ"
            },
        };

        var points = args.points > 200 ? args.points : 200;

        self.stats.get("cluster", names, args.startTS, args.endTS, points, function(err, items){
            if (err)
                return callback(err);
            result.SC_TB_MO.data = items;
            
            return callback(null, result);
        });
    });

    core.on("ws::get-storage-stats", function(args, callback){

        var root = {
            name : "root", 
            children : [] 
        };

        var sum = 0;
        _.each(self.nodes, function(node) {
            var state = node.state.host;
            var total = state && state.externalsettings ? state.externalsettings.totalstorage : 0;
            var free = state && state.externalsettings? state.externalsettings.remainingstorage : 0;
            sum += total;

            root.children.push({
                name : node.ident,
                children : [{
                    name : "Used",
                    size : total - free
                }, {
                    name : "Free",
                    size : free
                }]
            })

        });

        callback(null, {data: root, total: sum});
    });
    core.on("ws::get-network-peers-stats", function(args, callback){
        callback(null, {data: self.priceAggregator.hostStorage, total: self.priceAggregator.hostStorage.total});
    });

    core.on("ws::get-variable-graph-data", function(args, callback){

        var names = {
            ts: "x"
        };
        var variable = args.variable;
        switch(variable) {
            case "system.memory":
                names = {
                    "system-memory-total": "total",
                    "system-memory-used": "used",
                    ts: "x"
                };
            break;
            case "system.loadavg":
                names = {
                    "system-loadavg-1m": "1m",
                    "system-loadavg-5m": "5m",
                    "system-loadavg-15m": "15m",
                    ts: "x"
                };
            break;
            default:
                names[variable.replace(/\./g, '-')] = variable;
        };

        var result = {
            data: [],
            dateFormat: "%Y-%m-%dT%H:%M:%S.%LZ"
        };

        var points = args.points > 200 ? args.points : 200;

        var uuid = args.node;

        self.stats.get(uuid, names, args.startTS, args.endTS, points, function(err, items){
            if (err)
                return callback(err);
            result.data = items;
            callback(null, result);
        });
    });

    function saveSettings(key, values, noMerge){
        var data  = getSettings();
        if (noMerge) {
            data[key] = values;
        }else{
            var s       = {};
            s[key]      = values;
            merge(data, s);
        }
        fs.writeFileSync(settingFilePath, JSON.stringify(data, null, "    "));
    }

    function deleteNodeSettings(uuid){
        var data        = getSettings();
        delete data[uuid];
        fs.writeFileSync(settingFilePath, JSON.stringify(data, null, "    "));
    }

    function getSettings(defaultSettings){
        return irisUTILS.readJSON(settingFilePath) || defaultSettings || {};
    }
    function getSetupSettings(defaultSettings){
        return irisUTILS.readJSON(path.join(core.appFolder, "/config/settings.json")) || defaultSettings || {};
    }

    function merge(dst, src) {
        _.each(src, function(v, k) {
            if(_.isArray(v)) { dst[k] = [ ]; merge(dst[k], v); }
            else if(_.isObject(v)) { if(!dst[k] || _.isString(dst[k]) || !_.isObject(dst[k])) dst[k] = { };  merge(dst[k], v); }
            else { if(_.isArray(src)) dst.push(v); else dst[k] = v; }
        })

        return dst;
    }

    function initDetaultSettings(key, defaults){
        var settings = getSettings(true);
        if (settings === true || !settings[key]){
            saveSettings(key, defaults);
        }
    }

    function logError(err){
        console.error(err);
    }


    function flatObject(v) {
        var data = { }

        function _R(v, path, init) {

            _.each(v, function(v,k) {
                if(init)
                    path = '';

                if(_.isObject(v) || _.isArray(v)) {
                    var p = path+k+'.';
                    _R(v,p);
                }
                else {
                    var p = path+k;
                    data[p] = v;
                }
            })

        }

        _R(v,'', true);

        return data;
    }


    self.initDetaultSettings = initDetaultSettings;
}

util.inherits(Nexus, events.EventEmitter);
