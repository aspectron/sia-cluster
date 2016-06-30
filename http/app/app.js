
App = _.extend(window.App || {}, {
	dpc : function(t,fn) { if(typeof(t) == 'function') setTimeout(t,0); else setTimeout(fn,t); },
	stripC : function(v) { return (typeof v == 'string') ? parseFloat(v.replace(',','')) : (v || 0)  },
	c : function(f, precision) {
	    if(f === null || f === undefined)
	        return '?';
	    return f.toFixed(precision).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	},
	error : function(err, title) {
		if (err.logout){
			IRIS.Alert({title: "Auto Sign-out", text: "Please Sign-in."}, function(btn){
				window.location.href = '/login?redirect_uri=' + encodeURIComponent(window.location.href);
			});
			return
		}
		if (err){
			if (err.error) {
				IRIS.Alert({title: title || "Error", text:err.error})
			}else if (err.warning) {
				IRIS.Alert({title: title || "Warning", text:err.warning})
			}else if (err.info) {
				IRIS.Alert({title: title || "Info", text:err.info})
			}
		};
		return err;
	},

	showLoading: function(){
		$(document.body).addClass('loading')
	},
	hideLoading: function(){
		$(document.body).removeClass('loading')
	},
	_graphRange: 24,
	setGraphRange: function(hours){
		if (this._graphRange == hours)
			return;
		this._graphRange = hours;
		$(document.body).trigger("graph-range-changed", {graphRange: this._graphRange});
	},
	getGraphRange: function(){
		var endTS 		= Date.now();
		var startTS 	= endTS - this._graphRange * 60 * 60 * 1000;
		return {endTS: endTS, startTS: startTS};
	},
	str2hex: function (str, isNumber) {
        if (isNumber)
        	return parseInt(str).toString(16);

        var tempstr = '';
        str = str+"";
        for (a = 0; a < str.length; a++) {
            tempstr = tempstr + str.charCodeAt(a).toString(16);
        }
        return tempstr;
    },
    hex2str: function (str, isNumber) {
    	if (isNumber)
    		return parseInt(str, 16);

        var tempstr = '';
        for (b = 0; b < str.length; b = b + 2) {
            tempstr = tempstr + String.fromCharCode(parseInt(str.substr(b, 2), 16));
        }
        return tempstr;
    }
})

var VariableDataFormatter = {
	load: function(value, field, data){
		if(value === undefined)
			return 'N/A';
		if (!_.isObject(value))
			return parseFloat(value).toFixed(2);
		return _.map(value, function(ln) {
			return parseFloat(ln).toFixed(2);
		}).join('/');
	},
	memory: function(value, field, data) {
		if (!_.isObject(value))
			return value ? parseInt(value).toFileSize() : "";

		return this.memory(value.used) +"/"+ this.memory(value.total)
	},
	systemVersion: function(value, field, data){
		if (!data || !data.version)
			return "";
		return data.version.version + " " + data.version.platform;
	}
}
var VariableGraphFormatter = {
	_getYTitle: function(variable, y){
		var t = NodeVariableSettings.info;
		if (!t[variable])
			return y;
		if (t[variable][y])
			return t[variable][y];
		if (t[variable+"."+y])
			return t[variable+"."+y].title;
		return y;
	},
	_forEachSeries: function(row, variable, fn){
		var d = {x: row.x};
		
		var self = this;
		_.each(row, function(v, y){
			if (y == "x")
				return
			d[self._getYTitle(variable, y)] = fn(v, y);
		})
		return d;
	},
	memory: function(row, index, variable){
		return this._forEachSeries(row, variable, function(v, y){
			return v / 1024 / 1024 / 1024;
		})
	},
	SC_BTC: function(row, index, variable){
		return this._forEachSeries(row, variable, function(v, y){
			return v * 1e6;
		})
	},
	SC_USD: function(row, index, variable){
		return this._forEachSeries(row, variable, function(v, y){
			return v * 100;
		})
	}
};

String.prototype.replaceAt=function(index, character) {
    return this.substr(0, index) + character + this.substr(index+character.length);
}
String.prototype.pad=function(length, character) {
	var text = this;
	while(text.length < length)
		text = character+text;
    return text;
}