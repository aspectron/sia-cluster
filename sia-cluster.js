var IRISApp     = require('iris-app');
var IRISPolymer = require('iris-polymer');
var IRISMDL     = require('iris-mdl');
var _           = require('iris-underscore');

var i18n        = require('iris-i18n');
var fs          = require('fs');
var util        = require('util');
var path        = require("path");
var morgan      = require("morgan");
var basicAuth   = require('basic-auth');
var compression = require('compression');
var crypto      = require('crypto');
var program     = require('commander');

var Manage      = require('./lib/manage');
var API         = require('./lib/api');
var Helper      = require('./lib/helper');

var Nexus       = require('./lib/nexus');

function SIACluster() {
    var self = this;
    IRISApp.Application.apply(this, arguments);
    
    if(!_.keys(self.config.rpc).length) {
        console.log("Error: You must configure RPC settings in".red.bold,"sia-cluster.local.conf".bold);
        console.log("You may need to copy","sia-cluster.local.conf-example".bold,"to","sia-cluster.local.conf".bold);
        process.exit();
    }

    program
    .usage("[options]")
    .option('-v, --verbose','Set info verbose mode')
    .option('-d, --debug','Set debug verbose mode')
    .option('--demo','Enable demo mode')
    .parse(process.argv);
    self.verbose = program.debug ? 2 : (program.verbose ? 1 : 0);
    self.verbose && console.log("Setting verbose mode to".yellow.bold,self.verbose);
    self.demo = program.demo ? true : false;
    if(self.demo)
        console.log("DEMO mode...".green.bold);
    self.VERSION = fs.readFileSync(path.join(self.appFolder,"VERSION"), { encoding : 'utf-8' });
    

    self.nexus = new Nexus(self);

    self.i18n = new i18n(self);
    self.manage = new Manage(self);
    self.api = new API(self);
    self.helper = new Helper(self);
    self.httpCombiner = new IRISApp.HttpCombiner(self, {
        //prefix: 'combine:',
        //debug: true,
        inlineCss: true,
        inlineScript: true,
        folders: [
            self.appFolder+'/http/',
            self.appFolder+'/http/app/',
            self.appFolder+'/http/app/css/',
            self.appFolder+'/http/app/scripts/',
            self.appFolder+'/http/site/css/',
            self.appFolder+'/http/site/scripts/',
            self.appFolder+'/lib/manage/resources/'
        ]
    });
    //self.mailer = new Mailer(self);
    self.irisPolymer = new IRISPolymer(self, {
        httpCombiner: self.httpCombiner
    });
    self.irisMDL = new IRISMDL(self, {
        httpCombiner: self.httpCombiner
    });

    self.webSocketTokens = {};

    self.databaseConfig = [{
        config: 'main',
        collections: [
            {collection: "nodes", indexes: "_id"}
        ]
    }];


    self.updateTweets = function(tweets) {
        self.app.locals.tweets = tweets;
    }


    self.on('init::express', function() {

        self.app.disable('x-powered-by');
        self.app.use(function(req, res, next) {
            res.setHeader("X-Powered-By", "SIACluster");
            next();         
        })

        if(!self.demo && self.config.http.basicAuth) {
            self.app.use(function(req, res, next) {
                var auth = basicAuth(req);
                if(!auth || auth.name != self.config.http.basicAuth.user || auth.pass != self.config.http.basicAuth.pass) {
                    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Please login"' });
                    return res.end();
                }
                next();
            });
        }

        self.i18n.initHttp(self.app);
        self.manage.initHttp(self.app);
        self.httpCombiner.initHttp(self.app);
        self.irisPolymer.initHttp(self.app);
        self.irisMDL.initHttp(self.app);
        self.api.initHttp(self.app);

        self.app.locals._ = _;
        self.app.locals.activePage = "home";
        self.app.locals.baseUrl = self.config.baseUrl;
        self.app.locals.isDemo = self.demo;
        self.app.locals.VERSION = self.VERSION;

        self.app.locals.tweets = null;

        self.traceHttp = false;
        var logger = morgan('dev');

        self.app.use(function(req, res, next) {
            if(self.traceHttp)
                return logger(req, res, next);
            next();
        })

        self.app.set('views',  self.app.get('views').concat([
            path.join(self.appFolder,'/views/app'),
            path.join(self.appFolder,'/views/site')
        ]));
        
        self.app.use(compression({filter: shouldCompress}))
 
        function shouldCompress(req, res) {
          if (req.headers['x-no-compression']) {
            // don't compress responses with this request header 
            return false
          }
         
          // fallback to standard filter function 
          return compression.filter(req, res)
        }
        
        self.app.use(self.express.static(path.join(self.appFolder, 'http')));

        self.app.use('*', function(req, res, next) {
            res.status(404).render('error', {
                message: req._T("Error 404: Not Found")
            });
        });

        self.app.use(function(err, req, res, next) {
            console.error((err instanceof Error) ? err.stack : err);
            res.status(500).render('error', {
                message: req._T ? req._T("Site under maintenance, please check back later.") : "Site under maintenance, please check back later."
            });
        });
    });

    self.initUserWebSocketMaping = function(){
        self.userWebSocketMap = {};
        self.on("websocket::connect", function(socket){
            getUserId(socket, function(err, uuid){
                if (!self.userWebSocketMap[uuid])
                    self.userWebSocketMap[uuid] = [];

                self.userWebSocketMap[uuid].push(socket.id);

                // dpc(function() { self.nexus.emit('ws::connect', socket); });
            })
        });
        self.on("websocket::disconnect", function(socket){
            getUserId(socket, function(err, uuid){
                if (!self.userWebSocketMap[uuid])
                    return;

                self.userWebSocketMap[uuid] = _.filter(self.userWebSocketMap[uuid], function(s){
                    return socket.id != s.id;
                });
            });
        });

        function getUserId(socket, callback){
            self.getSocketSession(socket, function(err, session){
                if (err || !session)
                    return;

                var uuid = session.user ? (session.user.uuid || session.user._id): false;
                if (!uuid)
                    return;

                callback(null, uuid)
            });
        }
    }

    self.initUserWebSocketMaping();
}



util.inherits(SIACluster, IRISApp.Application);
new SIACluster(__dirname);

