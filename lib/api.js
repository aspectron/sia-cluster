var _ = require("underscore");
var APIBase = require("./api-base");
var crypto = require("crypto");

function API(core){
	var self = this;
	APIBase.call(self, core, "API");
	self.clientIPs = {};

	self.init = function(){}

	self.initHttp = function(app){

		app.get('/', function(req, res, next) {
            if (!req.session.user)
                return res.redirect("/login");

            var user = {
                email: req.session.user.email
            }
            res.render("app", { req: req, user: user });
        });

        app.get('/login', function(req, res, next) {
            req.session.challenge = crypto.createHash('sha256').update(core.config.http.session.secret+Date.now()).digest('hex');
            res.render("login", { req: req, user: false });
        });

        app.get('/logout', function(req, res, next) {
            delete req.session.user;
            res.redirect("/");
        });

        app.post('/login', function(req, res, next) {

            var ip = core.getClientIp(req);
            var ts = Date.now();
            var user = req.body.user;
            var sig = req.body.sig;
            var challenge = req.session.challenge;
            if(!user || !sig || !user.length || !sig.length || !challenge)
                return res.status(401).json({error: "Invalid details"});

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

                console.log("lsig", lsig, sig)
                if(sig != lsig)
                    return res.status(401).end();

                req.session.user = user;
                return res.status(200).json({ ack : challenge });
            }
        })
        /*
        app.post('/contact', function(req, res, next){
            var data = req.body;
            var config = core.config.contactus.email;
            core.helper.renderFile("contactus", {data: data}, function(err, html){

	            var mailOptions = {
	                from: config.from, // sender address
	                to: config.to, // list of receivers
	                replyTo: data.email,
	                subject: config.subject.replace('{name}', data.name), // Subject line
	                text: config.text.replace(/\{name\}/g, data.name).replace(/\{email\}/g, data.email).replace(/\{message\}/g, data.message), // plaintext body
	                html: html // html body
	            };

	            core.mailer.sendMail(mailOptions, function(err, info){
	                if(err){
	                    console.log(err);
	                    return res.status(500).json({error: "Please try later"});
	                }

	                //console.log('Contact-Us E-Mail Message sent: ' + info.response);
	                res.json({success: true, message: req._T( config.alertMsg )});
	            });
            })
        });
        */
	}	
}

module.exports = API;