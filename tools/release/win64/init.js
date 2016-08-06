var fs = require('fs');
var path = require('path');
var UUID = require('node-uuid');
var crypto = require('crypto');
var rs = require('readline-sync');
var irisUtils = require('iris-utils');

var root = path.join(__dirname,'../../../');

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

if(!force && testFile(path.join(root,'config/sia-cluster.local.conf'))) {
	console.log("\nHas init.bat been ran already?".red.bold)
	console.log("config/sia-cluster.local.conf".bold+" already exists!".bold)
	console.log("\nUse "+"--force".bold+" to re-initialize (you will loose your settings!)\n\n")
	process.exit(0);
}

// ---
console.log("\n");
console.log("Creating user for web login...".bold);
console.log("\n");
var username = rs.question("Username:".bold);
if(!username) {
	console.log("You must specify username. Aborting...");
	process.exit(1);
}
var pass = rs.question("Password:".bold, { hideEchoBack : true });
if(!pass) {
	console.log("You must specify password. Aborting...");
	process.exit(1);
}
var passHash = crypto.createHash("sha256").update(pass).digest('hex');

// --

var local_conf = fs.readFileSync(path.join(root,'config/sia-cluster.local.conf-example'), { encoding : 'utf-8' });
var auth = crypto.createHash("sha256").update(UUID.v1()+UUID.v4+root.toString()+username+pass).digest('hex');
console.log("\nYour auth:\n\n"+auth.cyan.bold+"\n");
local_conf = local_conf
				.replace('1299ece0263565a53df103a34910884d5016a10d86c06e5f309f17761a965d28',auth)
				.replace('"test": {pass: "13a5c202e320d0bf9bb2c6e2c7cf380a6f7de5d392509fee260b809c893ff2f9"}',
					'"'+username+'": {pass: "'+passHash+'"}');
// console.log(local_conf)

fs.writeFileSync(path.join(root,'config/sia-cluster.local.conf'), local_conf);

// ---

var application = "@echo off\n"
				+"cd ..\n"
				+"start /MIN bin\\mongo\\mongod --dbpath "+path.join(root,'/data/db')+" \n"
				+"bin\\node\\node sia-cluster\n"
				+"cd bin\n";				

var service = "@echo off\n"
				+"cd ..\n"
				+"start /MIN bin/mongo/mongod --dbpath "+path.join(root,'/data/db')+" \n"
				+"bin\\node\\node run sia-cluster\n"
				+"cd bin\n";				

fs.writeFileSync(path.join(root,'bin/sia-cluster.bat'), application);
fs.writeFileSync(path.join(root,'bin/sia-cluster-service.bat'), service);

// ---

console.log("To run, start one of the following:\n");
console.log("bin/sia-cluster.bat".bold+" - application");
console.log("bin/sia-cluster-service.bat".bold+" - service");
console.log("\nYou can access Web UI at "+"http://localhost:5566\n".yellow.bold);
