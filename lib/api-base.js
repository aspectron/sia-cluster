var _ = require("underscore");
var request = require("request");

function APIBase(core, apiName){
	var self = this;

	self.init = function(){}

	self.initHttp = function(app){}

	self.initRPC = function(rpc){}

	self.rpcRequest = function rpcRequest(socket, data, callback){
		self.getSocketUser(socket, function(err, user){
			if (err)
				return callback(err);

			if(!user || !user.token)
				return callback({code: "USER-TOKEN-MISSING", error: "User token missing in session"});

			data.token = user.token;
			data.op = data.op.replace("ws::", "");
			core.rpc.dispatch(data, function(err, result){
				console.log(('RPC-RESULT:'+data.op).redBG.white, err, result);

				if (err && err.logout)
					delete user.token;

				callback(err, result);
			});
		});
	}

	self.getSocketUser = function getSocketUser(socket, callback){
		core.getSocketSession(socket, function(err, session){
			if (err)
				return callback(err);

			var user = session && session.user;
			//console.log("session".greenBG, session)
			if (!user)
				return callback({error: "Please login", loginRequired: true, logout: true});

			callback(null, user, session);
		})
	}

	dpc(10, function(){
		self.init();
	});
}

module.exports = APIBase;