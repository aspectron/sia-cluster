var _ 		= require("underscore");
var request = require("request");
var ejs 	= require("ejs");

function Helper(core){
	var self = this;

	self.validateCaptcha = function validateCaptcha(req, callback) {

        var captcha = req.body['g-recaptcha-response'];
        if(!captcha || !captcha.length)
            return callback({ error : "Captcha validation failure", type : "captcha", "error-codes" : ['invalid-input-response'] }, { success : false });

        request({
            url: "https://www.google.com/recaptcha/api/siteverify",
            method: 'GET',
            qs: {
                secret: '6Le-XAcTAAAAABRUipByxvc7vIHXVlxHKq4ZikZu',
                response: captcha
            },
            json: true
        }, function(err, response, data) {

            console.log("data",data);
            var errors = data['error-codes'];
            console.log("errors",errors);

            var error = data.error || '';
            if (errors && errors.length) {
                if (_.contains(errors, 'invalid-input-response'))
                    error = _T("Please complete captcha");
                else
                    error = errors.join('/');
            }

            if(!data.success)
                return callback({ error : error }, data);
            callback(null, data);

        });
    }

    self.emitForTokens = function emitForTokens(tokens, eventName, args){
        _.each(tokens, function(token) {
            var sockets = core.webSocketTokens[token];
            _.each(sockets, function(socket_id) {
                var ws = core.webSocketMap[socket_id];
                if(ws)
                    ws.emit(eventName, args);
            })
        })
    }
    self.emitToAll = function emitToAll(eventName, args){
        _.each(_.keys(core.webSocketMap), function(key) {
            var ws = core.webSocketMap[key];
            ws && ws.emit(eventName, args);
        })
    }

    self.emitToPrivate = function emitToPrivate(eventName, args){
        _.each(core.userWebSocketMap, function(list) {
            _.each(list, function(socket_id) {
                var ws = core.webSocketMap[socket_id];
                if(ws)
                    ws.emit(eventName, args);
            })
        })
    }

    self.renderFile = function (view, options, callback) {
    	core.app.render(view, options, function(err, str){
    		callback(err, str)
    	})
    }

    self.renderFileContent = function (content, options) {
		var data 	= _.extend({}, core.app.locals, options || {});
		return ejs.compile(content, {})(data);
	}
}

module.exports = Helper;
