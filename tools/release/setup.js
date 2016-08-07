var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var UUID = require('node-uuid');
var crypto = require('crypto');
var rs = require('readline-sync');
var request = require('request');
var progress = require('request-progress');
var irisUtils = require('iris-utils');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Sia = require('sia-api');

var root = path.join(__dirname,'../../');
var temp = '/tmp';

var platform = process.platform;
if(platform == 'win32') {
	platform = 'windows';
	var temp = path.join(process.env.TEMP);
}

function testFile(file) {
	try {
		fs.accessSync(file);
		return true;
	}
	catch(ex) {
		return false;
	}
}

var force = process.argv.join(' ').match(/--force/ig) ? true : false;
var nomongo = process.argv.join(' ').match(/--nomongo/ig) ? true : false;

if(!force && testFile(path.join(root,'config/sia-cluster.local.conf'))) {
	console.log("\nDid setup run already?".red.bold)
	console.log("config/sia-cluster.local.conf".bold+" already exists!".bold)
	console.log("\nUse "+"--force".bold+" to re-initialize (you will loose your settings!)\n\n")
	process.exit(0);
}

// ---
/*
Object.defineProperty(Number.prototype, 'toFileSize', {
    value: function(a, asNumber){
        var b,c,d;
        var r = (
            a=a?[1e3,'k','B']:[1024,'K','iB'],
            b=Math,
            c=b.log,
            d=c(this)/c(a[0])|0,this/b.pow(a[0],d)
        ).toFixed(2)

        if(!asNumber){
            r += ' '+(d?(a[1]+'MGTPEZY')[--d]+a[2]:'Bytes');
        }
        return r;
    },
    writable:false,
    enumerable:false
});*/

function fetch(options, callback) {

	var  MAX = 60, MIN = 0, value = 0;
	console.log("Downloading: "+options.file);
	progress(request(options.url), {
	    throttle: 250,                    // Throttle the progress event to 2000ms, defaults to 1000ms 
	    delay: 1000,                       // Only start to emit after 1000ms delay, defaults to 0ms 
	    // lengthHeader: 'x-transfer-length'  // Length header to use, defaults to content-length 
	})
	.on('progress', function (state) {
		if(state.percentage > 0.99)
			state.percentage = 1;
	    var value = Math.ceil(state.percentage * 60);
	 	console.log('\x1B[1A\x1B[K|' +
		    (new Array(value + 1)).join('=') + '>' +
		    (new Array(MAX - value + 1)).join('-') + '|  ' + (state.percentage*100).toFixed(1) + '%  '
		    + state.size.transferred.toFileSize().split(' ').shift()+'/'
		    + state.size.total.toFileSize()+'  '
		    + state.speed.toFileSize()+'/s'
		    );
	})
	.on('error', function (err) {
		err && console.log(err.toString());
		callback(err);
	})
	.pipe(fs.createWriteStream(options.file))
	.on('finish', function(err) {
		console.log("");
		err && console.log(err.toString());
		callback();
	});
}

// -------------------------

var mongoPath = null;
var mongoRootPath = path.join(process.env.ProgramFiles || '',"MongoDB/Server");

