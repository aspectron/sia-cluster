# Sia Cluster 0.9.0

http://aspectron.com/#SiaCluster

[![dependencies Status](https://david-dm.org/aspectron/sia-cluster.svg)](https://david-dm.org/aspectron/sia-cluster#info=dependencies)
[![license:mit](https://img.shields.io/badge/license-mit-blue.svg)](https://opensource.org/licenses/MIT)

Sia Cluster is a solution for monitoring multiple [Sia](http://sia.tech) hosts (siad instances).  It is useful if you are running siad across multiple computers and want to monitor their status from a single location.

![Sia Cluster Screen Shot](/resources/images/sia-cluster-screenshot-01.png)


Sia Cluster features include:

* Pegging of storage cost to USD based on average market price of Sia Coin.
* Monitoring average market price of Sia Coin.
* Monitoring average price of storage on Sia network.
* Remote configuration of siad operating parameters.
* Monitoring of storage utilization and various siad metrics.
* Monitoring computer metrics such as memory and network bandwidth utilization.

Sia Cluster is comprised of 2 projects
* Sia Cluster - Server (this repository)
* [Sia Node](http://github.com/aspectron/sia-node) - **siad** interface RPC relay

Sia Node must be deployed on all remote computers running Sia Host (siad) and configured to connect to Sia Cluster. Connectivity between Sia Cluster and Sia Node can be initiated in either direction (Sia Cluster to Sia Node or Sia Node to Sia Cluster).

Sia Cluster is developed on top of [IRIS](https://github.com/aspectron/iris-app), as such, configuration, application deployment, RPC links and other conponents are configurable as described in [IRIS documentation](https://github.com/aspectron/iris-app/blob/master/README.md)

Please refer to [IRIS Project Configuration](https://github.com/aspectron/iris-app#project-configuration) for general information on management of configuration files.


## Dependencies

**NOTE:** Sia Cluster requires a **local instance of siad** running, so you must deploy the latest siad on the same system you will be running Sia Cluster. (local instance is needed for network statistics).

Sia Cluster runs on top of **NodeJs** and requires a local instance of **MongoDb**.

Once NodeJs is installed, you need to install **Bower** npm module. If you do not do this, some Sia Cluster NPM modules will fail to install. You can do this by running:

```
npm install bower -g
```

### Linux

For linux, we recommend NodeJs installation instructions located here: 
* https://github.com/aspectron/iris-app#setting-up-nodejs-on-your-system

Full installation script:
```bash
cd ~
wget https://nodejs.org/dist/v6.2.2/node-v6.2.2-linux-x64.tar.xz
tar xf node-v6.2.2-linux-x64.tar.xz
ln -s node-v6.2.2-linux-x64 node
echo -e "\n\nPATH=\"\$HOME/node/bin:\$PATH\"\n\n"
source ~/.profile
sudo apt-get install git mongodb
npm install bower -g
git clone https://github.com/aspectron/sia-cluster
cd sia-cluster
npm install
node sia-cluster
```

### Windows

For windows, download and install: 
* NodeJs - https://nodejs.org/en/download/current/
* MongoDb - https://www.mongodb.com/download-center
* Git for Windows - https://git-for-windows.github.io/

Run the following from command line:
```
npm install bower -g
mkdir sia
cd sia
git clone https://github.com/aspectron/sia-cluster
cd sia-cluster
npm install
node sia-cluster
```

## Usage

Sia Cluster is a server application meant to run together with [Sia Node](https://github.com/aspectron/sia-node).

Once running, you can access user interface at `http://localhost:6454`

To deploy Sia Cluster as a daemon on ubuntu using Upstart service, you can use following instructions: https://github.com/aspectron/iris-app#deploying-as-ubuntu-upstart-service

You can also place it behind NGINX if your system is already running NGINX or you would like to bind it to a specific domain name: https://github.com/aspectron/iris-app#using-nginx-as-a-proxy


## Basic Auth

To prevent anyone from reaching user interface of Sia Cluster, you can enable "basic auth", which will cause browser to ask for username and password before displaying any web content.

To enable basic auth, add the following directive in your `sia-cluster.local.conf`:

```
    basicAuth : {
        user : "<username>",
        pass : "<plain-text-password>"
    }

```


## User Access

To gain access to the user interface, you need to create a local user. To do this, add the following configuration object to `config/sia-cluster.local.conf`:

```javascript
    users : {
        "<username>": { 
        	pass: "<sha256-hex-of-your-password>" 
        }
    },

```

To generate a password, you can use simple hex output of sha256. This can be easily done here: http://www.xorbin.com/tools/sha256-hash-calculator or in NodeJs: 
```javascript
console.log(require("crypto").createHash("sha256").update("<password>").digest("hex"));
```.

User login to Sia Cluster implements geometric back-off algorithm, which means that each time incorrect login is made from a specific IP, the amount of seconds user has to wait doubles.

## Configuring inbound RPC

You need to create and set a unique `rpc.auth` hex string that will match all of your Sia Node deployments. You can optionally change port on which RPC is listening (as long as it matches Sia Node configuration).

Example of RPC server configuration located in `config/sia-cluster.local.conf`:

```javascript
    rpc : {
        node : {
            port : 58481,
            auth : "1299ece0213565353df003a3491081ed5016a10d81c06e5f319f17717a965d28"
        }
    },

```

Example of Sia Node RPC client configuration located in `config/sia-node.local.conf`:
```javascript
    rpc : {
        address : "<sia-cluster-ip>:<sia-cluster-rpc-port>",
        auth : "<hex-string-matching-auth-configured-on-sia-cluster>"
    }
```

## Configuring outbound RPC

If your instance of Sia Cluster is running on a computer behind NAT or firewall but your Sia Node instances are running on the public network, you can configure an RPC channel to connect from Sia Cluster to Sia Node (instead of Sia Node connecting to Sia Cluster).

To do this, add the following configuration option to your `config/sia-cluster.local.conf` file:

```javascript
    rpc : {
        dpts : {
            address : '<sia-node-ip>:<sia-node-port>',
            auth : "<hex-string-matching-auth-configured-on-sia-node>"
        }
    },

```

Example of Sia Node RPC client configuration located in `config/sia-node.local.conf`:
```javascript
    rpc : {
        port : <sia-node-rpc-port>,
        auth : "<hex-string-matching-auth-configured-on-sia-cluster>"
    }
```



## SSL Certificates

By default Sia Cluster is not configured to serve user interface via HTTPS, hence SSL certificates are not needed.

SSL certificates are only included in Sia Cluster project to allow linking nodes to server via [IRIS RPC](https://github.com/aspectron/iris-rpc). These certificates are fake and are only required because IRIS RPC uses JSON over TLS.

You do not need to install your own certificates. Instead, you only need to configure `auth` parameter across Sia Cluster and all Sia Node instances to a matching private string.  `auth` is a pre-shared key and connecting parties will reject connection if it does not match.

For additional information you can refer to [IRIS RPC Documentation](https://github.com/aspectron/iris-rpc) and [IRIS SSL Configuration](https://github.com/aspectron/iris-app#ssl-certificates).


## User Interface

### Sia Coin (SC) Value Editors

Sia Coin value editors accept value format the same way `siac` does. 
The smallest unit of siacoins is the hasting. One siacoin is 10^24 hastings (H). Other supported units are:

* pS (pico,  10^-12 SC)
* nS (nano,  10^-9 SC)
* uS (micro, 10^-6 SC)
* mS (milli, 10^-3 SC)
* SC
* KS (kilo, 10^3 SC)
* MS (mega, 10^6 SC)
* GS (giga, 10^9 SC)
* TS (tera, 10^12 SC)

If you do not include a suffix, the system interprets value as SC.

### Metric vs Binary

Please not that some values are presented in metric (SI units) such as GB, TB, while others are presented in binary units such as GiB, TiB.

### USD Pegging & Tracking Average Network Price

Sia Cluster provides ability to automatically control storage pricing. Pricing can be controlled via **USD Pegging**, by tracking USD/SC value of Sia Coin on major markets or by monitoring **Average Host Price** and then offsetting it if desired.

Following parameters for price tracking are available in the Sia Cluster panel:

* **Track Price** - Enable / Disable price tracking on nodes
* **Track Method** - **USD Peg**, **Average** or **Weighted**
* **Target USD/TB/MO** - For USD Pegging: Target USD value per TB per Month
* **Price Factor (Avg.)** - For Average or Weighted Host Price: Multiplier for average or weighted host price to set local cluster price (for example: 0.9 will result in 90% of the average or weighted price)
* **Min Price** - Minimum price (floor - price won't drop below this value)
* **Max Price** - Maximum price (ceiling - price won't go above this value)
* **Storage Price Update** - Time interval for price updates in minutes

### Dashboard

Sia Cluster UI was originally designed to be a dashboard view.  Main Settings menu has a UI tab.  In this dialog, you can adjust sizes of the font and panels.  Sizes of these elements are stored in the URL (hash).  As such, once UI is configured to your liking, you can bookmark the URL and later invoke it to restore your configuration.  This is especially useful if you have extra monitors and have some form of monitoring [OCD](https://en.wikipedia.org/wiki/Obsessive%E2%80%93compulsive_disorder).

## Data Updates

Sia Node polls siad as well as gathers system stats once a minute and sends the data over to Sia Cluster.  Certain actions on Sia Cluster cause immediate update.  In general, if you are interfacing with siad using the *Sia UI* or *siac* console interface (or any other connecting applications), changes to internal settings will reflect in Sia Cluster UI within a minute.

Network panel contains general information about the Sia network.  This information is being polled from `explore.sia.tech` block explorer.


## Security

If you intend on using Sia Cluster over the open Internet, you need to take security percautions:

* Enable SSL (HTTPS) by setting `ssl : true` and `redirectToSSL : true` in config files.
* Enable `basicAuth` (example is given in `sia-cluster.local.conf-example` file) to obscure the application.
* Generate your own SSL certificates and copy them as `certificates/sia-cluster.local.key` and `certificates/sia-cluster.local.crt`
* If you have a Cloud Flare account, you can place Sia Cluster behind Cloud Flare to use their automatically generated SSL certificates.
* You can also place the entire setup behind NGINX proxy and use NGINX configuration. This is especially useful if you need to serve Sia Cluster over port 443 while having other services on the same server. NGINX proxy setup instruction are available [here](https://github.com/aspectron/iris-app#using-nginx-as-a-proxy)
* When unlocking wallets remotely, it is best if you use "local passphrase" as opposed to entering the encryption key of the wallet itself (which is also your wallet seed).  This prevents transmission of the seed over communication channels. No matter how secure your setup is, if the machine on which Sia Cluster is running is compromised, software can be modified to listen in on all communication exchange and subsequently your seed can be stolen.
* Always backup all the seeds from all computers!


