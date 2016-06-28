var ManageBase = require("./manage-base");
var CloudFlare = require("cloudflare");
var zutils = require('iris-utils');
var _ = require('iris-underscore');
var util = require('util');
var UUID = require('node-uuid');
var path = require('path');
var fs = require('fs');

function Manage(core) {
    var self = this;
    ManageBase.call(this, core);


    self.on('init-http', function(app) {
        
        if(core.config.cloudflare) {
            console.log("Creating CloudFlare Interface");
            self.cf = CloudFlare.createClient({
                email : core.config.cloudflare.email,
                token : core.config.cloudflare.token
            })
        };

        /*
        app.post('/manage/file', function (req, res, next) {
            function buildPath(fields, files){
                //var pid = fields.pid[0];
                var name = files.file[0].originalFilename.replace(/ /g, '-');
                console.log("fields".greenBG, fields, name)
                return self.getPapersPdfPath(name);
            }
            self.uploadFile({req: req, buildPath: buildPath}, function(err, result){
                if (err)
                    return self.sendResponce(res, err);

                self.sendResponce(res, null, {success:true, message: "File Upload Complete"});
                var name = result.file.split('/').pop();
                self.webSockets.emit('message', { op : 'file-inserted', data: {name:name, pdf: name, uuid: UUID.v1()} });
            });
        });
        */

    });

    self.on('get-app-data', function(args, callback) {
        callback(null, {
            uuid : core.uuid, 
            name : core.pkg.name,
            monitor : core.config.monitor
        })
    });

    self.on('trace-http', function(args, callback) {
        core.traceHttp = !core.traceHttp;
        console.log('HTTP Logging',core.traceHttp?'ON'.green.bold:'OFF'.magenta.bold);
        callback(null, 'Done');
    })

    self.on('cf-reset', function(args, callback) {
        if(!self.cf)
            return callback("No CloudFlare");

        console.log("Clearing CF Cache...");
        self.cf.clearCache('scalingbitcoin.org', function() {
            console.log("CF Cache Cleared...");
            callback(null,"CF Cache Cleared...");
        })
    })

    self.on('git-pull', function(args, callback){
        //console.log(args.op.greenBG, args, process.execPath)

        var logger = new zutils.Logger({ filename: core.appFolder + '/logs/git_pull.log' });
        var gitPullRequest = new zutils.Process({
            process: '/usr/bin/git',
            args: [ 'pull' ],
            descr: 'git-pull',
            restart: false,
            logger: logger
        });
        var write = logger.write;
        var data = '';
        logger.write = function(text){
            write.call(logger, text);
            data += text;
        }
        gitPullRequest.run();
        gitPullRequest.relaunch = false;
        gitPullRequest.process.on('exit',function (code) {
            //console.log("data:".greenBG, code, data)
            delete logger;
            if (code != 0)
                return callback({error: 'Please try again.', data: data})

            callback(null, data);
        });
    });

    self.buildItem = function(cNameOrC, item, callback){
         delete item._id;
         /*if (cNameOrC == 'papers') {
            if (item.date) {
                var date = new Date(item.date);
                item.date = date.format('Y-m-d');
            };
         };*/
         callback();
    }

    /*self.defineFetchDataHandler(self, 'users', 'users', function(d){
        d.isFiltered = !_.isEmpty(d.query);
        d.query._internal = {$exists: false};
        return d;
    });*/

    /*self.insertUser = function(data, callback){
        if (!data.uuid)
            data.uuid = UUID.v1();

        core.db.users.insert(data, function(err, records){
            if (err)
                return callback(err);

            var record = records.pop? records.pop(): records.ops.pop();

            if (!record)
                return callback({error: 'Unable to save. Please try again.'});

            callback(null, record);
            self.webSockets.emit('message', { op : 'user-inserted', data: record });
            //self.syncApp({action:'user-inserted', data: record});
        });
    }

    self.updateUser = function(uuid, data, callback){
        core.db.users.update({uuid: uuid}, {$set: data}, function(err, result){
            if (err)
                return callback(err);

            callback(null, {uuid: uuid});
            data.uuid = uuid;

            self.webSockets.emit('message', { op : 'user-updated', data: data });
            //self.syncApp({action:'attendee-updated', data: data});
        });
    }

    self.on('save-user', function(args, callback){
        var d = {}, data = args.data;

        _.each([
            'email',
            'name',
            'accountType',
            'alias',
            'img'
            ], function(n) {
            if(data[n])
                d[n] = data[n];
        });

        d.active        = !!data.active;
        d.premium       = !!data.premium;

        if (data.uuid && data.uuid.length) {
            self.updateUser(data.uuid, d, callback);
        }else{
            var _hash = self.users.createHash(Date.now()+Math.random()+'dpts2016');
            d = _.extend(d, {
                uuid: UUID.v1(),
                _hash: _hash,
                hash: self.users.createHash(args.email.toLowerCase() + _hash),
                tshash: self.users.createHash(Date.now()+Math.random() + _hash),
                confirm: true
            }); 
            self.insertUser(d, function (err, record) {
                if (err)
                    return callback(err);

                callback(null, record);
            });
        }
    });*/

}
util.inherits(Manage, ManageBase);

module.exports = Manage;