function init() {

	console.log("");
	console.log("Creating user for Sia Cluster web login...".bold);
	console.log("");
	var username = rs.question("Username:");
	if(!username) {
		console.log("You must specify username. Aborting...");
		process.exit(1);
	}
	var pass = rs.question("Password:", { hideEchoBack : true });
	if(!pass) {
		console.log("You must specify password. Aborting...");
		process.exit(1);
	}
	var passHash = crypto.createHash("sha256").update(pass).digest('hex');

	// --

	var local_conf = fs.readFileSync(path.join(root,'config/sia-cluster.local.conf-example'), { encoding : 'utf-8' });
	var auth = crypto.createHash("sha256").update(UUID.v1()+UUID.v4+root.toString()+username+pass).digest('hex');
	console.log("\nYour auth:\n\n"+auth.cyan.bold+"\n(You can find this later in "+"config/sia-cluster.local.conf".bold+")");
	local_conf = local_conf
					.replace('1299ece0263565a53df103a34910884d5016a10d86c06e5f309f17761a965d28',auth)
					.replace('"test": {pass: "13a5c202e320d0bf9bb2c6e2c7cf380a6f7de5d392509fee260b809c893ff2f9"}',
						'"'+username+'": {pass: "'+passHash+'"}');
	// console.log(local_conf)

	fs.writeFileSync(path.join(root,'config/sia-cluster.local.conf'), local_conf);

	// ---

	if(platform == "windows") {
		var application = "@echo off\n"
						+"cd ..\n"
						+(nomongo ? "" : "start /MIN "+mongoPath+"\\bin\\mongod.exe --dbpath "+path.join(root,'/data/db')+" \n")
						+"bin\\node\\node sia-cluster %*\n"
						+"cd bin\n";				

		var service = "@echo off\n"
						+"cd ..\n"
						+(nomongo ? "" : "start /MIN "+mongoPath+"\\bin\\mongod.exe --dbpath "+path.join(root,'/data/db')+" \n")
						+"bin\\node\\node run sia-cluster %*\n"
						+"cd bin\n";				

		fs.writeFileSync(path.join(root,'bin/sia-cluster.bat'), application);
		fs.writeFileSync(path.join(root,'bin/sia-cluster-service.bat'), service);
	}
	else {
		var application = "# !/bin/bash\n"
						+"cd ..\n"
						+"bin/node/node sia-cluster \"$@\"\n"
						+"cd bin\n";				

		var service = "# !/bin/bash\n"
						+"cd ..\n"
						+"bin/node/node run sia-cluster \"$@\"\n"
						+"cd bin\n";				

		var p = path.join(root,'bin/sia-cluster').toString();
		fs.writeFileSync(p, application);
		execSync("chmod a+x "+p)
		fs.writeFileSync(p+'-service', service);
		execSync("chmod a+x "+p+'-service')
	}

	// ---
	var suffix = platform == "windows" ? "bat" : "";
	console.log("To run, start one of the following:\n");
	console.log(("bin/sia-cluster."+suffix).bold+" - application");
	console.log(("bin/sia-cluster-service."+suffix).bold+" - service");
	console.log("\nYou can access Web UI at "+"http://localhost:5566\n".yellow.bold);

	var Sia = require('sia-api');
    var sia = new Sia({
        host : "http://127.0.0.1:9980",
        timeout : 3 * 1000,
        verbose : false
    });
    console.log("Checking for local Sia daemon...")
    sia.daemon.version(function(err, resp) {
        if(err) {
        	console.log("");
            console.log("Warning: Unable to connect to local Sia daemon".magenta.bold);
            console.log("Error:",err.toString());
            console.log("Please start and sync Sia before running Sia Cluster".yellow.bold);
        }
        else
            console.log("Found local Sia daemon version:".cyan.bold, resp.version.bold);
    })


}

function getMongoPath() {
	try {
		var list = fs.readdirSync(mongoRootPath,{ encoding : 'utf-8' });
		list = list.sort(function(a,b) { return parseFloat(b)-parseFloat(a); })
		list = _.filter(list, function(v) {
			if(!parseFloat(v))
				return false;
			var s = fs.statSync(path.join(mongoRootPath,v));
			if(s.isDirectory())
				return true;
			return false;
		})
		var mongo = list.shift();
		if(!mongo)
			return null;
		return path.join(mongoRootPath,mongo);
	}
	catch(ex) {
		console.log(ex.toString);
		return null;
	}
}


function installMongoDb(callback) {
	var mongodbFile = path.join(temp,"mongodb-win32-x86_64-2008plus-ssl-latest-signed.msi");
	fetch({ url : "http://downloads.mongodb.org/win32/mongodb-win32-x86_64-2008plus-ssl-latest-signed.msi",
			file : mongodbFile,
			// size : 154128896
		},
		function() {
			console.log("Waiting for MongoDB install...")
			var e = 'msiexec /i '+mongodbFile;
			// console.log(e);
			exec(e, function(err) {
				// console.log(err)
				callback();
				
			});
		})
}


function main() {
	console.log('');

	if(platform == 'windows') {
		var mongoPath = getMongoPath();
		console.log("MongoDB Found at:",mongoPath);
		if(!nomongo && !mongoPath) {
			console.log("MongoDB not found!".yellow.bold);
			if (rs.keyInYN('Do you want to install MongoDb?')) {
			  console.log('');
			  installMongoDb(function() {
			  	init();	// -->
			  });
			  return;
			}
		}
	}
	init(); // -->
}

main();
