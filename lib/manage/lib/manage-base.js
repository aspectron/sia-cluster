var _ = require("underscore");
var crypto = require("crypto");
var util = require('util');
var path = require('path');
var events = require('events');
//var ObjectID = require('mongodb').ObjectID;
var fs = require('fs');
var multiparty = require('multiparty');
//var zutils = require('iris-utils');
//var exec = require('child_process').exec;

function ManageBase(core) {
    var self = this;
    events.EventEmitter.call(this);
    self.webSocketMap = { }

    self.appPath = path.join(__dirname+'/../');

    self.config = {
        defaultLimit: 10
    }
    self.initHttp = function(app) {
        self.clientIPs = { }
        function reapIPs() {
            var ts = Date.now();
            var purge = [ ]
            _.each(self.clientIPs, function(info, ip) {
                if(info.ts + 10 * 60 * 1000 < ts)
                    purge.push(ip);
            })
            _.each(purge, function(ip) {
                delete self.clientIPs[ip];
            })

            dpc(60 * 1000, reapIPs);
        }
        reapIPs();

        app.get('/manage.html', function(req, res, next) {
            res.render(self.appPath+'manage.html', { req: req});
        });

        app.post('/manage/login', function(req, res, next) {

            var ip = core.getClientIp(req);
            var ts = Date.now();
            var user = req.body.user;
            var sig = req.body.sig;
            var challenge = req.session.challenge;
            if(!user || !sig || !user.length || !sig.length || !challenge)
                return res.status(401).end();

            var info = self.clientIPs[ip];
            if(!info) {
                info = self.clientIPs[ip] = {
                    ts : ts,
                    hits : 0
                }
            }
            else {
                info.hits++;
            }

            var next = info.ts + info.hits * 1000;
            if(next > ts) {
                return res.status(200).json({ ack : "Too Many Attempts - Please wait "+((next-ts)/1000).toFixed()+" seconds before trying again.."});
            }
            else {
                info.ts = ts;
                user  = core.config.users[user];
                if(!user || !user.pass)
                    return res.status(401).end();

                var lsig = crypto.createHmac('sha256', new Buffer(challenge, 'hex')).update(new Buffer(user.pass, 'hex')).digest('hex');
                if(sig != lsig)
                    return res.status(401).end();

                req.session.userManage = user;
                return res.status(200).json({ ack : challenge });
            }
        })

        app.get('/manage/login', function(req, res, next) {
            req.session.challenge = crypto.createHash('sha256').update(core.config.http.session.secret+Date.now()).digest('hex');
            res.render(self.appPath+'login.ejs', { req: req, challenge : req.session.challenge});
        })

        app.get('/manage/logout', function(req, res, next) {
            req.session.userManage = null;
            res.redirect("/manage/login");
        });

        app.use('/manage/resources', core.express.static(self.appPath+'resources'));
        app.use('/manage*',function(req, res, next) {
            if(!req.session.userManage)
                return res.redirect("/manage/login");
            next();
        });

        app.get('/manage', function(req, res, next) {
            res.render(self.appPath+'manage.ejs', {
                manage: 'sites',
                req : req
            });
        });

        self.emit('init-http', app);
    }
    self.sendResponce = function(res, err, result){
        if (err)
            return res.status(500).json( (err.error? err: {error: (err.message? err.message: 'Unknow error, Please try agian.') } ));
        res.status(200).json(result);
    }
    self.uploadFile = function(args, callback){
        var form = new multiparty.Form();
        var req = args.req;
        var buildPath = args.buildPath;

        form.parse(req, function (err, fields, files) {
            if (err)
                return callback(err);

            var file = buildPath(fields, files);

            function tryCopyMethod(){
                fs.readFile(files.file[0].path, function (err, data) {
                    if (err)
                        return callback(err);

                    fs.writeFile(file, data, function (err, status) {
                        if (err)
                            return callback(err);

                        callback(null, {fields:fields, file:file});
                    });
                });
            }

            fs.rename(files.file[0].path, file, function (err) {
                if (err)
                    return tryCopyMethod();

                callback(null, {fields:fields, file:file});
            });
        });
    }
    self.readDir = function(_path, acceptFile, callback){
        fs.readdir(_path, function (err, list) {
            if (err) {
                console.error("Error scanning folder: ", path);
                return callback(err);
            }

            var files = [];
            for (var i = 0; i < list.length; i++) {
                //console.log("file".greenBG, list[i], arguments)
                if (acceptFile(_path, list[i])) {
                    files.push(path.join(_path,list[i]));
                }
            }

            callback(null, files);
        });
    }
    self.buildSearch = function (name, text, query){
        var condition = { }
        condition[name] = {
            $regex : text,
            $options : 'ig'
        }
        query.$or.push(condition);

        condition = { }
        condition[name] = text;
        query.$or.push(condition);
    }

    self.buildItem = function(collectionNameOrCollection, item, callback){
         delete item._id;
         callback();
    }

    self.defineFetchDataHandler = function(rpc, msg, collection, queryBuilder) {
        rpc.on(msg, function(args, callback) {

            var query = { $or : []}
            //console.log('defineFetchDataHandler'.greenBG, args)
            if (!args.search)
                args.search = args.filter && args.filter.search;
            if(args.search) {
                var parts = args.search.split(':');
                if(parts.length == 2) {
                    var condition = { }
                    condition[parts[0]] = {
                        $regex : parts[1],
                        $options : 'ig'
                    }
                    query.$or.push(condition);
                    
                    var condition = { }
                    condition[parts[0]] = parts[1];
                    query.$or.push(condition);

                    var condition = { }
                    condition[parts[0]] = parseFloat(parts[1]);
                    query.$or.push(condition);
                }
            }

            if(!query.$or.length)
                query = { }

            if (args.filter && args.filter.disabled)
                query.active = false;

            var limit = parseInt(args.limit) || 0;
            if(limit < 0)
                limit = 0;
            if(limit > 100)
                limit = 256;
            var skip = parseInt(args.start) || 0;
            if(skip < 0)
                skip = 0;

            var sort = { }
            if(args.sort) {
                _.each(args.sort, function(direction, property) {
                    sort[property] = direction == 'DESC' ? -1 : 1;
                });
            }
            var isFiltered = !_.isEmpty(query);
            if (queryBuilder) {
                var r = queryBuilder({args:args, query:query, limit:limit, skip:skip, sort:sort});
                query = r.query;
                isFiltered = (r.isFiltered === undefined)? !_.isEmpty(query): r.isFiltered;
                limit = r.limit;
                skip = r.skip;
                sort = r.sort;
            }

            console.log("query:".yellow.bold,query,"limit:",limit,"skip:",skip);

            var collectionName = '';
            if (_.isString(collection)) {
                collectionName = collection;
                collection = core.db[collection];
            }

            collection.find(query, function(err, cursor) {
                if(err)
                    return callback(err);

                cursor.count(function(err, count) {
                    if(err)
                        return callback(err);


                    cursor.sort(sort).limit(limit).skip(skip).toArray(function(err, list) {
                        // console.log("find done",arguments);
                        if(err)
                            return callback(err);
                        core.asyncMap(list, function(item, callback){
                            self.buildItem(collectionName || collection, item, callback)
                        }, function(err){
                            if(err)
                                return callback(err);

                            callback(null, { records : list, count : count, isFiltered: isFiltered });
                        })
                        /*
                        for(var i = 0; i < list.length; i++) {
                            list[i].id = list[i]._id;
                            delete list[i]._id;
                        }
                        */
                    })
                })
            })
        })
    }

    core.on('init::websockets', function() {
        self.webSockets = core.io.of('/manage-rpc').on('connection', function(socket) {
            // console.log("websocket "+socket.id+" connected");
            core.getSocketSession(socket, function(err, session) {
                // console.log(arguments);
                self.webSocketMap[socket.id] = socket;            

                socket.emit('message', { op : 'init', uuid : core.uuid, name : core.pkg.name });

                socket.on('disconnect', function() {            
                    delete self.webSocketMap[socket.id];
                    // console.log("websocket "+socket.id+" disconnected");
                });

                socket.on('rpc::request', function(msg) {
                    try {
                        if(!msg.req || msg.req.op == 'init-http') {
                            socket.emit('rpc::response', {
                                err : { error : "Malformed request" }
                            });
                        }else{
                            var listeners = self.listeners(msg.req.op);
                            if(listeners.length == 1) {
                                listeners[0].call(socket, msg.req, function(err, resp) {
                                    socket.emit('rpc::response', {
                                        _resp : msg._req,
                                        err : err,
                                        resp : resp,
                                    });
                                })
                            }else if(listeners.length){
                                socket.emit('rpc::response', {
                                    _resp : msg._req,
                                    err : { error : "Too many handlers for '"+msg.req.op+"'" }
                                });
                            }else{
                                socket.emit('rpc::response', {
                                    _resp : msg._req,
                                    err : { error : "No such handler '"+msg.req.op+"'" }
                                });
                            }
                        }
                    }
                    catch(ex) { console.error(ex.stack); }
                });

                socket.on('message', function(msg, callback) {
                    if(msg.op == 'init-http')
                        return;
                    try {                   
                        self.emit(msg.op, msg, socket);
                        // self.dispatchToAll(msg, socket.id);
                    }
                    catch(ex) { console.error(ex.stack); }
                });
            })
        });

        // this causes too many http requests when socket.io is in polling mode
        // disabling for now...
        //setInterval(function() {
        //    self.webSockets.emit('message', { op : 'ping', message : (new Date()).toString() })
        //}, 1000);
    });

    self.syncApp = function(args, callback){
        core.emit('sync-core', args, function(err, result){
            callback && callback(err, result);
            console.log("manage:sync-core", err, result)
        });
    }
}

util.inherits(ManageBase, events.EventEmitter);

module.exports = ManageBase;
